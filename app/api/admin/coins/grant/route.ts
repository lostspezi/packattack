import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import CoinTransaction from "@/models/coin-transaction";

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const adminId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, amount, reason } = body as {
    userId?: string;
    amount?: number;
    reason?: string;
  };

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (amount === undefined || !Number.isInteger(amount) || amount === 0) {
    return NextResponse.json({ error: "amount must be a non-zero integer" }, { status: 400 });
  }
  if (!reason?.trim()) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  try {
    await connectDB();

    const user = await User.findById(userId).select("coins name email").lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent negative balance
    if (amount < 0 && (user.coins ?? 0) + amount < 0) {
      return NextResponse.json(
        { error: `Insufficient coins. User has ${user.coins ?? 0} coins, cannot deduct ${Math.abs(amount)}.` },
        { status: 400 }
      );
    }

    // Atomically update coins
    const updated = await User.findByIdAndUpdate(
      userId,
      { $inc: { coins: amount } },
      { returnDocument: "after" }
    );

    // Record transaction
    await CoinTransaction.create({
      userId,
      amount,
      type: amount > 0 ? "admin_grant" : "admin_deduct",
      reason: reason.trim(),
      performedBy: adminId,
    });

    return NextResponse.json({
      success: true,
      newBalance: updated?.coins ?? 0,
    });
  } catch (err) {
    console.error("[admin/coins/grant POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
