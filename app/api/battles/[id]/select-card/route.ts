import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Battle from "@/models/battle";
import connectDB from "@/lib/db";
import { storeSelection, getSelectedCardIndex, allPlayersSelected } from "@/lib/battle-selection";
import { HAND_SIZE } from "@/lib/battle-constants";
import { getRedis } from "@/lib/redis";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { roundIndex, cardIndex } = await req.json();

  if (typeof roundIndex !== "number" || typeof cardIndex !== "number") {
    return NextResponse.json({ error: "roundIndex and cardIndex are required" }, { status: 400 });
  }

  if (cardIndex < 0 || cardIndex >= HAND_SIZE) {
    return NextResponse.json({ error: `cardIndex must be 0-${HAND_SIZE - 1}` }, { status: 400 });
  }

  await connectDB();
  const battle = await Battle.findById(id);

  if (!battle) {
    return NextResponse.json({ error: "Battle not found" }, { status: 404 });
  }

  if (battle.status !== "clash") {
    return NextResponse.json({ error: "Battle is not in clash phase" }, { status: 400 });
  }

  if (roundIndex !== battle.currentRound) {
    return NextResponse.json({ error: "Wrong round" }, { status: 400 });
  }

  const userId = session.user.id;
  const playerIndex = battle.players.findIndex(
    (p: { user: { toString(): string } }) => p.user.toString() === userId
  );
  if (playerIndex === -1) {
    return NextResponse.json({ error: "Not a player in this battle" }, { status: 403 });
  }

  // Check if already selected this round
  const existing = await getSelectedCardIndex(id, roundIndex, userId);
  if (existing !== null) {
    return NextResponse.json({ error: "Already selected a card this round" }, { status: 400 });
  }

  // Validate the round has hands data and this player has a hand
  const round = battle.rounds[roundIndex];
  if (!round?.hands) {
    return NextResponse.json({ error: "Hand not dealt yet" }, { status: 400 });
  }
  const hand = round.hands.find(
    (h: { player: { toString(): string } }) => h.player.toString() === userId
  );
  if (!hand) {
    return NextResponse.json({ error: "No hand found for player" }, { status: 400 });
  }

  // Store selection in Redis
  await storeSelection(id, roundIndex, userId, cardIndex);

  // Update hand in DB
  const handIndex = round.hands.findIndex(
    (h: { player: { toString(): string } }) => h.player.toString() === userId
  );
  await Battle.updateOne(
    { _id: id },
    { $set: { [`rounds.${roundIndex}.hands.${handIndex}.selectedIndex`]: cardIndex } }
  );

  // Publish that this player has selected (no card details!)
  const redis = getRedis();
  const event = JSON.stringify({ type: "player_selected", userId, roundIndex });
  await redis.publish(`battle:${id}`, event);

  // Check if all players have now selected
  const playerIds = battle.players.map((p: { user: { toString(): string } }) => p.user.toString());
  const allDone = await allPlayersSelected(id, roundIndex, playerIds);

  return NextResponse.json({ selected: true, allSelected: allDone });
}
