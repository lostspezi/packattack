import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Order from "@/models/order";
import { adminOrderUpdateSchema } from "@/lib/validations";
import "@/models/card";
import "@/models/user";

export async function GET(
  req: NextRequest,
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
    const order = await Order.findById(id)
      .populate("userId", "name username email")
      .populate("items.cardId", "name image rarity setName")
      .populate("fulfillments.shopId", "name username")
      .lean();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (err) {
    console.error("[admin/orders/[id] GET]", err);
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

  const parsed = adminOrderUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await connectDB();

    const order = await Order.findByIdAndUpdate(id, { status: parsed.data.status }, { returnDocument: "after" });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, status: order.status });
  } catch (err) {
    console.error("[admin/orders/[id] PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
