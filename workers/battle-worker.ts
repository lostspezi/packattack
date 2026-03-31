import { BATTLE_QUEUE } from "@/lib/battle-jobs";
import { createWorker } from "@/lib/queue";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import Box from "@/models/box";
import User from "@/models/user";
import CoinTransaction from "@/models/coin-transaction";
import { publishBattleEvent, withBattleLock } from "@/lib/battle-events";
import { evaluateRound, evaluateBattle } from "@/lib/battle-engine";
import { prepareBoxCardsForBattle, drawAndPersistBattleHand, transferCardOwnership, activateBattlePullExpiry, cleanupUnselectedBattlePulls } from "@/lib/battle-cards";
import { distributeByMode } from "@/lib/battle-distribution";
import { calculateEloChanges, type EloPlayer } from "@/lib/battle-elo";
import { scheduleBattleJob } from "@/lib/battle-jobs";
import type { IVirtualCard } from "@/models/battle";
import PackPull from "@/models/pack-pull";
import mongoose from "mongoose";

// ---------- Auto-Cancel: waiting battles that expired ----------

async function processAutoCancel(battleId: string) {
  await connectDB();

  return withBattleLock(battleId, "auto-cancel", async () => {
    const battle = await Battle.findById(battleId);
    if (!battle) return;

    // Cancel if waiting+expired or ready_check+expired
    if (battle.status === "waiting" && battle.lobbyExpiresAt > new Date()) return;
    if (battle.status === "ready_check" && battle.readyCheckExpiresAt && battle.readyCheckExpiresAt > new Date()) return;
    if (battle.status !== "waiting" && battle.status !== "ready_check") return;

    battle.status = "cancelled";

    // Refund all players
    for (const player of battle.players) {
      await User.updateOne(
        { _id: player.user },
        { $inc: { coins: battle.entryFee } },
      );
      await CoinTransaction.create({
        userId: player.user,
        amount: battle.entryFee,
        type: "battle_refund",
        reason: "Battle expired (no players joined in time)",
        relatedBattleId: battle._id,
      });
    }

    await battle.save();
    await publishBattleEvent(battleId, "battle_cancelled", { reason: "expired" });
    console.log(`[battle-worker] Auto-cancelled expired battle ${battleId}`);
  });
}

// ---------- Auto-Start: countdown expired, start automatically ----------

async function processAutoStart(battleId: string) {
  await connectDB();

  return withBattleLock(battleId, "start", async () => {
    const battle = await Battle.findById(battleId);
    if (!battle) return;

    // Only auto-start if still in countdown
    if (battle.status !== "countdown") return;

    // Load box with cards
    const box = await Box.findById(battle.box)
      .populate("cards.card", "name image rarity internalPrice marketPrice")
      .lean();

    if (!box) {
      console.error(`[battle-worker] Box not found for battle ${battleId}`);
      return;
    }

    const boxCards = prepareBoxCardsForBattle(box);

    // Start battle
    battle.status = "active";
    battle.currentRound = 1;

    const selectDeadline = new Date(Date.now() + 30_000);
    const hands = [];
    for (const p of battle.players) {
      const cards = await drawAndPersistBattleHand(
        battle.box.toString(), boxCards, p.user.toString(), battleId,
      );
      hands.push({ player: p.user, cards, selectedCardIndex: null, selectedAt: null });
    }

    battle.rounds.push({
      roundNumber: 1,
      hands,
      winner: null,
      status: "selecting",
      selectDeadline,
      revealedAt: null,
    });

    await battle.save();

    await publishBattleEvent(battleId, "battle_start", { isCountdown: false });
    for (const hand of hands) {
      await publishBattleEvent(battleId, "round_start", {
        roundNumber: 1,
        playerId: hand.player.toString(),
        hand: hand.cards,
        selectDeadline: selectDeadline.toISOString(),
      });
    }

    // TODO: re-enable auto-select timer
    // await scheduleBattleJob("auto-select", { battleId, roundNumber: 1 }, 30_000 + 2000);

    console.log(`[battle-worker] Auto-started battle ${battleId}`);
  });
}

// ---------- Auto-Select: pick random card for AFK players ----------

async function processAutoSelect(battleId: string, roundNumber: number) {
  await connectDB();

  return withBattleLock(battleId, "select", async () => {
    const battle = await Battle.findById(battleId);
    if (!battle) return;

    if (battle.status !== "active" && battle.status !== "sudden_death") return;

    const currentRound = battle.rounds.find((r) => r.roundNumber === roundNumber);
    if (!currentRound || currentRound.status !== "selecting") return;

    // Auto-select random card for players who haven't picked
    let changed = false;
    for (const hand of currentRound.hands) {
      if (hand.selectedCardIndex === null) {
        const randomIndex = Math.floor(Math.random() * hand.cards.length);
        hand.selectedCardIndex = randomIndex;
        hand.selectedAt = new Date();
        changed = true;

        await publishBattleEvent(battleId, "player_selected", {
          player: hand.player.toString(),
          auto: true,
        });
      }
    }

    if (!changed) return;

    // All selected now — resolve the round
    await resolveRound(battle, battleId);

    console.log(`[battle-worker] Auto-selected for AFK players in battle ${battleId} round ${roundNumber}`);
  });
}

// ---------- Round resolution (shared with select route) ----------

async function resolveRound(
  battle: InstanceType<typeof Battle>,
  battleId: string,
) {
  const currentRound = battle.rounds[battle.rounds.length - 1];
  currentRound.status = "revealing";
  currentRound.revealedAt = new Date();

  const selections = currentRound.hands.map((h) => ({
    player: h.player,
    card: h.cards[h.selectedCardIndex!] as IVirtualCard,
  }));

  const roundResult = evaluateRound(selections);
  currentRound.winner = roundResult.winner;
  currentRound.status = "completed";

  if (roundResult.winner) {
    const winnerPlayer = battle.players.find(
      (p) => p.user.toString() === roundResult.winner!.toString(),
    );
    if (winnerPlayer) winnerPlayer.roundsWon++;
  }

  await publishBattleEvent(battleId, "round_reveal", {
    roundNumber: currentRound.roundNumber,
    selections: selections.map((s) => ({
      player: s.player.toString(),
      card: s.card,
    })),
    winner: roundResult.winner?.toString() ?? null,
    scores: Object.fromEntries(battle.players.map((p) => [p.user.toString(), p.roundsWon])),
  });

  // Check if battle is over
  const maxRounds = battle.status === "sudden_death"
    ? currentRound.roundNumber
    : battle.settings.rounds;

  const completedRounds = battle.rounds.filter((r) => r.status === "completed").length;

  if (completedRounds >= maxRounds || battle.status === "sudden_death") {
    const roundWins = new Map<string, number>();
    for (const p of battle.players) {
      roundWins.set(p.user.toString(), p.roundsWon);
    }

    const battleResult = evaluateBattle(roundWins);

    if (battleResult.needsSuddenDeath && battle.status !== "sudden_death") {
      battle.status = "sudden_death";
      await startNewRound(battle, battleId);
    } else {
      await finishBattle(battle, battleId, battleResult.winner?.toString() ?? null);
    }
  } else {
    await startNewRound(battle, battleId);
  }

  await battle.save();
}

async function startNewRound(
  battle: InstanceType<typeof Battle>,
  battleId: string,
) {
  const box = await Box.findById(battle.box)
    .populate("cards.card", "name image rarity internalPrice marketPrice")
    .lean();

  if (!box) return;

  const boxCards = prepareBoxCardsForBattle(box);
  const nextRoundNumber = battle.rounds.length + 1;
  battle.currentRound = nextRoundNumber;

  const selectDeadline = new Date(Date.now() + 30_000);
  const hands = [];
  for (const p of battle.players) {
    const cards = await drawAndPersistBattleHand(
      battle.box.toString(), boxCards, p.user.toString(), battleId,
    );
    hands.push({ player: p.user, cards, selectedCardIndex: null, selectedAt: null });
  }

  battle.rounds.push({
    roundNumber: nextRoundNumber,
    hands,
    winner: null,
    status: "selecting",
    selectDeadline,
    revealedAt: null,
  });

  for (const hand of hands) {
    await publishBattleEvent(battleId, "round_start", {
      roundNumber: nextRoundNumber,
      playerId: hand.player.toString(),
      hand: hand.cards,
      selectDeadline: selectDeadline.toISOString(),
    });
  }

  // Schedule auto-select for this round
  // TODO: re-enable auto-select timer
  // await scheduleBattleJob("auto-select", { battleId, roundNumber: nextRoundNumber }, 30_000 + 2000);
}

async function finishBattle(
  battle: InstanceType<typeof Battle>,
  battleId: string,
  winnerId: string | null,
) {
  battle.status = "finished";

  const playerCards = new Map<string, IVirtualCard[]>();
  const selectedPullIds = new Set<string>();
  for (const p of battle.players) {
    playerCards.set(p.user.toString(), []);
  }

  for (const round of battle.rounds) {
    for (const hand of round.hands) {
      if (hand.selectedCardIndex !== null) {
        const card = hand.cards[hand.selectedCardIndex];
        const existing = playerCards.get(hand.player.toString());
        if (existing) existing.push(card);
        if (card.pullId) selectedPullIds.add(card.pullId.toString());
      }
    }
  }

  // Clean up unselected cards (return stock, mark converted)
  await cleanupUnselectedBattlePulls(battleId, selectedPullIds);

  const transfers = winnerId
    ? distributeByMode(battle.settings.mode, winnerId, playerCards)
    : [];

  // Transfer PackPull ownership for redistributed cards
  for (const transfer of transfers) {
    if (transfer.from === transfer.to) continue; // No transfer needed (snake_draft self-assignment)
    for (const card of transfer.cards) {
      if (card.pullId) {
        await transferCardOwnership(card.pullId.toString(), transfer.to);
      }
    }
  }

  const playerIds = battle.players.map((p) => p.user.toString());
  const users = await User.find({ _id: { $in: playerIds } })
    .select("_id elo battleStats.totalBattles")
    .lean();

  const eloPlayers: EloPlayer[] = users.map((u) => ({
    id: u._id.toString(),
    elo: u.elo,
    totalBattles: u.battleStats?.totalBattles ?? 0,
  }));

  const eloChanges = winnerId ? calculateEloChanges(eloPlayers, winnerId) : [];

  for (const change of eloChanges) {
    const isWinner = change.id === winnerId;
    await User.updateOne(
      { _id: change.id },
      {
        $set: { elo: change.newElo },
        $inc: {
          "battleStats.totalBattles": 1,
          "battleStats.wins": isWinner ? 1 : 0,
          "battleStats.losses": isWinner ? 0 : 1,
        },
      },
    );

    if (isWinner) {
      const userData = await User.findById(change.id).select("battleStats").lean();
      const newStreak = (userData?.battleStats?.streak ?? 0) + 1;
      const bestStreak = Math.max(userData?.battleStats?.bestStreak ?? 0, newStreak);
      await User.updateOne(
        { _id: change.id },
        { $set: { "battleStats.streak": newStreak, "battleStats.bestStreak": bestStreak } },
      );
    } else {
      await User.updateOne({ _id: change.id }, { $set: { "battleStats.streak": 0 } });
    }
  }

  battle.result = {
    winner: winnerId ? new mongoose.Types.ObjectId(winnerId) : null,
    isDraw: !winnerId,
    finalScores: battle.players.map((p) => ({
      player: p.user instanceof mongoose.Types.ObjectId ? p.user : new mongoose.Types.ObjectId(String(p.user)),
      roundsWon: p.roundsWon,
    })),
    transfers: transfers.map((t) => ({
      from: new mongoose.Types.ObjectId(t.from),
      to: new mongoose.Types.ObjectId(t.to),
      cards: t.cards,
      mode: t.mode,
    })),
    eloChanges: eloChanges.map((c) => ({
      player: new mongoose.Types.ObjectId(c.id),
      oldElo: c.oldElo,
      newElo: c.newElo,
      change: c.change,
    })),
    completedAt: new Date(),
  };

  // Activate 5-min expiry timer on all battle pulls
  await activateBattlePullExpiry(battleId);

  await publishBattleEvent(battleId, "battle_end", { result: battle.result });
}

// ---------- Worker Entry ----------

export function startBattleWorker() {
  const worker = createWorker(BATTLE_QUEUE, async (job) => {
    const data = job.data as { battleId: string; roundNumber?: number };

    switch (job.name) {
      case "auto-cancel":
        await processAutoCancel(data.battleId);
        break;
      case "auto-start":
        await processAutoStart(data.battleId);
        break;
      case "auto-select":
        await processAutoSelect(data.battleId, data.roundNumber ?? 0);
        break;
      default:
        console.warn(`[battle-worker] Unknown job: ${job.name}`);
    }
  });

  worker.on("failed", (job, err) => {
    console.error(`[battle-worker] Job ${job?.name} (${job?.id}) failed:`, err);
  });

  console.log("[battle-worker] Started");
  return worker;
}
