import mongoose from "mongoose";
import connectDB from "@/lib/db";
import InventoryItem from "@/models/inventory-item";
import type { IFulfillment } from "@/models/order";

interface CartCardInfo {
  cardId: string;
  rarity: string;
}

export async function assignFulfillments(
  cards: CartCardInfo[]
): Promise<IFulfillment[]> {
  await connectDB();

  const uniqueCardIds = [...new Set(cards.map((c) => c.cardId))];
  const inventoryItems = await InventoryItem.find({
    card: { $in: uniqueCardIds.map((id) => new mongoose.Types.ObjectId(id)) },
    stock: { $gte: 1 },
  }).lean();

  const cardToShops = new Map<string, Set<string>>();
  for (const item of inventoryItems) {
    const cardKey = item.card.toString();
    if (!cardToShops.has(cardKey)) {
      cardToShops.set(cardKey, new Set());
    }
    cardToShops.get(cardKey)!.add(item.shop.toString());
  }

  const uncovered = new Set(cards.map((_, i) => i));
  const fulfillmentMap = new Map<string | null, number[]>();

  while (uncovered.size > 0) {
    let bestShop: string | null = null;
    let bestCoverage: number[] = [];

    const shopCoverage = new Map<string, number[]>();
    for (const idx of uncovered) {
      const cardId = cards[idx].cardId;
      const shops = cardToShops.get(cardId);
      if (!shops) continue;
      for (const shopId of shops) {
        if (!shopCoverage.has(shopId)) {
          shopCoverage.set(shopId, []);
        }
        shopCoverage.get(shopId)!.push(idx);
      }
    }

    for (const [shopId, covered] of shopCoverage) {
      if (covered.length > bestCoverage.length) {
        bestShop = shopId;
        bestCoverage = covered;
      }
    }

    if (bestShop === null || bestCoverage.length === 0) break;

    fulfillmentMap.set(bestShop, bestCoverage);
    for (const idx of bestCoverage) {
      uncovered.delete(idx);
    }
  }

  if (uncovered.size > 0) {
    fulfillmentMap.set(null, [...uncovered]);
  }

  const fulfillments: IFulfillment[] = [];
  for (const [shopId, indices] of fulfillmentMap) {
    fulfillments.push({
      shopId: shopId ? new mongoose.Types.ObjectId(shopId) : null,
      items: indices.map((i) => ({
        cardId: new mongoose.Types.ObjectId(cards[i].cardId),
        rarity: cards[i].rarity,
      })),
      status: "pending",
      trackingNumber: null,
      shippedAt: null,
    });
  }

  return fulfillments;
}

export async function decrementShopStock(
  fulfillments: IFulfillment[]
): Promise<void> {
  for (const f of fulfillments) {
    if (!f.shopId) continue;
    for (const item of f.items) {
      await InventoryItem.updateOne(
        { shop: f.shopId, card: item.cardId, stock: { $gte: 1 } },
        { $inc: { stock: -1 } }
      );
    }
  }
}
