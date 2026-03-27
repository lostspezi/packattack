import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import InventoryItem from "@/models/inventory-item";
import Box from "@/models/box";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !userId || !["shop", "admin", "super_admin"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { stock, ean, sku, notes, netPrice, condition } = body as {
    stock?: number;
    ean?: string | null;
    sku?: string | null;
    notes?: string | null;
    netPrice?: number | null;
    condition?: string;
  };

  if (stock !== undefined && (stock < 0 || !Number.isInteger(stock))) {
    return NextResponse.json({ error: "stock must be a non-negative integer" }, { status: 400 });
  }

  if (condition !== undefined) {
    const validConditions = ["Mint", "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played"];
    if (!validConditions.includes(condition)) {
      return NextResponse.json({ error: "Invalid condition" }, { status: 400 });
    }
  }

  try {
    await connectDB();
    const item = await InventoryItem.findOne({ _id: id, shop: userId });
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (stock !== undefined) item.stock = stock;
    if (ean !== undefined) item.ean = ean;
    if (sku !== undefined) item.sku = sku;
    if (notes !== undefined) item.notes = notes;
    if (netPrice !== undefined) item.netPrice = netPrice;
    if (condition !== undefined) item.condition = condition as typeof item.condition;

    await item.save();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[shop/inventory/[id] PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !userId || !["shop", "admin", "super_admin"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();
    const item = await InventoryItem.findOne({ _id: id, shop: userId });
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const inUse = await Box.findOne({
      "cards.card": item.card,
      "cards.isSubstitute": true,
    });
    if (inUse) {
      const boxName = inUse.name?.de ?? inUse.name?.en ?? "einer Box";
      return NextResponse.json(
        {
          error: `Diese Karte wird aktuell in "${boxName}" als Ersatz verwendet und kann nicht gelöscht werden.`,
        },
        { status: 409 }
      );
    }

    await item.deleteOne();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[shop/inventory/[id] DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
