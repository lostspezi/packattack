import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import CartItem from "@/models/cart-item";
import "@/models/card";
import "@/models/box";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const now = Date.now();
    const items = await CartItem.find({ userId, status: "reserved" })
      .populate("cardId", "name image rarity setName")
      .populate("boxId", "name game")
      .sort({ expiresAt: 1 })
      .lean();

    return NextResponse.json({
      items: items.map((item) => ({
        _id: item._id.toString(),
        card: item.cardId,
        box: item.boxId,
        rarity: item.rarity,
        conversionValue: item.conversionValue,
        expiresAt: item.expiresAt,
        remainingSeconds: Math.max(0, Math.floor((new Date(item.expiresAt).getTime() - now) / 1000)),
        createdAt: item.createdAt,
      })),
      totalItems: items.length,
    });
  } catch (err) {
    console.error("[cart GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
