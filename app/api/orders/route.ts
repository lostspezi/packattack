import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Order from "@/models/order";
import "@/models/card";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10)));

  try {
    await connectDB();

    const [orders, total] = await Promise.all([
      Order.find({ userId })
        .populate("items.cardId", "name image rarity setName")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments({ userId }),
    ]);

    return NextResponse.json({
      orders: orders.map((o) => ({
        _id: o._id.toString(),
        orderNumber: o.orderNumber,
        items: o.items,
        status: o.status,
        paymentMethod: o.paymentMethod,
        shippingCostCents: o.shippingCostCents,
        fulfillments: o.fulfillments.map((f) => ({
          status: f.status,
          trackingNumber: f.trackingNumber,
          shippedAt: f.shippedAt,
          itemCount: f.items.length,
        })),
        createdAt: o.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[orders GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
