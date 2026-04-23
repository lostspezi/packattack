import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import { publishBattleEvent, withBattleLock } from "@/lib/battle-events";
import { resolveRound } from "@/lib/battle-flow";

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

      hand.selectedCardIndex = cardIndex;
      hand.selectedAt = new Date();

      const allSelected = currentRound.hands.every((h) => h.selectedCardIndex !== null);

      if (allSelected) {
        // resolveRound persists the battle and fires all follow-up events.
        await resolveRound(battle, id);
      } else {
        // Minimal, surgical update — avoids serializing the whole battle doc
        // (which carries all rounds × hands × 5 cards each) for a single
        // index assignment.
        await Battle.updateOne(
          { _id: battle._id, "rounds.roundNumber": currentRound.roundNumber },
          {
            $set: {
              "rounds.$.hands.$[h].selectedCardIndex": cardIndex,
              "rounds.$.hands.$[h].selectedAt": hand.selectedAt,
            },
          },
          { arrayFilters: [{ "h.player": new mongoose.Types.ObjectId(session.user!.id) }] },
        );
      }

      // player_selected only goes out AFTER the DB write so any refetching
      // client observes the updated hand.
      await publishBattleEvent(id, "player_selected", {
        player: session.user.id,
      });

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
