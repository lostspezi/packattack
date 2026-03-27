import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Card from "@/models/card";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const allowedRoles = ["shop", "admin", "super_admin"];
  if (!session?.user || !role || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const game = searchParams.get("game")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ cards: [] });
  }

  try {
    await connectDB();

    const filter: Record<string, unknown> = {
      name: { $regex: q, $options: "i" },
    };
    if (game) filter.game = game;

    const cards = await Card.find(filter)
      .select("name game rarity image internalPrice")
      .limit(20)
      .lean();

    return NextResponse.json({
      cards: cards.map((c) => ({
        _id: c._id.toString(),
        name: c.name,
        game: c.game,
        rarity: c.rarity,
        image: c.image ?? null,
        internalPrice: c.internalPrice ?? null,
      })),
    });
  } catch (err) {
    console.error("[cards GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
