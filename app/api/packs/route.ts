import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Box from "@/models/box";


export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const boxes = await Box.find({ status: "published" })
      .select("_id slug name description game image priceInCoins cardsPerPack totalPacks packsOpened cards rarityWeights battleFeePerRound")
      .populate("cards.card", "image marketPrice internalPrice variants name")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      boxes: boxes.map((b) => {
        // Count available cards (stock > 0)
        interface PopulatedCard { image?: string; name?: string; marketPrice?: number; internalPrice?: number; variants?: Array<{ price: number }> }
        const cardEntries = (b.cards ?? []) as Array<{ stock?: number; rarity?: string; card?: PopulatedCard }>;
        const availableCards = cardEntries.filter((c) => (c.stock ?? 0) > 0).length;

        // Rarity summary (names only, no exact percentages for users)
        const rarities = [...new Set(cardEntries.map((c) => c.rarity).filter(Boolean))];

        const getCardPrice = (c: PopulatedCard) =>
          c.internalPrice ?? c.marketPrice ?? Math.max(0, ...(c.variants?.map((v) => v.price) || [0]));

        // Extract top 3 cards with images for preview, sorted by value
        const validCards = cardEntries
          .map((c) => c.card)
          .filter((c): c is PopulatedCard => !!c && !!c.image);

        // Sort by price (internalPrice > marketPrice > variants max price)
        validCards.sort((a, b) => getCardPrice(b) - getCardPrice(a));

        // Take top 3
        const previewCards = validCards.slice(0, 3).map((c) => ({
          image: c.image,
          name: c.name,
          price: getCardPrice(c),
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
          battleFeePerRound: b.battleFeePerRound ?? 0,
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
