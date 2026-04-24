import mongoose from "mongoose";
import type { IBattle, IVirtualCard } from "@/models/battle";
import Battle from "@/models/battle";
import User from "@/models/user";
import { evaluateRound, evaluateBattle } from "@/lib/battle-engine";
import { loadBattleBoxCards, drawBattleHandCards } from "@/lib/battle-cards";
import { calculateEloChanges, DEFAULT_ELO, type EloPlayer } from "@/lib/battle-elo";
import {
  publishBattleEvent,
  type BattleEventType,
} from "@/lib/battle-events";
import { scheduleBattleJob } from "@/lib/battle-jobs";

export const SELECT_DEADLINE_MS = 30 * 1000;

interface BufferedEvent {
  type: BattleEventType;
  data: Record<string, unknown>;
}

/**
 * Resolve the current round and move the battle forward. The function:
 *   1. mutates the battle in-memory (round status, winner, scores, next round)
 *   2. persists with a single `battle.save()`
 *   3. runs external side effects (User ELO/streak updates if finished)
 *   4. publishes SSE events in the same order clients need to render them
 *
 * All publishes happen AFTER `battle.save()` — so any client that re-fetches
 * in response to an event always sees a DB state consistent with that event.
 */
export async function resolveRound(
  battle: InstanceType<typeof Battle>,
  battleId: string,
): Promise<void> {
  const currentRound = battle.rounds[battle.rounds.length - 1];
  const events: BufferedEvent[] = [];

  // --- 1. Evaluate the round (in-memory) ---
  currentRound.status = "revealing";
  currentRound.revealedAt = new Date();

  const selections = currentRound.hands.map((h) => ({
    player: h.player,
    card: h.cards[h.selectedCardIndex!] as IVirtualCard,
  }));

  const roundResult = evaluateRound(selections, battle.settings.mode);
  currentRound.winner = roundResult.winner;
  currentRound.status = "completed";

  if (roundResult.winner) {
    const winnerPlayer = battle.players.find(
      (p) => p.user.toString() === roundResult.winner!.toString(),
    );
    if (winnerPlayer) winnerPlayer.roundsWon++;
  }

  events.push({
    type: "round_reveal",
    data: {
      roundNumber: currentRound.roundNumber,
      selections: selections.map((s) => ({
        player: s.player.toString(),
        card: s.card,
      })),
      winner: roundResult.winner?.toString() ?? null,
      scores: Object.fromEntries(
        battle.players.map((p) => [p.user.toString(), p.roundsWon]),
      ),
    },
  });

  // --- 2. Decide what happens next (in-memory) ---
  const maxRounds =
    battle.status === "sudden_death"
      ? currentRound.roundNumber
      : battle.settings.rounds;
  const completedRounds = battle.rounds.filter((r) => r.status === "completed").length;

  let finalizeUserUpdates: (() => Promise<void>) | null = null;
  let nextAutoSelectRound: number | null = null;

  if (completedRounds >= maxRounds || battle.status === "sudden_death") {
    const roundWins = new Map<string, number>();
    for (const p of battle.players) {
      roundWins.set(p.user.toString(), p.roundsWon);
    }

    const battleResult = evaluateBattle(roundWins);

    if (battleResult.needsSuddenDeath && battle.status !== "sudden_death") {
      battle.status = "sudden_death";
      nextAutoSelectRound = await prepareNextRound(battle, events);
    } else {
      const winnerId = battleResult.winner?.toString() ?? null;
      finalizeUserUpdates = await prepareFinishBattle(battle, winnerId, events);
    }
  } else {
    nextAutoSelectRound = await prepareNextRound(battle, events);
  }

  // --- 3. Persist battle state BEFORE anything fires externally ---
  await battle.save();

  // --- 4. External side effects (ELO/streak user updates on finish) ---
  if (finalizeUserUpdates) {
    await finalizeUserUpdates();
  }

  // --- 5. Publish events — clients refetching now see a consistent DB ---
  for (const ev of events) {
    await publishBattleEvent(battleId, ev.type, ev.data);
  }

  // --- 6. Schedule auto-select for the new round (if any) ---
  if (nextAutoSelectRound !== null) {
    await scheduleBattleJob(
      "auto-select",
      { battleId, roundNumber: nextAutoSelectRound },
      SELECT_DEADLINE_MS + 2000,
    );
  }
}

/**
 * Start a new round in-memory and queue its round_start events.
 * Does NOT save or publish — the caller orchestrates that.
 * Returns the new round number (for scheduling auto-select).
 */
async function prepareNextRound(
  battle: InstanceType<typeof Battle>,
  events: BufferedEvent[],
): Promise<number> {
  const boxCards = await loadBattleBoxCards(battle.box);
  const nextRoundNumber = battle.rounds.length + 1;
  battle.currentRound = nextRoundNumber;

  const selectDeadline = new Date(Date.now() + SELECT_DEADLINE_MS);
  const hands = battle.players.map((p) => ({
    player: p.user,
    cards: drawBattleHandCards(boxCards),
    selectedCardIndex: null,
    selectedAt: null,
  }));

  battle.rounds.push({
    roundNumber: nextRoundNumber,
    hands,
    winner: null,
    status: "selecting",
    selectDeadline,
    revealedAt: null,
  });

  // Single broadcast event carrying every player's hand — the SSE route
  // picks the right hand per user. Saves N-1 Redis publishes per round.
  events.push({
    type: "round_start",
    data: {
      roundNumber: nextRoundNumber,
      selectDeadline: selectDeadline.toISOString(),
      hands: Object.fromEntries(
        hands.map((h) => [h.player.toString(), h.cards]),
      ),
    },
  });

  return nextRoundNumber;
}

/**
 * Mutate battle to the "finished" state in-memory, compute ELO changes,
 * and queue the battle_end event. The returned callback performs the
 * per-user ELO/streak writes — callers invoke it AFTER `battle.save()`.
 */
async function prepareFinishBattle(
  battle: InstanceType<typeof Battle>,
  winnerId: string | null,
  events: BufferedEvent[],
): Promise<() => Promise<void>> {
  battle.status = "finished";

  const playerIds = battle.players.map((p) => p.user.toString());
  const users = await User.find({ _id: { $in: playerIds } })
    .select("_id elo battleStats.totalBattles")
    .lean();

  const eloPlayers: EloPlayer[] = users.map((u) => ({
    id: u._id.toString(),
    elo: u.elo ?? DEFAULT_ELO,
    totalBattles: u.battleStats?.totalBattles ?? 0,
  }));

  const eloChanges = winnerId ? calculateEloChanges(eloPlayers, winnerId) : [];

  battle.result = {
    winner: winnerId ? new mongoose.Types.ObjectId(winnerId) : null,
    isDraw: !winnerId,
    finalScores: battle.players.map((p) => ({
      player:
        p.user instanceof mongoose.Types.ObjectId
          ? p.user
          : new mongoose.Types.ObjectId(String(p.user)),
      roundsWon: p.roundsWon,
    })),
    eloChanges: eloChanges.map((c) => ({
      player: new mongoose.Types.ObjectId(c.id),
      oldElo: c.oldElo,
      newElo: c.newElo,
      change: c.change,
    })),
    completedAt: new Date(),
  };

  events.push({
    type: "battle_end",
    data: { result: battle.result },
  });

  // Return a callback that applies all User updates in parallel.
  // Winners: +1 wins, streak+1, bestStreak = max(prev, streak+1).
  // Losers: +1 losses, streak reset to 0.
  // Draws: +1 totalBattles only, streak reset to 0, ELO unchanged.
  return async () => {
    if (!winnerId) {
      // Draw path — still bump totalBattles so stats stay consistent, and
      // reset any ongoing streak since the battle didn't resolve as a win.
      await User.updateMany(
        { _id: { $in: playerIds } },
        {
          $inc: { "battleStats.totalBattles": 1 },
          $set: { "battleStats.streak": 0 },
        },
      );
      return;
    }

    if (eloChanges.length === 0) return;

    await Promise.all(
      eloChanges.map(async (change) => {
        const isWinner = change.id === winnerId;
        if (isWinner) {
          // Use an aggregation-pipeline update so streak/bestStreak can be
          // computed in a single roundtrip without a read-then-write.
          await User.updateOne({ _id: change.id }, [
            {
              $set: {
                elo: change.newElo,
                "battleStats.totalBattles": {
                  $add: [{ $ifNull: ["$battleStats.totalBattles", 0] }, 1],
                },
                "battleStats.wins": {
                  $add: [{ $ifNull: ["$battleStats.wins", 0] }, 1],
                },
                "battleStats.streak": {
                  $add: [{ $ifNull: ["$battleStats.streak", 0] }, 1],
                },
                "battleStats.bestStreak": {
                  $max: [
                    { $ifNull: ["$battleStats.bestStreak", 0] },
                    { $add: [{ $ifNull: ["$battleStats.streak", 0] }, 1] },
                  ],
                },
              },
            },
          ]);
        } else {
          await User.updateOne(
            { _id: change.id },
            {
              $set: { elo: change.newElo, "battleStats.streak": 0 },
              $inc: {
                "battleStats.totalBattles": 1,
                "battleStats.losses": 1,
              },
            },
          );
        }
      }),
    );
  };
}

/**
 * Start the first round of a battle (called from start/route.ts and worker
 * auto-start). Same save-before-publish guarantee as resolveRound.
 */
export async function startFirstRound(
  battle: InstanceType<typeof Battle>,
  battleId: string,
): Promise<void> {
  const events: BufferedEvent[] = [];

  battle.status = "active";
  const nextAutoSelectRound = await prepareNextRound(battle, events);

  // The "battle_start" event lets clients switch to the active view; keep it
  // before round_start so UI transitions land in the right order.
  const startEvent: BufferedEvent = {
    type: "battle_start",
    data: { isCountdown: false },
  };
  events.unshift(startEvent);

  await battle.save();

  for (const ev of events) {
    await publishBattleEvent(battleId, ev.type, ev.data);
  }

  await scheduleBattleJob(
    "auto-select",
    { battleId, roundNumber: nextAutoSelectRound },
    SELECT_DEADLINE_MS + 2000,
  );
}

// Re-export for existing IBattle consumers
export type { IBattle };
