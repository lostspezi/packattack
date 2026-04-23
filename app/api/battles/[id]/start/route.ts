import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import Box from "@/models/box";
import { prepareBoxCardsForBattle, drawBattleHandCards } from "@/lib/battle-cards";
import { publishBattleEvent, withBattleLock } from "@/lib/battle-events";
import { scheduleBattleJob, removeBattleJob } from "@/lib/battle-jobs";

const SELECT_DEADLINE_MS = 30 * 1000; // 30 seconds

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const { id } = await params;

    return await withBattleLock(id, "start", async () => {
      const battle = await Battle.findById(id);
      if (!battle) {
        return NextResponse.json({ error: "battle_not_found" }, { status: 404 });
      }

      // Only creator can manually start, and only during countdown
      if (battle.status !== "countdown") {
        return NextResponse.json({ error: "cannot_start" }, { status: 400 });
      }

      if (battle.creator.toString() !== session.user!.id) {
        return NextResponse.json({ error: "only_creator_can_start" }, { status: 403 });
      }

      if (battle.players.length < battle.settings.playerCount) {
        return NextResponse.json({ error: "not_enough_players" }, { status: 400 });
      }

      // Load box with cards for hand generation
      const box = await Box.findById(battle.box)
        .populate("cards.card", "name image rarity internalPrice marketPrice")
        .lean();

      if (!box) {
        return NextResponse.json({ error: "box_not_found" }, { status: 500 });
      }

      const boxCards = prepareBoxCardsForBattle(box);

      // Generate virtual hands for round 1
      battle.status = "active";
      battle.currentRound = 1;

      const selectDeadline = new Date(Date.now() + SELECT_DEADLINE_MS);
      const hands = [];
      for (const p of battle.players) {
        const cards = drawBattleHandCards(boxCards);
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

      // Cancel auto-start job since creator started manually
      await removeBattleJob("auto-start", id);

      // Send round_start to each player via SSE (they'll filter their own hand)
      await publishBattleEvent(id, "battle_start", { isCountdown: false });

      // Send individual hands — SSE handler will filter per user
      for (const hand of hands) {
        await publishBattleEvent(id, "round_start", {
          roundNumber: 1,
          playerId: hand.player.toString(),
          hand: hand.cards,
          selectDeadline: selectDeadline.toISOString(),
        });
      }

      // Schedule auto-select for round 1
      await scheduleBattleJob("auto-select", { battleId: id, roundNumber: 1 }, SELECT_DEADLINE_MS + 2000);

      return NextResponse.json({ started: true, status: battle.status });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "server_error";
    if (message === "Operation in progress, please try again") {
      return NextResponse.json({ error: message }, { status: 429 });
    }
    console.error("[battles/[id]/start] POST error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
