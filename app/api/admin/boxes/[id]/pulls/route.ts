import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import PackPull from "@/models/pack-pull";
import "@/models/card";
import "@/models/user";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: boxId } = await params;
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10)));
  const status = searchParams.get("status") ?? "";
  const userId = searchParams.get("userId") ?? "";
  const rarity = searchParams.get("rarity") ?? "";

  const query: Record<string, unknown> = { boxId };
  if (status) query.status = status;
  if (userId) query.userId = userId;
  if (rarity) query.rarity = rarity;

  try {
    await connectDB();

    const [pulls, total] = await Promise.all([
      PackPull.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("userId", "name email username image")
        .populate("cardId", "name image rarity")
        .lean(),
      PackPull.countDocuments(query),
    ]);

    return NextResponse.json({
      pulls: pulls.map((p) => ({
        _id: p._id.toString(),
        user: p.userId,
        card: p.cardId,
        rarity: p.rarity,
        coinValue: p.coinValue,
        conversionValue: p.conversionValue,
        status: p.status,
        decidedAt: p.decidedAt,
        packGroupId: p.packGroupId,
        ipAddress: p.ipAddress,
        userAgent: p.userAgent,
        createdAt: p.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[admin/boxes/[id]/pulls GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
