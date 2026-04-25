import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Card from "@/models/card";

interface SetRow {
  _id: { game: string; set: string; setName: string };
  count: number;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await connectDB();

  const rows = (await Card.aggregate([
    {
      $group: {
        _id: { game: "$game", set: "$set", setName: "$setName" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.game": 1, "_id.setName": 1 } },
  ])) as SetRow[];

  const byGame = new Map<
    string,
    Array<{ set: string; setName: string; cardCount: number }>
  >();
  for (const row of rows) {
    const list = byGame.get(row._id.game) ?? [];
    list.push({
      set: row._id.set,
      setName: row._id.setName,
      cardCount: row.count,
    });
    byGame.set(row._id.game, list);
  }

  const games = Array.from(byGame.entries()).map(([game, sets]) => ({
    game,
    sets,
  }));

  return NextResponse.json({ games });
}
