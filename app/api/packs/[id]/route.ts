import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Box from "@/models/box";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const box = await Box.findById(id).lean();
    if (!box || box.status !== "published") {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    const cardEntries = (box.cards ?? []) as Array<{ stock?: number; rarity?: string; weight?: number }>;
    const availableCards = cardEntries.filter((c) => (c.stock ?? 0) > 0).length;
    const rarities = [...new Set(cardEntries.map((c) => c.rarity).filter(Boolean))];

    // Rarity breakdown (approximate percentages for users)
    const totalWeight = cardEntries.reduce((a, c) => a + (c.weight ?? 0), 0);
    const rarityBreakdown: Record<string, number> = {};
    for (const c of cardEntries) {
      if (!c.rarity) continue;
      rarityBreakdown[c.rarity] = (rarityBreakdown[c.rarity] ?? 0) + (c.weight ?? 0);
    }
    const rarityInfo = Object.entries(rarityBreakdown).map(([rarity, weight]) => ({
      rarity,
      percentage: totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0,
    }));

    return NextResponse.json({
      _id: box._id.toString(),
      name: box.name,
      description: box.description,
      game: box.game,
      image: box.image,
      priceInCoins: box.priceInCoins,
      cardsPerPack: box.cardsPerPack,
      totalCards: cardEntries.length,
      availableCards,
      packsOpened: box.packsOpened ?? 0,
      rarities,
      rarityInfo,
      coinConversionRate: box.coinConversionRate ?? 50,
    });
  } catch (err) {
    console.error("[packs/[id] GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
