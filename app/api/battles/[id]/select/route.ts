import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import Box from "@/models/box";
import User from "@/models/user";
import { evaluateRound, evaluateBattle } from "@/lib/battle-engine";
import { prepareBoxCardsForBattle, drawAndPersistBattleHand, transferCardOwnership, activateBattlePullExpiry, cleanupUnselectedBattlePulls } from "@/lib/battle-cards";
import { distributeByMode } from "@/lib/battle-distribution";
import { calculateEloChanges, type EloPlayer } from "@/lib/battle-elo";
import { publishBattleEvent, withBattleLock } from "@/lib/battle-events";
import { scheduleBattleJob } from "@/lib/battle-jobs";
import type { IVirtualCard } from "@/models/battle";
import PackPull from "@/models/pack-pull";
import mongoose from "mongoose";

const SELECT_DEADLINE_MS = 30 * 1000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const { id } = await params;
    const { cardIndex } = await req.json();

    return await withBattleLock(id, "select", async () => {
      const battle = await Battle.findById(id);
      if (!battle) {
        return NextResponse.json({ error: "battle_not_found" }, { status: 404 });
      }

      if (battle.status !== "active" && battle.status !== "sudden_death") {
        return NextResponse.json({ error: "battle_not_active" }, { status: 400 });
      }

      const currentRound = battle.rounds[battle.rounds.length - 1];
      if (!currentRound || currentRound.status !== "selecting") {
        return NextResponse.json({ error: "not_selecting" }, { status: 400 });
      }

      const hand = currentRound.hands.find(
        (h) => h.player.toString() === session.user!.id,
      );
      if (!hand) {
        return NextResponse.json({ error: "not_in_battle" }, { status: 403 });
      }

      if (hand.selectedCardIndex !== null) {
        return NextResponse.json({ error: "already_selected" }, { status: 400 });
      }

      if (typeof cardIndex !== "number" || cardIndex < 0 || cardIndex >= hand.cards.length) {
        return NextResponse.json({ error: "invalid_card_index" }, { status: 400 });
      }

      // Select the card
      hand.selectedCardIndex = cardIndex;
      hand.selectedAt = new Date();

      // Notify others that this player has selected (without revealing which card)
      await publishBattleEvent(id, "player_selected", {
        player: session.user.id,
      });

      // Check if all players have selected
      const allSelected = currentRound.hands.every((h) => h.selectedCardIndex !== null);

      if (allSelected) {
        await resolveRound(battle, id);
      } else {
        await battle.save();
      }

      return NextResponse.json({ selected: true, allSelected });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "server_error";
    if (message === "Operation in progress, please try again") {
      return NextResponse.json({ error: message }, { status: 429 });
    }
    console.error("[battles/[id]/select] POST error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// ---------- Resolve round and potentially the battle ----------

async function resolveRound(
  battle: InstanceType<typeof Battle>,
  battleId: string,
) {
  const currentRound = battle.rounds[battle.rounds.length - 1];
  currentRound.status = "revealing";
  currentRound.revealedAt = new Date();

  // Build selections for evaluation
  const selections = currentRound.hands.map((h) => ({
    player: h.player,
    card: h.cards[h.selectedCardIndex!] as IVirtualCard,
  }));

  // Evaluate round
  const roundResult = evaluateRound(selections);
  currentRound.winner = roundResult.winner;
  currentRound.status = "completed";

  // Update roundsWon
  if (roundResult.winner) {
    const winnerPlayer = battle.players.find(
      (p) => p.user.toString() === roundResult.winner!.toString(),
    );
    if (winnerPlayer) winnerPlayer.roundsWon++;
  }

  // Publish round result (include scores so the client can update inline)
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
    ? currentRound.roundNumber // Sudden death is 1 round
    : battle.settings.rounds;

  const completedRounds = battle.rounds.filter((r) => r.status === "completed").length;

  if (completedRounds >= maxRounds || battle.status === "sudden_death") {
    // Evaluate battle
    const roundWins = new Map<string, number>();
    for (const p of battle.players) {
      roundWins.set(p.user.toString(), p.roundsWon);
    }

    const battleResult = evaluateBattle(roundWins);

    if (battleResult.needsSuddenDeath && battle.status !== "sudden_death") {
      // Enter sudden death
      battle.status = "sudden_death";
      await startNewRound(battle, battleId);
    } else {
      // Battle finished
      await finishBattle(battle, battleId, battleResult.winner?.toString() ?? null);
    }
  } else {
    // Start next round
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

  const selectDeadline = new Date(Date.now() + SELECT_DEADLINE_MS);
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

  // TODO: re-enable auto-select timer
  // await scheduleBattleJob("auto-select", { battleId, roundNumber: nextRoundNumber }, SELECT_DEADLINE_MS + 2000);
}

async function finishBattle(
  battle: InstanceType<typeof Battle>,
  battleId: string,
  winnerId: string | null,
) {
  battle.status = "finished";

  // Collect all played cards per player + track selected pullIds
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

  // Calculate transfers
  const transfers = winnerId
    ? distributeByMode(battle.settings.mode, winnerId, playerCards)
    : [];

  // Transfer PackPull ownership for redistributed cards
  for (const transfer of transfers) {
    if (transfer.from === transfer.to) continue;
    for (const card of transfer.cards) {
      if (card.pullId) {
        await transferCardOwnership(card.pullId.toString(), transfer.to);
      }
    }
  }

  // Calculate ELO changes
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

  // Update ELO and battle stats in DB
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

    // Update streak
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

  // Save result
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

  await publishBattleEvent(battleId, "battle_end", {
    result: battle.result,
  });
}
