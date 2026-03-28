import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { getRedis } from "@/lib/redis";
import User from "@/models/user";
import CartItem from "@/models/cart-item";
import PackPull from "@/models/pack-pull";
import Order from "@/models/order";
import CoinTransaction from "@/models/coin-transaction";
import Notification from "@/models/notification";
import { calculateShippingCost } from "@/lib/shipping";
import { assignFulfillments, decrementShopStock } from "@/lib/fulfillment-assignment";
import { cartCheckoutSchema } from "@/lib/validations";
import stripe from "@/lib/stripe";

function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PA-${dateStr}-${rand}`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = cartCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { paymentMethod, address, lang } = parsed.data;

  try {
    await connectDB();

    // Distributed lock to prevent double checkout
    const redis = getRedis();
    const lockKey = `checkout:${userId}`;
    const locked = await redis.set(lockKey, "1", "EX", 30, "NX");
    if (!locked) {
      return NextResponse.json({ error: "Checkout already in progress" }, { status: 429 });
    }

    try {
      const now = new Date();
      const cartItems = await CartItem.find({
        userId,
        status: "reserved",
        expiresAt: { $gt: now },
      }).lean();

      if (cartItems.length === 0) {
        return NextResponse.json({ error: "No reserved items in cart" }, { status: 400 });
      }

      const shippingCost = await calculateShippingCost(cartItems.length, address.country);
      if (!shippingCost.tierFound) {
        return NextResponse.json({ error: "No shipping tier found for this country and card count" }, { status: 400 });
      }

      const cards = cartItems.map((item) => ({
        cardId: item.cardId.toString(),
        rarity: item.rarity,
      }));
      const fulfillments = await assignFulfillments(cards);

      let orderNumber = generateOrderNumber();
      let retries = 0;
      while (retries < 5) {
        const existing = await Order.findOne({ orderNumber }).select("_id").lean();
        if (!existing) break;
        orderNumber = generateOrderNumber();
        retries++;
      }

      if (paymentMethod === "coins") {
        const user = await User.findOneAndUpdate(
          { _id: userId, coins: { $gte: shippingCost.costCoins } },
          {
            $inc: { coins: -shippingCost.costCoins },
            $set: { shippingAddress: address },
          },
          { returnDocument: "after" }
        );

        if (!user) {
          return NextResponse.json({ error: "Insufficient coins" }, { status: 400 });
        }

        const order = await Order.create({
          userId,
          orderNumber,
          items: cartItems.map((item) => ({
            cartItemId: item._id,
            cardId: item.cardId,
            rarity: item.rarity,
          })),
          shippingAddress: address,
          paymentMethod: "coins",
          paymentStatus: "paid",
          shippingCostCents: shippingCost.costCents,
          shippingCostCoins: shippingCost.costCoins,
          fulfillments,
          status: "paid",
        });

        await CartItem.updateMany(
          { _id: { $in: cartItems.map((i) => i._id) }, status: "reserved" },
          { status: "checked_out", orderId: order._id }
        );

        await PackPull.updateMany(
          { _id: { $in: cartItems.map((i) => i.pullId) }, status: "reserved" },
          { status: "claimed" }
        );

        await decrementShopStock(fulfillments);

        await CoinTransaction.create({
          userId,
          amount: -shippingCost.costCoins,
          type: "shipping_payment",
          reason: `Shipping for order ${orderNumber}`,
          relatedOrderId: order._id,
        });

        await notifyShops(order._id.toString(), orderNumber, fulfillments);

        return NextResponse.json({
          success: true,
          orderId: order._id.toString(),
          orderNumber,
          newBalance: user.coins,
        });
      } else {
        // Stripe payment
        const user = await User.findById(userId);
        if (!user) {
          return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        user.shippingAddress = address;
        await user.save();

        const order = await Order.create({
          userId,
          orderNumber,
          items: cartItems.map((item) => ({
            cartItemId: item._id,
            cardId: item.cardId,
            rarity: item.rarity,
          })),
          shippingAddress: address,
          paymentMethod: "stripe",
          paymentStatus: "pending",
          shippingCostCents: shippingCost.costCents,
          shippingCostCoins: shippingCost.costCoins,
          fulfillments,
          status: "pending_payment",
        });

        const minExpiry = new Date(Date.now() + 30 * 60 * 1000);
        await CartItem.updateMany(
          {
            _id: { $in: cartItems.map((i) => i._id) },
            status: "reserved",
            expiresAt: { $lt: minExpiry },
          },
          { expiresAt: minExpiry }
        );

        let stripeCustomerId = user.stripeCustomerId;
        if (!stripeCustomerId) {
          const customer = await stripe.customers.create({
            email: user.email,
            name: user.name || user.username,
            metadata: { userId },
          });
          stripeCustomerId = customer.id;
          user.stripeCustomerId = stripeCustomerId;
          await user.save();
        }

        const checkoutSession = await stripe.checkout.sessions.create({
          mode: "payment",
          customer: stripeCustomerId,
          line_items: [
            {
              price_data: {
                currency: "eur",
                product_data: {
                  name: `Versand – Bestellung ${orderNumber}`,
                  description: `${cartItems.length} Karte${cartItems.length > 1 ? "n" : ""}`,
                },
                unit_amount: shippingCost.costCents,
              },
              quantity: 1,
            },
          ],
          metadata: {
            type: "shipping",
            orderId: order._id.toString(),
            userId,
          },
          expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
          success_url: `${process.env.NEXT_PUBLIC_APP_URL}/${lang}/orders/${order._id}?payment=success`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/${lang}/cart?payment=cancelled`,
          locale: lang === "de" ? "de" : "en",
        });

        order.stripeSessionId = checkoutSession.id;
        await order.save();

        return NextResponse.json({
          success: true,
          checkoutUrl: checkoutSession.url,
          orderId: order._id.toString(),
          orderNumber,
        });
      }
    } finally {
      await redis.del(lockKey);
    }
  } catch (err) {
    console.error("[cart/checkout POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

async function notifyShops(
  orderId: string,
  orderNumber: string,
  fulfillments: Array<{ shopId: unknown; items: unknown[] }>
) {
  for (const f of fulfillments) {
    if (!f.shopId) continue;
    const shopUserId = f.shopId.toString();
    await Notification.create({
      userId: shopUserId,
      title: "Neuer Versandauftrag",
      message: `Bestellung ${orderNumber}: ${f.items.length} Karte${f.items.length > 1 ? "n" : ""} zum Versand.`,
      type: "info",
      cta: { label: "Aufträge ansehen", url: "/shop/fulfillments" },
      category: "fulfillment",
      entityType: "order",
      entityId: orderId,
    });
  }
}
