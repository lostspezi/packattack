import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import PackPull from "@/models/pack-pull";
import type { CollectionMeta } from "@/lib/binders/inventory";

interface AggRow {
  _id: string;
  sets: string[];
  rarities: string[];
}

export function buildCollectionMeta(rows: AggRow[]): CollectionMeta {
  const games: string[] = [];
  const setsByGame: Record<string, string[]> = {};
  const raritySet = new Set<string>();
  for (const row of rows) {
    const game = row._id;
    if (!game) continue;
    games.push(game);
    setsByGame[game] = row.sets.filter(Boolean).sort();
    for (const r of row.rarities) if (r) raritySet.add(r);
  }
  games.sort();
  return { games, setsByGame, rarities: [...raritySet].sort() };
}

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await connectDB();
  const userObjId = new Types.ObjectId(userId);
  const rows = (await PackPull.aggregate([
    { $match: { userId: userObjId, binderId: null } },
    {
      $lookup: {
        from: "cards",
        localField: "cardId",
        foreignField: "_id",
        as: "card",
      },
    },
    // Intentionally drops pulls whose cardId has no card document (orphaned pulls).
    { $unwind: "$card" },
    { $project: { _id: 0, "card.game": 1, "card.set": 1, "card.rarity": 1 } },
    {
      $group: {
        _id: "$card.game",
        sets: { $addToSet: "$card.set" },
        rarities: { $addToSet: "$card.rarity" },
      },
    },
  ])) as AggRow[];
  return NextResponse.json(buildCollectionMeta(rows) satisfies CollectionMeta);
}
