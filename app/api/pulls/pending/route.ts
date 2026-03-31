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

    const isBattle = !!anyPending.battleId;

    // For battle pulls: load ALL pulls for this battle+user (across all rounds)
    // For pack pulls: load by packGroupId (single opening session)
    const allPulls = isBattle
      ? await PackPull.find({ battleId: anyPending.battleId, userId })
          .sort({ createdAt: 1, cardIndex: 1 })
          .lean()
      : await PackPull.find({ packGroupId: anyPending.packGroupId, userId })
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

    // Collect all packGroupIds for battle pulls (needed for decide endpoint)
    const packGroupIds = [...new Set(allPulls.map((p) => p.packGroupId))];

    return NextResponse.json({
      pending: true,
      packGroupId: anyPending.packGroupId,
      packGroupIds: isBattle ? packGroupIds : [anyPending.packGroupId],
      boxId: boxId.toString(),
      boxSlug: box?.slug ?? boxId.toString(),
      boxName: box?.name ?? { de: "Box", en: "Box" },
      packCount: isBattle ? allPulls.length : Math.max(...allPulls.map((p) => p.packIndex)) + 1,
      totalCards: allPulls.length,
      pendingCount,
      decidedCount,
      expiresAt: expiresAt?.toISOString() ?? null,
      battleId: anyPending.battleId?.toString() ?? null,
      cards: allPulls.map((p, i) => {
        const card = cardMap.get(p.cardId.toString());
        return {
          pullId: p._id.toString(),
          cardId: p.cardId.toString(),
          name: card?.name ?? "Unknown",
          rarity: p.rarity,
          coinValue: p.coinValue,
          conversionValue: p.conversionValue,
          image: card?.image ?? null,
          packGroupId: p.packGroupId,
          packIndex: p.packIndex,
          cardIndex: isBattle ? i : p.cardIndex,
          status: p.status,
        };
      }),
    });
  } catch (err) {
    console.error("[pulls/pending GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
