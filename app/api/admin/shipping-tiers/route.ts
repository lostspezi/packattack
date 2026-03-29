import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import ShippingTier from "@/models/shipping-tier";
import { shippingTierSchema } from "@/lib/validations";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    const tiers = await ShippingTier.find().sort({ country: 1, minCards: 1 }).lean();

    return NextResponse.json({
      tiers: tiers.map((t) => ({
        _id: t._id.toString(),
        country: t.country,
        minCards: t.minCards,
        maxCards: t.maxCards,
        costCents: t.costCents,
        costCoins: t.costCoins,
        isActive: t.isActive,
      })),
    });
  } catch (err) {
    console.error("[admin/shipping-tiers GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = shippingTierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.minCards > parsed.data.maxCards) {
    return NextResponse.json({ error: "minCards must be <= maxCards" }, { status: 400 });
  }

  try {
    await connectDB();

    const overlap = await ShippingTier.findOne({
      country: parsed.data.country,
      isActive: true,
      $or: [
        { minCards: { $lte: parsed.data.maxCards }, maxCards: { $gte: parsed.data.minCards } },
      ],
    });

    if (overlap) {
      return NextResponse.json({ error: "Overlapping tier exists for this country" }, { status: 409 });
    }

    const tier = await ShippingTier.create(parsed.data);
    return NextResponse.json({ _id: tier._id.toString() }, { status: 201 });
  } catch (err) {
    console.error("[admin/shipping-tiers POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
