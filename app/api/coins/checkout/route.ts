import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import CoinPackage from "@/models/coin-package";
import CoinPurchase from "@/models/coin-purchase";
import { checkoutSchema } from "@/lib/validations";
import stripe from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await connectDB();

  const user = await User.findById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Enforce identity verification
  if (!user.identityVerified) {
    return NextResponse.json(
      { error: "Identity verification required" },
      { status: 403 }
    );
  }

  const coinPackage = await CoinPackage.findById(parsed.data.packageId);
  if (!coinPackage || !coinPackage.isActive) {
    return NextResponse.json(
      { error: "Package not found or inactive" },
      { status: 404 }
    );
  }

  if (!coinPackage.stripePriceId) {
    return NextResponse.json(
      { error: "Package not configured for payment" },
      { status: 500 }
    );
  }

  // Get or create Stripe Customer
  let stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name || user.username,
      metadata: { userId: userId },
    });
    stripeCustomerId = customer.id;
    user.stripeCustomerId = stripeCustomerId;
    await user.save();
  }

  // Determine language for Stripe Checkout
  const lang = (session.user as { language?: string }).language || "de";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: stripeCustomerId,
    line_items: [{ price: coinPackage.stripePriceId, quantity: 1 }],
    metadata: {
      userId: userId,
      packageId: coinPackage._id.toString(),
      baseCoins: coinPackage.baseCoins.toString(),
      bonusCoins: coinPackage.bonusCoins.toString(),
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/${lang}/balance?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/${lang}/balance?canceled=true`,
    locale: lang === "de" ? "de" : "en",
  });

  // Create pending purchase record with withdrawal consent timestamp
  await CoinPurchase.create({
    userId: userId,
    packageId: coinPackage._id,
    packageSnapshot: {
      name: coinPackage.name,
      baseCoins: coinPackage.baseCoins,
      bonusCoins: coinPackage.bonusCoins,
      priceEurCents: coinPackage.priceEurCents,
    },
    status: "pending",
    stripeSessionId: checkoutSession.id,
    withdrawalConsentAt: new Date(),
  });

  return NextResponse.json({ checkoutUrl: checkoutSession.url });
}
