import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Box from "@/models/box";
import PackPull from "@/models/pack-pull";
import CoinTransaction from "@/models/coin-transaction";

function periodToDate(period: string): Date | null {
  const now = Date.now();
  switch (period) {
    case "24h": return new Date(now - 24 * 60 * 60 * 1000);
    case "7d": return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "30d": return new Date(now - 30 * 24 * 60 * 60 * 1000);
    default: return null; // "all"
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: boxId } = await params;
  const period = req.nextUrl.searchParams.get("period") ?? "all";
  const since = periodToDate(period);

  try {
    await connectDB();

    const box = await Box.findById(boxId).lean();
    if (!box) return NextResponse.json({ error: "Box not found" }, { status: 404 });

    const pullFilter: Record<string, unknown> = { boxId };
    const txFilter: Record<string, unknown> = { relatedBoxId: boxId };
    if (since) {
      pullFilter.createdAt = { $gte: since };
      txFilter.createdAt = { $gte: since };
    }

    // Aggregations in parallel
    const [
      pulls,
      purchaseTx,
      conversionTx,
      uniqueUsers,
      statusCounts,
      dailyPulls,
      topCards,
    ] = await Promise.all([
      PackPull.countDocuments(pullFilter),
      CoinTransaction.aggregate([
        { $match: { ...txFilter, type: "pack_purchase" } },
        { $group: { _id: null, total: { $sum: { $abs: "$amount" } } } },
      ]),
      CoinTransaction.aggregate([
        { $match: { ...txFilter, type: "card_conversion" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      PackPull.distinct("userId", pullFilter),
      PackPull.aggregate([
        { $match: pullFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      // Daily pulls for chart (last 30 days)
      PackPull.aggregate([
        { $match: { boxId, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      // Top claimed cards
      PackPull.aggregate([
        { $match: { ...pullFilter, status: "claimed" } },
        { $group: { _id: "$cardId", count: { $sum: 1 }, rarity: { $first: "$rarity" }, coinValue: { $first: "$coinValue" } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const revenue = purchaseTx[0]?.total ?? 0;
    const payouts = conversionTx[0]?.total ?? 0;
    const margin = revenue - payouts;
    const marginPercent = revenue > 0 ? Math.round((margin / revenue) * 10000) / 100 : 0;
    const cardsPerPack = box.cardsPerPack ?? 1;
    const packsOpened = cardsPerPack > 0 ? Math.floor(pulls / cardsPerPack) : 0;
    const uniqueUserCount = uniqueUsers.length;

    const statusMap: Record<string, number> = {};
    for (const s of statusCounts) statusMap[s._id as string] = s.count as number;
    const claimed = statusMap["claimed"] ?? 0;
    const converted = statusMap["converted"] ?? 0;
    const expired = statusMap["expired"] ?? 0;
    const pending = statusMap["pending"] ?? 0;
    const decided = claimed + converted + expired;
    const claimRate = decided > 0 ? Math.round((claimed / decided) * 10000) / 100 : 0;

    const cardEntries = (box.cards ?? []) as Array<{ stock?: number; minStock?: number }>;
    const outOfStock = cardEntries.filter((c) => (c.stock ?? 0) === 0).length;
    const lowStock = cardEntries.filter((c) => {
      const s = c.stock ?? 0;
      return s > 0 && s <= (c.minStock ?? 5);
    }).length;

    const avgPackValue = packsOpened > 0 ? Math.round((pulls > 0 ? payouts / packsOpened : 0) * 100) / 100 : 0;

    return NextResponse.json({
      period,
      packsOpened,
      totalPulls: pulls,
      revenue,
      payouts,
      margin,
      marginPercent,
      uniqueUsers: uniqueUserCount,
      avgPacksPerUser: uniqueUserCount > 0 ? Math.round((packsOpened / uniqueUserCount) * 100) / 100 : 0,
      claimRate,
      claimed,
      converted,
      expired,
      pending,
      outOfStock,
      lowStock,
      avgPackValue,
      topCards,
      dailyPulls: dailyPulls.map((d) => ({ date: d._id, count: d.count })),
    });
  } catch (err) {
    console.error("[admin/boxes/[id]/stats GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
