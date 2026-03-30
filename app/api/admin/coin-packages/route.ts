import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import CoinPackage from "@/models/coin-package";
import { coinPackageSchema } from "@/lib/validations";
import stripe from "@/lib/stripe";
import { Types } from "mongoose";

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

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { orderedIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderedIds = Array.isArray(body.orderedIds)
    ? body.orderedIds.filter(
        (id): id is string => typeof id === "string" && Types.ObjectId.isValid(id)
      )
    : [];

  const uniqueOrderedIds = [...new Set(orderedIds)];
  if (orderedIds.length === 0 || uniqueOrderedIds.length !== orderedIds.length) {
    return NextResponse.json(
      { error: "orderedIds must be a non-empty list of unique package ids" },
      { status: 400 }
    );
  }

  await connectDB();

  const totalPackages = await CoinPackage.countDocuments();
  if (orderedIds.length !== totalPackages) {
    return NextResponse.json(
      { error: "orderedIds must include all packages" },
      { status: 400 }
    );
  }

  const existingPackages = await CoinPackage.find({ _id: { $in: orderedIds } })
    .select("_id")
    .lean();

  if (existingPackages.length !== orderedIds.length) {
    return NextResponse.json({ error: "Unknown package id in orderedIds" }, { status: 400 });
  }

  await CoinPackage.bulkWrite(
    orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { sortOrder: index } },
      },
    }))
  );

  return NextResponse.json({ success: true });
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

  const canUseStripe = Boolean(process.env.STRIPE_SECRET_KEY);
  if (!canUseStripe && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  let stripeProductId: string | null = null;
  let stripePriceId: string | null = null;

  if (canUseStripe) {
    const product = await stripe.products.create({
      name: data.name.en,
      metadata: { source: "packattack", type: "coin_package" },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: data.priceEurCents,
      currency: "eur",
    });

    stripeProductId = product.id;
    stripePriceId = price.id;
  }

  const coinPackage = await CoinPackage.create({
    ...data,
    slug,
    stripePriceId,
    stripeProductId,
    createdBy: userId,
  });

  return NextResponse.json(coinPackage, { status: 201 });
}
