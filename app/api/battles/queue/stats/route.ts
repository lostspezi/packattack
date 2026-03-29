import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import BattleQueue from "@/models/battle-queue";
import Box from "@/models/box";

export async function GET() {
  try {
    await connectDB();

    const pipeline = [
      { $match: { status: "waiting" } },
      {
        $group: {
          _id: { box: "$box", playerCount: "$playerCount" },
          count: { $sum: 1 },
        },
      },
    ];

    const results = await BattleQueue.aggregate(pipeline);

    const boxIds = [...new Set(results.map((r) => r._id.box.toString()))];
    const boxes = await Box.find({ _id: { $in: boxIds } })
      .select("name slug image")
      .lean();
    const boxMap = new Map(boxes.map((b) => [b._id.toString(), b]));

    const statsMap = new Map<string, { boxId: string; boxName: Record<string, string>; boxImage?: string | null; boxSlug: string; counts: Record<string, number> }>();

    for (const r of results) {
      const boxId = r._id.box.toString();
      const box = boxMap.get(boxId);
      if (!box) continue;

      if (!statsMap.has(boxId)) {
        statsMap.set(boxId, {
          boxId,
          boxName: box.name,
          boxImage: box.image,
          boxSlug: box.slug,
          counts: { "2": 0, "3": 0, "4": 0 },
        });
      }

      statsMap.get(boxId)!.counts[String(r._id.playerCount)] = r.count;
    }

    return NextResponse.json({ stats: Array.from(statsMap.values()) });
  } catch (err) {
    console.error("[queue/stats GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
