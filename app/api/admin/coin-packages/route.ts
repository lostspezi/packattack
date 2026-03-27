import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import CoinPackage from "@/models/coin-package";
import { coinPackageSchema } from "@/lib/validations";
import stripe from "@/lib/stripe";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const packages = await CoinPackage.find()
    .sort({ sortOrder: 1, createdAt: -1 })
    .lean();

  return NextResponse.json(packages);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = coinPackageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await connectDB();

  const data = parsed.data;
  const slug = data.name.en
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Create Stripe Product + Price
  const product = await stripe.products.create({
    name: data.name.en,
    metadata: { source: "packattack", type: "coin_package" },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: data.priceEurCents,
    currency: "eur",
  });

  const coinPackage = await CoinPackage.create({
    ...data,
    slug,
    stripePriceId: price.id,
    stripeProductId: product.id,
    createdBy: userId,
  });

  return NextResponse.json(coinPackage, { status: 201 });
}
