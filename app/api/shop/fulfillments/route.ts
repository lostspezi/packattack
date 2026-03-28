import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Order from "@/models/order";
import "@/models/card";
import "@/models/user";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const allowedRoles = ["shop", "admin", "super_admin"];

  if (!session?.user || !userId || !role || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10)));

  try {
    await connectDB();

    const query: Record<string, unknown> = {
      "fulfillments.shopId": userId,
      paymentStatus: "paid",
    };
    if (status) {
      query["fulfillments.status"] = status;
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("items.cardId", "name image rarity setName")
        .populate("userId", "name username")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    const mapped = orders.map((order) => {
      const myFulfillment = order.fulfillments.find(
        (f) => f.shopId?.toString() === userId
      );
      return {
        _id: order._id.toString(),
        orderNumber: order.orderNumber,
        user: order.userId,
        shippingAddress: order.shippingAddress,
        fulfillment: myFulfillment ?? null,
        items: order.items,
        createdAt: order.createdAt,
      };
    });

    return NextResponse.json({
      orders: mapped,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[shop/fulfillments GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
