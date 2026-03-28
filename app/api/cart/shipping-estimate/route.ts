import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import CartItem from "@/models/cart-item";
import { calculateShippingCost } from "@/lib/shipping";
import { shippingEstimateSchema } from "@/lib/validations";

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

  const parsed = shippingEstimateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await connectDB();

    const cardCount = await CartItem.countDocuments({ userId, status: "reserved", expiresAt: { $gt: new Date() } });
    if (cardCount === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const cost = await calculateShippingCost(cardCount, parsed.data.country);

    return NextResponse.json({
      cardCount,
      costCents: cost.costCents,
      costCoins: cost.costCoins,
      tierFound: cost.tierFound,
    });
  } catch (err) {
    console.error("[cart/shipping-estimate POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
