import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Order from "@/models/order";
import "@/models/card";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const order = await Order.findOne({ _id: id, userId })
      .populate("items.cardId", "name image rarity setName")
      .lean();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      _id: order._id.toString(),
      orderNumber: order.orderNumber,
      items: order.items,
      shippingAddress: order.shippingAddress,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      shippingCostCents: order.shippingCostCents,
      fulfillments: order.fulfillments.map((f) => ({
        status: f.status,
        trackingNumber: f.trackingNumber,
        shippedAt: f.shippedAt,
        itemCount: f.items.length,
      })),
      status: order.status,
      createdAt: order.createdAt,
    });
  } catch (err) {
    console.error("[orders/[id] GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
