import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import UserInventory from "@/models/user-inventory";
import "@/models/card";
import "@/models/box";
import { expireOverduePulls } from "@/lib/expire-pulls";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10)));

  try {
    await connectDB();

    // Lazy expire overdue pulls
    await expireOverduePulls(userId);

    const [items, total] = await Promise.all([
      UserInventory.find({ userId })
        .sort({ claimedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("cardId", "name image rarity setName tcgplayerId marketPrice")
        .populate("boxId", "name game")
        .lean(),
      UserInventory.countDocuments({ userId }),
    ]);

    return NextResponse.json({
      items: items.map((item) => ({
        _id: item._id.toString(),
        card: item.cardId,
        box: item.boxId,
        rarity: item.rarity,
        claimedAt: item.claimedAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[inventory GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
