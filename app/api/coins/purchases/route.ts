import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import CoinPurchase from "@/models/coin-purchase";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
  const sessionId = searchParams.get("sessionId");

  await connectDB();

  // If sessionId provided, return that specific purchase (for polling after checkout)
  if (sessionId) {
    const purchase = await CoinPurchase.findOne({
      userId,
      stripeSessionId: sessionId,
    }).lean();
    return NextResponse.json({ purchase });
  }

  const [purchases, total] = await Promise.all([
    CoinPurchase.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CoinPurchase.countDocuments({ userId }),
  ]);

  return NextResponse.json({
    purchases,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
