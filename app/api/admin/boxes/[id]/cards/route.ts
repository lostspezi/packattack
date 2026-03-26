import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Box from "@/models/box";
import Card from "@/models/card";
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

    const cardsWithChance = cards.map((card) => {
      // Extract price change from Near Mint variant (or first available)
      const variants = (card.variants ?? []) as Array<Record<string, unknown>>;
      const nearMint = variants.find((v) => v.condition === "Near Mint");
      const primaryVariant = nearMint ?? variants[0];
      const priceChange7d = (primaryVariant?.priceChange7d as number | null) ?? null;
      const priceChange30d = (primaryVariant?.priceChange30d as number | null) ?? null;

      return {
        ...card,
        _id: card._id.toString(),
        drawChance: calcDrawChance(card.rarity, box.rarityWeights, cardsByRarity),
        priceChange7d,
        priceChange30d,
      };
    });

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

  const { justTcgId, name, game: cardGame, set: cardSet, setName, rarity, tcgplayerId, variants, internalPrice } = body as {
    justTcgId?: string;
    name?: string;
    game?: string;
    set?: string;
    setName?: string;
    rarity?: string;
    tcgplayerId?: string | null;
    variants?: Array<{ condition: string; printing: string; price: number }>;
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

    // Find or create card — use data sent from client (from search results)
    let card = await Card.findOne({ justTcgId });

    if (!card) {
      const imageUrl = tcgplayerId
        ? `https://tcgplayer-cdn.tcgplayer.com/product/${tcgplayerId}_200w.jpg`
        : null;

      // Calculate market price from variants
      // JustTCG prices are in USD dollars (e.g. 3900 = $3,900.00)
      // Prefer Near Mint price, fallback to first available
      const cardVariants = variants ?? [];
      let marketPrice: number | null = null;
      if (cardVariants.length > 0) {
        const nearMint = cardVariants.find((v) => v.condition === "Near Mint" && v.price > 0);
        const bestVariant = nearMint ?? cardVariants.find((v) => v.price > 0);
        if (bestVariant) {
          marketPrice = Math.round(bestVariant.price * 100) / 100;
        }
      }

      card = await Card.create({
        justTcgId,
        name: name ?? "Unknown",
        game: cardGame ?? box.game,
        set: cardSet ?? "",
        setName: setName ?? "",
        rarity: rarity ?? "",
        image: imageUrl,
        tcgplayerId: tcgplayerId ?? null,
        marketPrice,
        internalPrice: internalPrice ?? marketPrice,
        lastPriceUpdate: marketPrice !== null ? new Date() : null,
        variants: cardVariants,
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
