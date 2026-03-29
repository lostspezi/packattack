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
import { runSubstitutions } from "@/lib/substitution";

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

    // 1. Load box (support slug or ObjectId)
    const isObjectId = /^[a-f\d]{24}$/i.test(boxId);
    const box = isObjectId
      ? await Box.findById(boxId)
      : await Box.findOne({ slug: boxId });
    if (!box || box.status !== "published") {
      return NextResponse.json({ error: "Box not found or not published" }, { status: 404 });
    }

    const realBoxId = box._id;
    const totalCost = box.priceInCoins * packCount;

    // 2. Check for existing pending session — block before deducting coins
    const existingPending = await PackPull.findOne({ userId, status: "pending" }).lean();
    if (existingPending) {
      return NextResponse.json(
        { error: "pending_session", message: "Du hast noch offene Karten aus einem vorherigen Opening." },
        { status: 409 }
      );
    }

    // 3. Check user coins (atomic: only deduct if sufficient)
    const user = await User.findOneAndUpdate(
      { _id: userId, coins: { $gte: totalCost } },
      { $inc: { coins: -totalCost } },
      { returnDocument: "after" }
    );

    if (!user) {
      return NextResponse.json({ error: "Insufficient coins" }, { status: 400 });
    }

    // 4. Build card pool from box
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

    // 5. Draw cards
    const result = drawPacks(
      packCards,
      box.cardsPerPack,
      packCount,
      box.priceInCoins,
    );

    if (result.drawnCards.length === 0) {
      // Refund coins — couldn't draw
      await User.findByIdAndUpdate(userId, { $inc: { coins: totalCost } });
      return NextResponse.json({ error: "Could not draw cards" }, { status: 400 });
    }

    // 7. Get IP and User Agent
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";
    const ua = req.headers.get("user-agent") ?? "unknown";

    // 6. Create PackPull records with status "pending" — crash-safe
    const packGroupId = randomUUID();
    const pullDocs = result.drawnCards.map((d, i) => ({
      userId,
      boxId: realBoxId,
      cardId: d.cardId,
      rarity: d.rarity,
      coinValue: d.coinValue,
      conversionValue: d.conversionValue,
      status: "pending" as const,
      decidedAt: null,
      packGroupId,
      packIndex: d.packIndex,
      cardIndex: i,
      ipAddress: ip,
      userAgent: ua,
    }));
    await PackPull.insertMany(pullDocs);

    // 8. Atomically reduce stock per drawn card (race-condition safe)
    const stockUpdates: Record<string, number> = {};
    for (const d of result.drawnCards) {
      stockUpdates[d.cardId] = (stockUpdates[d.cardId] ?? 0) + 1;
    }

    let failedDecrements = 0;
    for (const [cardId, count] of Object.entries(stockUpdates)) {
      const cardObjectId = new (await import("mongoose")).Types.ObjectId(cardId);
      // Decrement one at a time with atomic $gte guard
      for (let i = 0; i < count; i++) {
        const res = await Box.updateOne(
          { _id: realBoxId, "cards.card": cardObjectId, "cards.stock": { $gte: 1 } },
          { $inc: { "cards.$.stock": -1 } }
        );
        if (res.modifiedCount === 0) failedDecrements++;
      }
    }

    // Atomically increment packsOpened
    await Box.updateOne({ _id: realBoxId }, { $inc: { packsOpened: packCount } });

    // Reload box for stock alerts (need current state)
    const updatedBox = await Box.findById(realBoxId);

    // 9. Record coin transaction
    await CoinTransaction.create({
      userId,
      amount: -totalCost,
      type: "pack_purchase",
      relatedBoxId: realBoxId,
    });

    // 10. Check for low-stock / out-of-stock notifications (only for drawn cards)
    if (updatedBox) void sendStockAlerts(updatedBox, cardMap, stockUpdates);

    // 11. Substitute depleted cards from global inventory
    const depletedCards: Record<string, number> = {};
    if (updatedBox) {
      for (const [cardId, drawnCount] of Object.entries(stockUpdates)) {
        const entry = updatedBox.cards.find((c) => c.card.toString() === cardId);
        if (entry && (entry.stock ?? 0) === 0) {
          depletedCards[cardId] = drawnCount;
        }
      }
    }
    if (Object.keys(depletedCards).length > 0) {
      void runSubstitutions({ boxId: realBoxId.toString(), depletedCards });
    }

    // 12. Response
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
