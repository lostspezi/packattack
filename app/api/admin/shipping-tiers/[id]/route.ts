import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import ShippingTier from "@/models/shipping-tier";
import { shippingTierUpdateSchema } from "@/lib/validations";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = shippingTierUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  if (
    parsed.data.minCards !== undefined &&
    parsed.data.maxCards !== undefined &&
    parsed.data.minCards > parsed.data.maxCards
  ) {
    return NextResponse.json({ error: "minCards must be <= maxCards" }, { status: 400 });
  }

  try {
    await connectDB();

    const existing = await ShippingTier.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }

    // Check overlap if range or country changed
    const newCountry = parsed.data.country ?? existing.country;
    const newMin = parsed.data.minCards ?? existing.minCards;
    const newMax = parsed.data.maxCards ?? existing.maxCards;
    const newActive = parsed.data.isActive ?? existing.isActive;

    if (newActive) {
      const overlap = await ShippingTier.findOne({
        _id: { $ne: id },
        country: newCountry,
        isActive: true,
        minCards: { $lte: newMax },
        maxCards: { $gte: newMin },
      });

      if (overlap) {
        return NextResponse.json({ error: "Overlapping tier exists for this country" }, { status: 409 });
      }
    }

    const tier = await ShippingTier.findByIdAndUpdate(id, parsed.data, { returnDocument: "after" });

    return NextResponse.json({
      _id: tier!._id.toString(),
      country: tier!.country,
      minCards: tier!.minCards,
      maxCards: tier!.maxCards,
      costCents: tier!.costCents,
      costCoins: tier!.costCoins,
      isActive: tier!.isActive,
    });
  } catch (err) {
    console.error("[admin/shipping-tiers/[id] PUT]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
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

  try {
    await connectDB();

    const tier = await ShippingTier.findByIdAndDelete(id);
    if (!tier) {
      return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/shipping-tiers/[id] DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
