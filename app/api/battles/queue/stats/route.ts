import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import BattleQueue from "@/models/battle-queue";
import Box from "@/models/box";

export async function GET() {
  try {
    await connectDB();

    // Fetch all published boxes
    const boxes = await Box.find({ status: "published" })
      .select("name slug image")
      .sort({ createdAt: -1 })
      .lean();

    // Fetch queue counts
    const queueResults = await BattleQueue.aggregate([
      { $match: { status: "waiting" } },
      {
        $group: {
          _id: { box: "$box", playerCount: "$playerCount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Build counts map: boxId -> { "2": N, "3": N, "4": N }
    const countsMap = new Map<string, Record<string, number>>();
    for (const r of queueResults) {
      const boxId = r._id.box.toString();
      if (!countsMap.has(boxId)) countsMap.set(boxId, { "2": 0, "3": 0, "4": 0 });
      countsMap.get(boxId)![String(r._id.playerCount)] = r.count;
    }

    // Build stats for all boxes
    const stats = boxes.map((box) => {
      const boxId = box._id.toString();
      return {
        boxId,
        boxName: box.name,
        boxImage: box.image,
        boxSlug: box.slug,
        counts: countsMap.get(boxId) ?? { "2": 0, "3": 0, "4": 0 },
      };
    });

    return NextResponse.json({ stats });
  } catch (err) {
    console.error("[queue/stats GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
