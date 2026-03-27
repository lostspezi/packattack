import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Box from "@/models/box";
import Card from "@/models/card";
import Rarity from "@/models/rarity";
import { getUsdToEur } from "@/lib/currency";

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

    const cardEntries = box.cards ?? [];

    // Support legacy format: if entries are plain ObjectIds (old format), treat as weight=1, rarity=unknown
    const isLegacy = cardEntries.length > 0 && !("card" in (cardEntries[0] as object));

    let populatedCards: Array<{
      _id: string;
      justTcgId: string;
      name: string;
      rarity: string;
      image: string | null;
      marketPrice: number | null;
      internalPrice: number | null;
      set?: string;
      setName?: string;
      tcgplayerId?: string | null;
      weight: number;
      drawChance: number;
      stock: number;
      minStock: number;
      conditions: string[];
      priceChange7d: number | null;
      priceChange30d: number | null;
    }>;

    if (isLegacy) {
      // Legacy: cards is ObjectId[]
      const legacyIds = cardEntries as unknown as Types.ObjectId[];
      const cards = await Card.find({ _id: { $in: legacyIds } }).lean();
      const totalWeight = cards.length;
      populatedCards = cards.map((card) => {
        const variants = (card.variants ?? []) as Array<Record<string, unknown>>;
        const nearMint = variants.find((v) => v.condition === "Near Mint");
        const primaryVariant = nearMint ?? variants[0];
        return {
          ...card,
          _id: card._id.toString(),
          weight: 1,
          stock: 0,
          minStock: 5,
          conditions: ["Near Mint"],
          drawChance: totalWeight > 0 ? (1 / totalWeight) * 100 : 0,
          priceChange7d: (primaryVariant?.priceChange7d as number | null) ?? null,
          priceChange30d: (primaryVariant?.priceChange30d as number | null) ?? null,
        };
      });
    } else {
      // New format: cards is IBoxCard[]
      const typedEntries = cardEntries as Array<{ card: Types.ObjectId; weight: number; rarity: string; stock?: number; minStock?: number; conditions?: string[]; _id?: Types.ObjectId }>;
      const cardIds = typedEntries.map((e) => e.card);
      const cardDocs = await Card.find({ _id: { $in: cardIds } }).lean();
      const cardMap = new Map(cardDocs.map((c) => [c._id.toString(), c]));

      const totalWeight = typedEntries.reduce((acc, e) => acc + (e.weight ?? 0), 0);

      populatedCards = typedEntries.map((entry) => {
        const cardId = entry.card.toString();
        const card = cardMap.get(cardId);
        if (!card) return null;

        const variants = (card.variants ?? []) as Array<Record<string, unknown>>;
        const nearMint = variants.find((v) => v.condition === "Near Mint");
        const primaryVariant = nearMint ?? variants[0];

        return {
          ...card,
          _id: card._id.toString(),
          rarity: entry.rarity,
          weight: entry.weight,
          stock: entry.stock ?? 0,
          minStock: entry.minStock ?? 5,
          conditions: entry.conditions ?? ["Near Mint"],
          drawChance: totalWeight > 0 ? (entry.weight / totalWeight) * 100 : 0,
          priceChange7d: (primaryVariant?.priceChange7d as number | null) ?? null,
          priceChange30d: (primaryVariant?.priceChange30d as number | null) ?? null,
        };
      }).filter(Boolean) as typeof populatedCards;
    }

    // Compute rarity breakdown
    const totalWeight = populatedCards.reduce((acc, c) => acc + c.weight, 0);
    const rarityMap = new Map<string, number>();
    for (const card of populatedCards) {
      rarityMap.set(card.rarity, (rarityMap.get(card.rarity) ?? 0) + card.weight);
    }
    const rarityBreakdown = Array.from(rarityMap.entries()).map(([rarity, weight]) => ({
      rarity,
      weight,
      percentage: totalWeight > 0 ? (weight / totalWeight) * 100 : 0,
    }));

    const usdToEur = await getUsdToEur();

    return NextResponse.json({ cards: populatedCards, rarityBreakdown, usdToEur });
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

  const {
    justTcgId,
    name,
    game: cardGame,
    set: cardSet,
    setName,
    rarity,
    tcgplayerId,
    variants,
    internalPrice,
    weight,
    rarityOverride,
  } = body as {
    justTcgId?: string;
    name?: string;
    game?: string;
    set?: string;
    setName?: string;
    rarity?: string;
    tcgplayerId?: string | null;
    variants?: Array<{ condition: string; printing: string; price: number }>;
    internalPrice?: number;
    weight?: number;
    rarityOverride?: string;
  };

  if (!justTcgId) {
    return NextResponse.json(
      { error: "justTcgId is required" },
      { status: 400 }
    );
  }

  if (weight !== undefined && (typeof weight !== "number" || isNaN(weight) || weight < 0.001 || weight > 1000)) {
    return NextResponse.json(
      { error: "Weight must be between 0.001 and 1000" },
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
      const imageUrl = tcgplayerId
        ? `https://tcgplayer-cdn.tcgplayer.com/product/${tcgplayerId}_200w.jpg`
        : null;

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

    // Determine effective rarity for this box entry
    const effectiveRarity = rarityOverride ?? rarity ?? card.rarity ?? "";

    // Check if rarity exists in box rarityWeights; if not, auto-add it with weight 0
    const rarityExists = box.rarityWeights.some(
      (rw) => rw.rarity === effectiveRarity
    );
    if (effectiveRarity && !rarityExists) {
      box.rarityWeights.push({ rarity: effectiveRarity, weight: 0 });
    }

    // Persist rarity globally for autocomplete reuse
    if (effectiveRarity) {
      Rarity.updateOne(
        { name: effectiveRarity, game: box.game },
        { $setOnInsert: { name: effectiveRarity, game: box.game } },
        { upsert: true }
      ).catch(() => {});
    }

    // Prevent duplicates — check by card ObjectId in subdocument array
    const alreadyInBox = box.cards.some(
      (e) => e.card.toString() === cardObjectId.toString()
    );

    if (!alreadyInBox) {
      box.cards.push({
        card: cardObjectId,
        weight: weight ?? 1,
        rarity: effectiveRarity,
        stock: 0,
        minStock: 5,
        conditions: ["Near Mint"] as ("Mint" | "Near Mint" | "Lightly Played" | "Moderately Played" | "Heavily Played")[],
      });
      await box.save();
    }

    return NextResponse.json(card.toObject(), { status: 201 });
  } catch (err) {
    console.error("[admin/boxes/[id]/cards POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(
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

  const { cardId, weight, rarity, internalPrice, stock, minStock, conditions } = body as {
    cardId?: string;
    weight?: number;
    rarity?: string;
    internalPrice?: number;
    stock?: number;
    minStock?: number;
    conditions?: string[];
  };

  if (!cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }

  if (weight !== undefined && (typeof weight !== "number" || isNaN(weight) || weight < 0.001 || weight > 1000)) {
    return NextResponse.json(
      { error: "Weight must be between 0.001 and 1000" },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    const box = await Box.findById(id);
    if (!box) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    const entry = box.cards.find((e) => e.card.toString() === cardId);
    if (!entry) {
      return NextResponse.json({ error: "Card not found in box" }, { status: 404 });
    }

    if (weight !== undefined) {
      entry.weight = weight;
    }

    if (stock !== undefined) {
      if (typeof stock !== "number" || !Number.isInteger(stock) || stock < 0) {
        return NextResponse.json({ error: "Stock must be a whole number >= 0" }, { status: 400 });
      }
      entry.stock = stock;
    }

    if (minStock !== undefined) {
      if (typeof minStock !== "number" || !Number.isInteger(minStock) || minStock < 0) {
        return NextResponse.json({ error: "Min stock must be a whole number >= 0" }, { status: 400 });
      }
      entry.minStock = minStock;
    }

    if (conditions !== undefined) {
      const validConditions = ["Mint", "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played"];
      if (!Array.isArray(conditions) || conditions.length === 0 || !conditions.every((c) => validConditions.includes(c))) {
        return NextResponse.json({ error: "Invalid conditions" }, { status: 400 });
      }
      entry.conditions = conditions as ("Mint" | "Near Mint" | "Lightly Played" | "Moderately Played" | "Heavily Played")[];
    }

    if (rarity !== undefined) {
      entry.rarity = rarity;
      // Auto-add rarity if not in box's rarity list
      const rarityExists = box.rarityWeights.some((rw) => rw.rarity === rarity);
      if (rarity && !rarityExists) {
        box.rarityWeights.push({ rarity, weight: 0 });
      }
    }

    await box.save();

    // Update internalPrice on the Card document (not box subdocument)
    if (internalPrice !== undefined) {
      if (typeof internalPrice !== "number" || !Number.isInteger(internalPrice) || internalPrice < 1) {
        return NextResponse.json({ error: "Coin value must be a whole number >= 1" }, { status: 400 });
      }
      await Card.findByIdAndUpdate(cardId, { internalPrice });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/boxes/[id]/cards PATCH]", err);
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
    box.cards = box.cards.filter((e) => e.card.toString() !== cardId) as typeof box.cards;

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
