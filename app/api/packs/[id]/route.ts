import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Box from "@/models/box";
import Card from "@/models/card";
import PackPull from "@/models/pack-pull";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const isObjectId = /^[a-f\d]{24}$/i.test(id);
    const box = isObjectId
      ? await Box.findById(id).lean()
      : await Box.findOne({ slug: id }).lean();
    if (!box || box.status !== "published") {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    const boxId = box._id.toString();
    const cardEntries = (box.cards ?? []) as Array<{
      card: { toString(): string };
      stock?: number;
      rarity?: string;
      weight?: number;
    }>;

    // Load card documents for images/names
    const cardIds = cardEntries.map((c) => c.card.toString());
    const cardDocs = await Card.find({ _id: { $in: cardIds } })
      .select("name image rarity setName tcgplayerId marketPrice internalPrice")
      .lean();
    const cardMap = new Map(cardDocs.map((c) => [c._id.toString(), c]));

    const totalWeight = cardEntries.reduce((a, c) => a + (c.weight ?? 0), 0);

    // Build card pool with details
    const cardPool = cardEntries.map((entry) => {
      const doc = cardMap.get(entry.card.toString());
      const weight = entry.weight ?? 0;
      const chance = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
      return {
        cardId: entry.card.toString(),
        name: doc?.name ?? "Unknown",
        image: doc?.image ?? null,
        rarity: entry.rarity ?? doc?.rarity ?? "",
        setName: doc?.setName ?? "",
        coinValue: Math.max(1, Math.floor(doc?.internalPrice ?? 1)),
        marketPrice: doc?.marketPrice ?? null,
        chance,
        stock: entry.stock ?? 0,
      };
    }).sort((a, b) => b.chance - a.chance); // Most likely first

    // Top 3 hits (by coin value)
    const topHits = [...cardPool]
      .sort((a, b) => b.coinValue - a.coinValue)
      .slice(0, 5);

    // Rarity breakdown
    const rarityBreakdown: Record<string, number> = {};
    for (const c of cardEntries) {
      if (!c.rarity) continue;
      rarityBreakdown[c.rarity] = (rarityBreakdown[c.rarity] ?? 0) + (c.weight ?? 0);
    }
    const rarityInfo = Object.entries(rarityBreakdown)
      .map(([rarity, weight]) => ({
        rarity,
        percentage: totalWeight > 0 ? (weight / totalWeight) * 100 : 0,
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // User's pull counts per card in this box
    const pullCountsAgg = await PackPull.aggregate([
      { $match: { userId: new (await import("mongoose")).Types.ObjectId(userId), boxId: box._id } },
      { $group: { _id: "$cardId", count: { $sum: 1 } } },
    ]);
    const myPullCounts: Record<string, number> = {};
    for (const pc of pullCountsAgg) {
      myPullCounts[pc._id.toString()] = pc.count as number;
    }

    // User's recent pulls for this box (last 5)
    const myPulls = await PackPull.find({ userId, boxId: box._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("cardId", "name image")
      .lean();

    const recentPulls = myPulls.map((p) => ({
      _id: p._id.toString(),
      card: p.cardId,
      rarity: p.rarity,
      coinValue: p.coinValue,
      conversionValue: p.conversionValue,
      status: p.status,
      createdAt: p.createdAt,
    }));

    // Recent global events for this box (last 10, for initial SSE state)
    const recentEvents = await PackPull.find({ boxId: box._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("userId", "name username image publicProfile")
      .populate("cardId", "name image")
      .lean();

    const liveEvents = recentEvents.map((p) => ({
      user: p.userId,
      card: p.cardId,
      rarity: p.rarity,
      coinValue: p.coinValue,
      status: p.status,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({
      _id: boxId,
      slug: box.slug ?? boxId,
      name: box.name,
      description: box.description,
      game: box.game,
      image: box.image,
      priceInCoins: box.priceInCoins,
      cardsPerPack: box.cardsPerPack,
      totalCards: cardEntries.length,
      availableCards: cardEntries.filter((c) => (c.stock ?? 0) > 0).length,
      packsOpened: box.packsOpened ?? 0,
      rarityInfo,
      coinConversionRate: box.coinConversionRate ?? 50,
      cardPool,
      topHits,
      recentPulls,
      liveEvents,
      myPullCounts,
    });
  } catch (err) {
    console.error("[packs/[id] GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
