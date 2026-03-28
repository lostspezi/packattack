import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Order from "@/models/order";
import Notification from "@/models/notification";
import { runRedisCommand } from "@/lib/redis";
import { fulfillmentUpdateSchema } from "@/lib/validations";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const allowedRoles = ["shop", "admin", "super_admin"];

  if (!session?.user || !userId || !role || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = fulfillmentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await connectDB();

    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const fulfillment = order.fulfillments.find(
      (f) => f.shopId?.toString() === userId
    );
    if (!fulfillment) {
      return NextResponse.json({ error: "No fulfillment assigned to you" }, { status: 403 });
    }

    fulfillment.status = parsed.data.status;
    if (parsed.data.trackingNumber !== undefined) {
      fulfillment.trackingNumber = parsed.data.trackingNumber;
    }
    if (parsed.data.status === "shipped") {
      fulfillment.shippedAt = new Date();
    }

    const allShipped = order.fulfillments.every(
      (f) => f.status === "shipped" || f.status === "delivered"
    );
    const allDelivered = order.fulfillments.every(
      (f) => f.status === "delivered"
    );

    if (allDelivered) {
      order.status = "delivered";
    } else if (allShipped) {
      order.status = "shipped";
    } else {
      order.status = "processing";
    }

    await order.save();

    if (parsed.data.status === "shipped") {
      const orderUserId = order.userId.toString();
      await Notification.create({
        userId: orderUserId,
        title: "Bestellung versendet",
        message: fulfillment.trackingNumber
          ? `Deine Bestellung ${order.orderNumber} wurde versendet. Tracking: ${fulfillment.trackingNumber}`
          : `Deine Bestellung ${order.orderNumber} wurde versendet.`,
        type: "success",
        cta: { label: "Bestellung ansehen", url: `/orders/${orderId}` },
        category: "order",
        entityType: "order",
        entityId: orderId,
      });

      await runRedisCommand("notify-shipped", null, async (redis) => {
        const count = await Notification.countDocuments({ userId: orderUserId, read: false });
        await redis.set(`notifications:unread:${orderUserId}`, count, "EX", 60);
        await redis.publish(`notifications:${orderUserId}`, JSON.stringify({ unreadCount: count }));
        return null;
      });
    }

    return NextResponse.json({ success: true, status: order.status });
  } catch (err) {
    console.error("[shop/fulfillments/[orderId] PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
