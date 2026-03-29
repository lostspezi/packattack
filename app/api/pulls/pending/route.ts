import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import PackPull from "@/models/pack-pull";
import Box from "@/models/box";
import Card from "@/models/card";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    // Find any pending pulls for this user
    const anyPending = await PackPull.findOne({ userId, status: "pending" })
      .sort({ createdAt: -1 })
      .lean();

    if (!anyPending) {
      return NextResponse.json({ pending: false });
    }

    const packGroupId = anyPending.packGroupId;

    // Load ALL pulls for this session (including already decided ones)
    const allPulls = await PackPull.find({ packGroupId, userId })
      .sort({ cardIndex: 1 })
      .lean();

    // Load box and card details
    const boxId = anyPending.boxId;
    const box = await Box.findById(boxId).select("name slug").lean();
    const cardIds = [...new Set(allPulls.map((p) => p.cardId.toString()))];
    const cardDocs = await Card.find({ _id: { $in: cardIds } })
      .select("name image")
      .lean();
    const cardMap = new Map(cardDocs.map((c) => [c._id.toString(), c]));

    const pendingCount = allPulls.filter((p) => p.status === "pending").length;
    const decidedCount = allPulls.length - pendingCount;

    return NextResponse.json({
      pending: true,
      packGroupId,
      boxId: boxId.toString(),
      boxSlug: box?.slug ?? boxId.toString(),
      boxName: box?.name ?? { de: "Box", en: "Box" },
      packCount: Math.max(...allPulls.map((p) => p.packIndex)) + 1,
      totalCards: allPulls.length,
      pendingCount,
      decidedCount,
      cards: allPulls.map((p) => {
        const card = cardMap.get(p.cardId.toString());
        return {
          cardId: p.cardId.toString(),
          name: card?.name ?? "Unknown",
          rarity: p.rarity,
          coinValue: p.coinValue,
          conversionValue: p.conversionValue,
          image: card?.image ?? null,
          packIndex: p.packIndex,
          cardIndex: p.cardIndex,
          status: p.status,
        };
      }),
    });
  } catch (err) {
    console.error("[pulls/pending GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
