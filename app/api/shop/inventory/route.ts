import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import InventoryItem from "@/models/inventory-item";
import Card from "@/models/card";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const allowedRoles = ["shop", "admin", "super_admin"];
  if (!session?.user || !userId || !role || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10));

  try {
    await connectDB();
    const [items, total] = await Promise.all([
      InventoryItem.find({ shop: userId })
        .populate("card", "name game rarity image tcgplayerId setName set justTcgId")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      InventoryItem.countDocuments({ shop: userId }),
    ]);

    return NextResponse.json({
      items: items.map((i) => ({
        _id: i._id.toString(),
        card: i.card,
        condition: i.condition,
        stock: i.stock,
        ean: i.ean,
        sku: i.sku,
        notes: i.notes,
        netPrice: i.netPrice,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[shop/inventory GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const allowedRolesPost = ["shop", "admin", "super_admin"];
  if (!session?.user || !userId || !role || !allowedRolesPost.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    justTcgId,
    name,
    game,
    set,
    setName,
    rarity,
    tcgplayerId,
    tcgplayerSkuId,
    condition,
    stock,
    variants,
  } = body as {
    justTcgId?: string;
    name?: string;
    game?: string;
    set?: string;
    setName?: string;
    rarity?: string;
    tcgplayerId?: string | null;
    tcgplayerSkuId?: string | null;
    condition?: string;
    stock?: number;
    variants?: Array<{ condition: string; printing: string; price: number }>;
  };

  if (!justTcgId) {
    return NextResponse.json({ error: "justTcgId is required" }, { status: 400 });
  }

  const itemCondition = condition ?? "Near Mint";
  const validConditions = ["Mint", "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played"];
  if (!validConditions.includes(itemCondition)) {
    return NextResponse.json({ error: "Invalid condition" }, { status: 400 });
  }

  try {
    await connectDB();

    // Find or create Card record (same logic as POST /api/admin/boxes/[id]/cards)
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
        game: game ?? "",
        set: set ?? "",
        setName: setName ?? "",
        rarity: rarity ?? "",
        image: imageUrl,
        tcgplayerId: tcgplayerId ?? null,
        marketPrice,
        internalPrice: marketPrice,
        lastPriceUpdate: marketPrice !== null ? new Date() : null,
        variants: cardVariants,
      });
    }

    // Duplicate check: same shop + card + condition
    const existing = await InventoryItem.findOne({
      shop: userId,
      card: card._id,
      condition: itemCondition,
    });
    if (existing) {
      return NextResponse.json(
        { error: "Dieser Artikel mit diesem Zustand existiert bereits." },
        { status: 409 }
      );
    }

    const item = await InventoryItem.create({
      card: card._id,
      shop: userId,
      condition: itemCondition,
      stock: stock ?? 0,
      sku: tcgplayerSkuId ?? null,
      ean: null,
      notes: null,
      netPrice: null,
    });

    return NextResponse.json({ _id: item._id.toString() }, { status: 201 });
  } catch (err) {
    console.error("[shop/inventory POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}