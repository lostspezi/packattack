import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import PackPull from "@/models/pack-pull";
import Box from "@/models/box";
import Card from "@/models/card";
import { autoConvertExpiredPulls } from "@/lib/battle-cards";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    // Auto-convert any expired pending pulls first
    await autoConvertExpiredPulls(userId);

    // Find any pending pulls for this user
    // Exclude battle pulls that haven't been activated yet (expiresAt is null
    // while the battle is still in progress — set by activateBattlePullExpiry
    // when the battle finishes)
    const anyPending = await PackPull.findOne({
      userId,
      status: "pending",
      $or: [{ battleId: null }, { expiresAt: { $ne: null } }],
    })
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

    // Find earliest expiresAt among pending pulls
    const pendingPulls = allPulls.filter((p) => p.status === "pending");
    const expiresAt = pendingPulls.reduce<Date | null>((earliest, p) => {
      if (!p.expiresAt) return earliest;
      if (!earliest) return p.expiresAt;
      return p.expiresAt < earliest ? p.expiresAt : earliest;
    }, null);

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
      expiresAt: expiresAt?.toISOString() ?? null,
      battleId: anyPending.battleId?.toString() ?? null,
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
