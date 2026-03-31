import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";

// ---------- GET: Battle details (full state for reconnect) ----------

export async function GET(
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

    const isObjectId = /^[a-f\d]{24}$/i.test(id);
    const query = isObjectId ? { $or: [{ _id: id }, { slug: id }] } : { slug: id };
    const battle = await Battle.findOne(query)
      .populate("box", "name slug game image battleFeePerRound cards")
      .populate("creator", "username")
      .populate("players.user", "username elo")
      .lean();

    if (!battle) {
      return NextResponse.json({ error: "battle_not_found" }, { status: 404 });
    }

    const isPlayer = battle.players.some(
      (p) => p.user && (p.user as unknown as { _id?: { toString(): string } })?._id?.toString() === session.user!.id,
    );

    // Hide other players' hands if battle is active and round is selecting
    if (battle.status === "active" || battle.status === "sudden_death") {
      for (const round of battle.rounds) {
        if (round.status === "selecting") {
          for (const hand of round.hands) {
            const handPlayerId = hand.player?.toString();
            if (handPlayerId !== session.user.id) {
              // Hide other players' cards during selection
              hand.cards = hand.cards.map(() => ({
                cardId: null as unknown as typeof hand.cards[0]["cardId"],
                name: "???",
                image: "/images/card-back.jpg",
                rarity: "???",
                coinValue: 0,
              }));
              hand.selectedCardIndex = hand.selectedCardIndex !== null ? -1 : null; // Show they selected but not which
            }
          }
        }
      }
    }

    return NextResponse.json({ battle, isPlayer });
  } catch (err) {
    console.error("[battles/[id]] GET error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
