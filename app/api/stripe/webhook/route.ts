import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import connectDB from "@/lib/db";
import stripe from "@/lib/stripe";
import User from "@/models/user";
import CoinPurchase from "@/models/coin-purchase";
import CoinTransaction from "@/models/coin-transaction";
import CartItem from "@/models/cart-item";
import PackPull from "@/models/pack-pull";
import Order from "@/models/order";
import Notification from "@/models/notification";
import { decrementShopStock } from "@/lib/fulfillment-assignment";
import { runRedisCommand } from "@/lib/redis";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  await connectDB();

  switch (event.type) {
    case "checkout.session.completed": {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      if (checkoutSession.metadata?.type === "shipping") {
        await handleShippingCheckoutCompleted(checkoutSession);
      } else {
        await handleCheckoutCompleted(checkoutSession);
      }
      break;
    }
    case "checkout.session.expired": {
      const expiredSession = event.data.object as Stripe.Checkout.Session;
      if (expiredSession.metadata?.type === "shipping") {
        await handleShippingCheckoutExpired(expiredSession);
      } else {
        await handleCheckoutExpired(expiredSession);
      }
      break;
    }
    case "identity.verification_session.verified":
      await handleIdentityVerified(event.data.object);
      break;
    case "identity.verification_session.requires_input":
      await handleIdentityFailed(event.data.object);
      break;
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { userId, packageId, baseCoins, bonusCoins } = session.metadata || {};
  if (!userId || !packageId || baseCoins == null || bonusCoins == null) {
    console.error("Webhook missing metadata:", session.id);
    return;
  }

  const purchase = await CoinPurchase.findOne({ stripeSessionId: session.id });
  if (!purchase) {
    console.error("Purchase not found for session:", session.id);
    return;
  }

  // Idempotency: skip if already completed
  if (purchase.status === "completed") {
    return;
  }

  const totalCoins = parseInt(baseCoins, 10) + parseInt(bonusCoins, 10);

  // Grant coins atomically
  await User.findByIdAndUpdate(userId, { $inc: { coins: totalCoins } });

  // Create transaction record
  await CoinTransaction.create({
    userId,
    amount: totalCoins,
    type: "coin_purchase",
    reason: `Package purchase: ${purchase.packageSnapshot.name.de}`,
    relatedPurchaseId: purchase._id,
  });

  // Fetch Stripe invoice URLs (created via invoice_creation on checkout)
  let stripeInvoiceUrl: string | null = null;
  let stripeReceiptUrl: string | null = null;
  if (session.invoice) {
    try {
      const invoice = await stripe.invoices.retrieve(session.invoice as string);
      stripeInvoiceUrl = invoice.hosted_invoice_url ?? null;
      stripeReceiptUrl = invoice.invoice_pdf ?? null;
    } catch (err) {
      console.error("Failed to retrieve Stripe invoice:", err);
    }
  }

  // Update purchase
  purchase.status = "completed";
  purchase.stripePaymentIntentId = session.payment_intent as string;
  purchase.coinsGranted = totalCoins;
  purchase.stripeInvoiceUrl = stripeInvoiceUrl;
  purchase.stripeReceiptUrl = stripeReceiptUrl;
  await purchase.save();
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  await CoinPurchase.findOneAndUpdate(
    { stripeSessionId: session.id, status: "pending" },
    { status: "expired" }
  );
}

async function handleIdentityVerified(verificationSession: Stripe.Identity.VerificationSession) {
  const userId = verificationSession.metadata?.userId;
  if (!userId) return;

  // Extract DOB and check age
  const dob = verificationSession.verified_outputs?.dob;
  let dateOfBirth: Date | null = null;

  if (dob?.year && dob?.month && dob?.day) {
    dateOfBirth = new Date(dob.year, dob.month - 1, dob.day);
    const age = Math.floor(
      (Date.now() - dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );

    if (age < 18) {
      console.warn(`User ${userId} is under 18 (age: ${age}). Verification rejected.`);
      return;
    }
  }

  const update: Record<string, unknown> = {
    identityVerified: true,
    identityVerifiedAt: new Date(),
  };
  if (dateOfBirth) {
    update.dateOfBirth = dateOfBirth;
  }

  await User.findByIdAndUpdate(userId, update);
}

async function handleIdentityFailed(verificationSession: Stripe.Identity.VerificationSession) {
  const userId = verificationSession.metadata?.userId;
  if (!userId) return;

  await User.findByIdAndUpdate(userId, {
    identityVerified: false,
    stripeIdentityVerificationId: null,
  });
}

async function handleShippingCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { orderId, userId } = session.metadata || {};
  if (!orderId || !userId) {
    console.error("Shipping webhook missing metadata:", session.id);
    return;
  }

  const order = await Order.findById(orderId);
  if (!order || order.paymentStatus === "paid") return;

  const cartItemIds = order.items.map((i: { cartItemId: unknown }) => i.cartItemId) as string[];

  // Verify ALL cart items are still reserved before completing
  const stillReservedCount = await CartItem.countDocuments({
    _id: { $in: cartItemIds },
    status: "reserved",
  });
  if (stillReservedCount !== order.items.length) {
    console.error(
      `[shipping webhook] Order ${order.orderNumber}: only ${stillReservedCount}/${order.items.length} items still reserved. Refunding.`
    );
    // Refund the Stripe payment
    if (session.payment_intent) {
      try {
        await (await import("@/lib/stripe")).default.refunds.create({
          payment_intent: session.payment_intent as string,
        });
      } catch (refundErr) {
        console.error("[shipping webhook] Refund failed:", refundErr);
      }
    }
    order.paymentStatus = "failed";
    order.status = "cancelled";
    await order.save();
    return;
  }

  order.paymentStatus = "paid";
  order.status = "paid";
  order.stripePaymentIntentId = session.payment_intent as string;
  await order.save();

  await CartItem.updateMany(
    { _id: { $in: cartItemIds }, status: "reserved" },
    { status: "checked_out", orderId: order._id }
  );

  const cartItems = await CartItem.find({ _id: { $in: cartItemIds } }).select("pullId").lean();
  const pullIds = cartItems.map((c) => c.pullId);
  await PackPull.updateMany(
    { _id: { $in: pullIds }, status: "reserved" },
    { status: "claimed" }
  );

  await decrementShopStock(order.fulfillments);

  await CoinTransaction.create({
    userId,
    amount: 0,
    type: "shipping_payment",
    reason: `Stripe shipping payment for order ${order.orderNumber}`,
    relatedOrderId: order._id,
  });

  for (const f of order.fulfillments) {
    if (!f.shopId) continue;
    await Notification.create({
      userId: f.shopId,
      title: "New fulfillment order",
      message: `Order ${order.orderNumber}: ${f.items.length} card${f.items.length > 1 ? "s" : ""} to ship.`,
      type: "info",
      cta: { label: "View orders", url: "/shop/fulfillments" },
      category: "fulfillment",
      entityType: "order",
      entityId: orderId,
    });
  }

  await Notification.create({
    userId,
    title: "Order confirmed",
    message: `Your order ${order.orderNumber} has been paid and is being processed.`,
    type: "success",
    cta: { label: "View order", url: `/orders/${orderId}` },
    category: "order",
    entityType: "order",
    entityId: orderId,
  });

  await runRedisCommand("notify-order", null, async (redis) => {
    const count = await Notification.countDocuments({ userId, read: false });
    await redis.set(`notifications:unread:${userId}`, count, "EX", 60);
    await redis.publish(`notifications:${userId}`, JSON.stringify({ unreadCount: count }));
    return null;
  });
}

async function handleShippingCheckoutExpired(session: Stripe.Checkout.Session) {
  const { orderId } = session.metadata || {};
  if (!orderId) return;

  await Order.findByIdAndUpdate(
    orderId,
    { paymentStatus: "failed", status: "cancelled" }
  );
}
