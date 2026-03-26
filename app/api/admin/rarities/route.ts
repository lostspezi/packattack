import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Rarity from "@/models/rarity";

export async function GET(request: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const game = searchParams.get("game");
  const q = searchParams.get("q");

  if (!game) {
    return NextResponse.json({ error: "game is required" }, { status: 400 });
  }

  try {
    await connectDB();

    const filter: Record<string, unknown> = { game };
    if (q) {
      filter.name = { $regex: q, $options: "i" };
    }

    const rarities = await Rarity.find(filter).sort({ name: 1 }).lean();

    return NextResponse.json({
      rarities: rarities.map((r) => ({ id: r._id.toString(), name: r.name, game: r.game })),
    });
  } catch (err) {
    console.error("[admin/rarities GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, game } = body as { name?: string; game?: string };

  if (!name?.trim() || !game?.trim()) {
    return NextResponse.json({ error: "name and game are required" }, { status: 400 });
  }

  try {
    await connectDB();

    const rarity = await Rarity.findOneAndUpdate(
      { name: name.trim(), game: game.trim() },
      { $setOnInsert: { name: name.trim(), game: game.trim() } },
      { upsert: true, returnDocument: "after" }
    );

    return NextResponse.json({
      id: rarity!._id.toString(),
      name: rarity!.name,
      game: rarity!.game,
    }, { status: 201 });
  } catch (err) {
    console.error("[admin/rarities POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
