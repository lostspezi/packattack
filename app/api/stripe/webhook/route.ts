import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import connectDB from "@/lib/db";
import stripe from "@/lib/stripe";
import User from "@/models/user";
import CoinPurchase from "@/models/coin-purchase";
import CoinTransaction from "@/models/coin-transaction";

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
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "checkout.session.expired":
      await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
      break;
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
