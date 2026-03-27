import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import InventoryItem from "@/models/inventory-item";

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

  const { stock, notes } = body as { stock?: number; notes?: string | null };

  if (stock !== undefined && (stock < 0 || !Number.isInteger(stock))) {
    return NextResponse.json({ error: "stock must be a non-negative integer" }, { status: 400 });
  }

  try {
    await connectDB();
    const item = await InventoryItem.findById(id);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (stock !== undefined) item.stock = stock;
    if (notes !== undefined) item.notes = notes;

    await item.save();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/inventory/[id] PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
