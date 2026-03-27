import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import InventoryItem from "@/models/inventory-item";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const shopId = searchParams.get("shop") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10));

  const query: Record<string, unknown> = {};
  if (shopId) query.shop = shopId;

  try {
    await connectDB();
    const [items, total] = await Promise.all([
      InventoryItem.find(query)
        .populate("card", "name game rarity image internalPrice")
        .populate("shop", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      InventoryItem.countDocuments(query),
    ]);

    return NextResponse.json({
      items: items.map((i) => ({
        _id: i._id.toString(),
        card: i.card,
        shop: i.shop,
        stock: i.stock,
        ean: i.ean,
        sku: i.sku,
        notes: i.notes,
        pricePerUnit: i.pricePerUnit,
        createdAt: i.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[admin/inventory GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
