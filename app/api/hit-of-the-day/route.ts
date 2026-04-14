import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import PackPull from "@/models/pack-pull";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDB();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = await PackPull.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay },
          status: { $in: ["claimed", "converted", "reserved"] },
        },
      },
      { $sort: { coinValue: -1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: "cards",
          localField: "cardId",
          foreignField: "_id",
          as: "card",
        },
      },
      { $unwind: "$card" },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $lookup: {
          from: "boxes",
          localField: "boxId",
          foreignField: "_id",
          as: "box",
        },
      },
      { $unwind: "$box" },
      {
        $project: {
          cardName: "$card.name",
          cardImage: "$card.image",
          rarity: "$card.rarity",
          setName: "$card.setName",
          coinValue: 1,
          marketPrice: "$card.marketPrice",
          username: "$user.username",
          userName: "$user.name",
          userImage: "$user.image",
          userId: "$user._id",
          boxName: "$box.name",
          pulledAt: "$createdAt",
        },
      },
    ]);

    if (!result.length) {
      return NextResponse.json({ hit: null });
    }

    const hit = result[0];
    return NextResponse.json({
      hit: {
        cardName: hit.cardName,
        cardImage: hit.cardImage,
        rarity: hit.rarity,
        setName: hit.setName,
        coinValue: hit.coinValue,
        marketPrice: hit.marketPrice,
        username: hit.username || hit.userName || "Anonymous",
        userImage: hit.userImage,
        userId: String(hit.userId),
        boxName: hit.boxName,
        pulledAt: hit.pulledAt,
      },
    });
  } catch {
    return NextResponse.json({ hit: null }, { status: 500 });
  }
}
