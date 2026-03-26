import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Box from "@/models/box";
import Card from "@/models/card";
import User from "@/models/user";
import PackPull from "@/models/pack-pull";
import CoinTransaction from "@/models/coin-transaction";
import Notification from "@/models/notification";
import { drawPacks, type PackCard } from "@/lib/pack-engine";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boxId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { packCount } = body as { packCount?: number };

  if (!packCount || !Number.isInteger(packCount) || packCount < 1 || packCount > 10) {
    return NextResponse.json({ error: "packCount must be 1-10" }, { status: 400 });
  }

  try {
    await connectDB();

    // 1. Load box
    const box = await Box.findById(boxId);
    if (!box || box.status !== "published") {
      return NextResponse.json({ error: "Box not found or not published" }, { status: 404 });
    }

    const totalCost = box.priceInCoins * packCount;

    // 2. Check user coins (atomic: only deduct if sufficient)
    const user = await User.findOneAndUpdate(
      { _id: userId, coins: { $gte: totalCost } },
      { $inc: { coins: -totalCost } },
      { returnDocument: "after" }
    );

    if (!user) {
      return NextResponse.json({ error: "Insufficient coins" }, { status: 400 });
    }

    // 3. Build card pool from box
    const cardEntries = box.cards as Array<{
      card: { toString(): string };
      weight: number;
      rarity: string;
      stock: number;
      minStock: number;
    }>;

    const cardIds = cardEntries.map((e) => e.card.toString());
    const cardDocs = await Card.find({ _id: { $in: cardIds } }).lean();
    const cardMap = new Map(cardDocs.map((c) => [c._id.toString(), c]));

    const packCards: PackCard[] = cardEntries
      .filter((e) => (e.stock ?? 0) > 0)
      .map((e) => {
        const doc = cardMap.get(e.card.toString());
        return {
          cardId: e.card.toString(),
          name: doc?.name ?? "Unknown",
          rarity: e.rarity,
          weight: e.weight,
          stock: e.stock,
          coinValue: Math.max(1, Math.floor(doc?.internalPrice ?? 1)),
          image: doc?.image ?? null,
        };
      });

    if (packCards.length === 0) {
      // Refund coins — no cards available
      await User.findByIdAndUpdate(userId, { $inc: { coins: totalCost } });
      return NextResponse.json({ error: "No available cards in this box" }, { status: 400 });
    }

    // 4. Draw cards
    const result = drawPacks(
      packCards,
      box.cardsPerPack,
      packCount,
      box.priceInCoins,
      box.coinConversionRate ?? 50
    );

    if (result.drawnCards.length === 0) {
      // Refund coins — couldn't draw
      await User.findByIdAndUpdate(userId, { $inc: { coins: totalCost } });
      return NextResponse.json({ error: "Could not draw cards" }, { status: 400 });
    }

    // 5. Get IP and User Agent
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";
    const ua = req.headers.get("user-agent") ?? "unknown";

    // 6. Create PackPulls and update stock
    const packGroupId = randomUUID();
    // Store drawn cards temporarily — actual PackPull records created on each decision
    // We pass packGroupId + card info to frontend, decisions come back via /api/pulls/decide

    // 7. Update box: packsOpened + reduce stock per drawn card
    const stockUpdates: Record<string, number> = {};
    for (const d of result.drawnCards) {
      stockUpdates[d.cardId] = (stockUpdates[d.cardId] ?? 0) + 1;
    }

    for (const [cardId, count] of Object.entries(stockUpdates)) {
      const cardIdx = box.cards.findIndex((c) => c.card.toString() === cardId);
      if (cardIdx !== -1) {
        box.cards[cardIdx].stock = Math.max(0, (box.cards[cardIdx].stock ?? 0) - count);
      }
    }
    box.packsOpened = (box.packsOpened ?? 0) + packCount;
    await box.save();

    // 8. Record coin transaction
    await CoinTransaction.create({
      userId,
      amount: -totalCost,
      type: "pack_purchase",
      relatedBoxId: boxId,
    });

    // 9. Check for low-stock / out-of-stock notifications (only for drawn cards)
    void sendStockAlerts(box, cardMap, stockUpdates);

    // 10. Response
    return NextResponse.json({
      packGroupId,
      packCount,
      totalCost,
      newBalance: user.coins,
      cards: result.drawnCards,
    });
  } catch (err) {
    console.error("[packs/[id]/open POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/**
 * Send notifications only for cards that were drawn AND just crossed a threshold.
 * stockUpdates: { cardId: drawCount } — only cards affected by this opening.
 */
async function sendStockAlerts(
  box: InstanceType<typeof Box>,
  cardMap: Map<string, { name?: string }>,
  stockUpdates: Record<string, number>
) {
  try {
    const admins = await User.find({ role: { $in: ["admin", "super_admin"] } }).select("_id").lean();
    if (admins.length === 0) return;
    const adminIds = admins.map((a) => a._id.toString());
    const boxName = box.name?.de ?? box.name?.en ?? "Box";

    for (const [cardId, drawnCount] of Object.entries(stockUpdates)) {
      const entry = box.cards.find((c) => c.card.toString() === cardId);
      if (!entry) continue;

      const stockNow = entry.stock ?? 0;
      const stockBefore = stockNow + drawnCount; // what it was before this opening
      const minStock = entry.minStock ?? 5;
      const cardName = cardMap.get(cardId)?.name ?? "Unknown";

      // Only notify if threshold was JUST crossed (was above, now at or below)
      if (stockNow === 0 && stockBefore > 0) {
        for (const adminId of adminIds) {
          await Notification.create({
            userId: adminId,
            title: `Ausverkauft: ${cardName}`,
            message: `${cardName} in "${boxName}" hat Bestand 0 und wird nicht mehr gezogen.`,
            type: "error",
            cta: { label: "Box öffnen", url: `/de/admin/boxes/${box._id}` },
          });
        }
      } else if (stockNow <= minStock && stockBefore > minStock) {
        for (const adminId of adminIds) {
          await Notification.create({
            userId: adminId,
            title: `Niedriger Bestand: ${cardName}`,
            message: `${cardName} in "${boxName}" hat nur noch ${stockNow} Stück (Mindestbestand: ${minStock}).`,
            type: "warning",
            cta: { label: "Box öffnen", url: `/de/admin/boxes/${box._id}` },
          });
        }
      }
    }
  } catch (err) {
    console.error("[stockAlerts]", err);
  }
}
