import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Box from "@/models/box";
import Card from "@/models/card";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const boxes = await Box.find({ status: "published" })
      .select("_id slug name description game image priceInCoins cardsPerPack totalPacks packsOpened cards rarityWeights")
      .populate("cards.card", "image marketPrice internalPrice variants name")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      boxes: boxes.map((b) => {
        // Count available cards (stock > 0)
        const cardEntries = (b.cards ?? []) as Array<{ stock?: number; rarity?: string; card?: any }>;
        const availableCards = cardEntries.filter((c) => (c.stock ?? 0) > 0).length;

        // Rarity summary (names only, no exact percentages for users)
        const rarities = [...new Set(cardEntries.map((c) => c.rarity).filter(Boolean))];

        // Extract top 3 cards with images for preview, sorted by value
        const validCards = cardEntries
          .map((c) => c.card)
          .filter((c) => c && c.image);

        // Sort by price (internalPrice > marketPrice > variants max price)
        validCards.sort((a, b) => {
          const priceA = a.internalPrice ?? a.marketPrice ?? Math.max(0, ...(a.variants?.map((v: any) => v.price) || [0]));
          const priceB = b.internalPrice ?? b.marketPrice ?? Math.max(0, ...(b.variants?.map((v: any) => v.price) || [0]));
          return priceB - priceA;
        });

        // Take top 3
        const previewCards = validCards.slice(0, 3).map((c) => ({
          image: c.image,
          name: c.name,
          price: c.internalPrice ?? c.marketPrice ?? Math.max(0, ...(c.variants?.map((v: any) => v.price) || [0])),
        }));

        return {
          _id: b._id.toString(),
          slug: b.slug ?? b._id.toString(),
          name: b.name,
          description: b.description,
          game: b.game,
          image: b.image,
          priceInCoins: b.priceInCoins,
          cardsPerPack: b.cardsPerPack,
          totalCards: cardEntries.length,
          availableCards,
          packsOpened: b.packsOpened ?? 0,
          rarities,
          previewCards,
        };
      }),
    });
  } catch (err) {
    console.error("[packs GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
