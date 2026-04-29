import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import PackPull from "@/models/pack-pull";
import "@/models/card";
import "@/models/box";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") ?? "";
  const isGodpackParam = searchParams.get("isGodpack");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10)));

  try {
    await connectDB();

    const query: Record<string, unknown> = { userId };
    if (status) query.status = status;
    if (isGodpackParam === "true") query.isGodpack = true;
    else if (isGodpackParam === "false") query.isGodpack = { $ne: true };

    const [pulls, total] = await Promise.all([
      PackPull.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("cardId", "name image rarity setName")
        .populate("boxId", "name")
        .lean(),
      PackPull.countDocuments(query),
    ]);

    return NextResponse.json({
      pulls: pulls.map((p) => ({
        _id: p._id.toString(),
        card: p.cardId,
        box: p.boxId,
        rarity: p.rarity,
        coinValue: p.coinValue,
        conversionValue: p.conversionValue,
        status: p.status,
        decidedAt: p.decidedAt,
        packGroupId: p.packGroupId,
        packIndex: p.packIndex,
        cardIndex: p.cardIndex,
        createdAt: p.createdAt,
        isGodpack: p.isGodpack ?? false,
        godpackEventId: p.godpackEventId ? p.godpackEventId.toString() : null,
        godpackPosition: p.godpackPosition ?? null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[pulls GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
