import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import CoinPurchase from "@/models/coin-purchase";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const status = searchParams.get("status");
  const userId = searchParams.get("userId");

  await connectDB();

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (userId) filter.userId = userId;

  const [purchases, total] = await Promise.all([
    CoinPurchase.find(filter)
      .populate("userId", "name email username")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CoinPurchase.countDocuments(filter),
  ]);

  return NextResponse.json({
    purchases,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
