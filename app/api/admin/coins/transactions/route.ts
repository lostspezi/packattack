import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import CoinTransaction from "@/models/coin-transaction";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10)));
  const userId = searchParams.get("userId") ?? "";
  const type = searchParams.get("type") ?? "";

  const query: Record<string, unknown> = {};
  if (userId) query.userId = userId;
  if (type) query.type = type;

  try {
    await connectDB();

    const [transactions, total] = await Promise.all([
      CoinTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("userId", "name email username image")
        .populate("performedBy", "name email username")
        .lean(),
      CoinTransaction.countDocuments(query),
    ]);

    return NextResponse.json({
      transactions: transactions.map((t) => ({
        _id: t._id.toString(),
        user: t.userId,
        amount: t.amount,
        type: t.type,
        reason: t.reason,
        performedBy: t.performedBy,
        createdAt: t.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[admin/coins/transactions GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
