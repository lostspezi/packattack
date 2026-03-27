import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import InventoryItem from "@/models/inventory-item";

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
        .populate("card", "name game rarity image internalPrice")
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
        stock: i.stock,
        ean: i.ean,
        sku: i.sku,
        notes: i.notes,
        pricePerUnit: i.pricePerUnit,
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

  const { cardId, stock, ean, sku, notes, pricePerUnit } = body as {
    cardId?: string;
    stock?: number;
    ean?: string;
    sku?: string;
    notes?: string;
    pricePerUnit?: number;
  };

  if (!cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }
  if (stock === undefined || stock < 0 || !Number.isInteger(stock)) {
    return NextResponse.json({ error: "stock must be a non-negative integer" }, { status: 400 });
  }

  try {
    await connectDB();

    const existing = await InventoryItem.findOne({ shop: userId, card: cardId });
    if (existing) {
      return NextResponse.json(
        { error: "Dieser Artikel existiert bereits. Bitte Bestand anpassen." },
        { status: 409 }
      );
    }

    const item = await InventoryItem.create({
      card: cardId,
      shop: userId,
      stock,
      ean: ean ?? null,
      sku: sku ?? null,
      notes: notes ?? null,
      pricePerUnit: pricePerUnit ?? null,
    });

    return NextResponse.json({ _id: item._id.toString() }, { status: 201 });
  } catch (err) {
    console.error("[shop/inventory POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
