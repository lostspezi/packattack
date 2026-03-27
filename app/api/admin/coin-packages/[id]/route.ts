import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import CoinPackage from "@/models/coin-package";
import { coinPackageUpdateSchema } from "@/lib/validations";
import stripe from "@/lib/stripe";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();
  const pkg = await CoinPackage.findById(id).lean();
  if (!pkg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(pkg);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = coinPackageUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await connectDB();
  const existing = await CoinPackage.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = parsed.data;

  // If price changed, create new Stripe Price and archive old one
  if (data.priceEurCents && data.priceEurCents !== existing.priceEurCents) {
    if (existing.stripePriceId) {
      await stripe.prices.update(existing.stripePriceId, { active: false });
    }
    const newPrice = await stripe.prices.create({
      product: existing.stripeProductId!,
      unit_amount: data.priceEurCents,
      currency: "eur",
    });
    existing.stripePriceId = newPrice.id;
  }

  // If deactivated, archive Stripe Price
  if (data.isActive === false && existing.isActive && existing.stripePriceId) {
    await stripe.prices.update(existing.stripePriceId, { active: false });
  }

  Object.assign(existing, data);
  await existing.save();

  return NextResponse.json(existing);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();
  const pkg = await CoinPackage.findById(id);
  if (!pkg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft delete: deactivate instead of removing
  pkg.isActive = false;
  if (pkg.stripePriceId) {
    await stripe.prices.update(pkg.stripePriceId, { active: false });
  }
  await pkg.save();

  return NextResponse.json({ success: true });
}
