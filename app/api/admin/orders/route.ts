import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Order from "@/models/order";
import "@/models/card";
import "@/models/user";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10)));
  const status = searchParams.get("status") ?? "";
  const userId = searchParams.get("userId") ?? "";

  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (userId) query.userId = userId;

  try {
    await connectDB();

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("userId", "name username email")
        .populate("items.cardId", "name image rarity")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    return NextResponse.json({
      orders: orders.map((o) => ({
        ...o,
        _id: o._id.toString(),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[admin/orders GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
