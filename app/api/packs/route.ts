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
      .select("_id slug name description game image priceInCoins cardsPerPack totalPacks packsOpened cards rarityWeights")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      boxes: boxes.map((b) => {
        // Count available cards (stock > 0)
        const cardEntries = (b.cards ?? []) as Array<{ stock?: number; rarity?: string }>;
        const availableCards = cardEntries.filter((c) => (c.stock ?? 0) > 0).length;

        // Rarity summary (names only, no exact percentages for users)
        const rarities = [...new Set(cardEntries.map((c) => c.rarity).filter(Boolean))];

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
        };
      }),
    });
  } catch (err) {
    console.error("[packs GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
