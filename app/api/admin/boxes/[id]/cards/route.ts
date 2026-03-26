import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Box from "@/models/box";
import Card from "@/models/card";
import { getCard as fetchJustTCGCard } from "@/lib/justtcg";
import type { JustTCGCard } from "@/lib/justtcg";

// Extract the best market price from card variants (Near Mint preferred, in USD cents → dollars)
function extractMarketPrice(card: JustTCGCard): number | null {
  if (!card.variants || card.variants.length === 0) return null;
  // Prefer Near Mint, then any condition
  const nearMint = card.variants.find((v) => v.condition === "Near Mint");
  const best = nearMint ?? card.variants[0];
  if (!best || !best.price) return null;
  // Price from API is in cents (e.g. 49499 = $494.99)
  return best.price / 100;
}

function calcDrawChance(
  rarity: string,
  rarityWeights: Array<{ rarity: string; weight: number }>,
  cardsByRarity: Map<string, number>
): number {
  const weightEntry = rarityWeights.find((rw) => rw.rarity === rarity);
  if (!weightEntry) return 0;
  const count = cardsByRarity.get(rarity) ?? 0;
  if (count === 0) return 0;
  return weightEntry.weight / count;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const box = await Box.findById(id).lean();
    if (!box) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    const cards = await Card.find({ _id: { $in: box.cards } }).lean();

    // Build rarity count map
    const cardsByRarity = new Map<string, number>();
    for (const card of cards) {
      cardsByRarity.set(card.rarity, (cardsByRarity.get(card.rarity) ?? 0) + 1);
    }

    const cardsWithChance = cards.map((card) => ({
      ...card,
      _id: card._id.toString(),
      drawChance: calcDrawChance(card.rarity, box.rarityWeights, cardsByRarity),
    }));

    return NextResponse.json({ cards: cardsWithChance });
  } catch (err) {
    console.error("[admin/boxes/[id]/cards GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { justTcgId, internalPrice } = body as {
    justTcgId?: string;
    internalPrice?: number;
  };

  if (!justTcgId) {
    return NextResponse.json(
      { error: "justTcgId is required" },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    const box = await Box.findById(id);
    if (!box) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    // Find or create card
    let card = await Card.findOne({ justTcgId });

    if (!card) {
      // Fetch from JustTCG
      const tcgData = await fetchJustTCGCard(justTcgId, box.game);
      if (!tcgData) {
        return NextResponse.json(
          { error: "Card not found in JustTCG" },
          { status: 404 }
        );
      }

      card = await Card.create({
        justTcgId: tcgData.id,
        name: tcgData.name,
        game: tcgData.game,
        set: tcgData.set,
        setName: tcgData.setName,
        rarity: tcgData.rarity,
        image: tcgData.image ?? (tcgData.tcgplayerId ? `https://tcgplayer-cdn.tcgplayer.com/product/${tcgData.tcgplayerId}_200w.jpg` : null),
        tcgplayerId: tcgData.tcgplayerId ?? null,
        marketPrice: extractMarketPrice(tcgData),
        internalPrice: internalPrice ?? null,
        lastPriceUpdate: tcgData.marketPrice !== null ? new Date() : null,
        variants: tcgData.variants ?? [],
      });
    } else {
      if (internalPrice !== undefined) {
        card.internalPrice = internalPrice;
        await card.save();
      }
    }

    const cardObjectId = card._id as Types.ObjectId;

    // Prevent duplicates
    const alreadyInBox = box.cards.some(
      (c) => c.toString() === cardObjectId.toString()
    );

    if (!alreadyInBox) {
      box.cards.push(cardObjectId);
      await box.save();
    }

    return NextResponse.json(card.toObject(), { status: 201 });
  } catch (err) {
    console.error("[admin/boxes/[id]/cards POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { cardId } = body as { cardId?: string };

  if (!cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }

  try {
    await connectDB();

    const box = await Box.findById(id);
    if (!box) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    const beforeLength = box.cards.length;
    box.cards = box.cards.filter((c) => c.toString() !== cardId);

    if (box.cards.length === beforeLength) {
      return NextResponse.json(
        { error: "Card not found in box" },
        { status: 404 }
      );
    }

    await box.save();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/boxes/[id]/cards DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
