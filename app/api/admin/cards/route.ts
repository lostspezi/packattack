import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Card from "@/models/card";

function isAdmin(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !isAdmin(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const game = (searchParams.get("game") ?? "").trim();
  const set = (searchParams.get("set") ?? "").trim();
  const rarity = (searchParams.get("rarity") ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  const filter: Record<string, unknown> = {};
  if (game) filter.game = game;
  if (set) filter.set = set;
  if (rarity) filter.rarity = rarity;
  if (q.length >= 2) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { setName: { $regex: escaped, $options: "i" } },
      { justTcgId: { $regex: `^${escaped}`, $options: "i" } },
    ];
  }

  try {
    await connectDB();
    const [cards, total] = await Promise.all([
      Card.find(filter)
        .select("_id justTcgId name game set setName rarity image tcgplayerId marketPrice")
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Card.countDocuments(filter),
    ]);

    return NextResponse.json({
      cards: cards.map((c) => ({
        _id: c._id.toString(),
        justTcgId: c.justTcgId,
        name: c.name,
        game: c.game,
        set: c.set,
        setName: c.setName,
        rarity: c.rarity,
        image: c.image ?? null,
        tcgplayerId: c.tcgplayerId ?? null,
        marketPrice: c.marketPrice ?? null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[admin/cards GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
