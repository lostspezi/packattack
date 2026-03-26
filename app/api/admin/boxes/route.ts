import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Box from "@/models/box";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));
  const game = searchParams.get("game") ?? "";
  const status = searchParams.get("status") ?? "";
  const search = searchParams.get("search") ?? "";

  const query: Record<string, unknown> = {};

  if (game) query.game = game;
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { "name.de": { $regex: search, $options: "i" } },
      { "name.en": { $regex: search, $options: "i" } },
    ];
  }

  try {
    await connectDB();

    const [boxes, total] = await Promise.all([
      Box.find(query)
        .select(
          "_id name game status priceInCoins cardsPerPack totalPacks packsOpened cards createdAt"
        )
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      Box.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      boxes: boxes.map((b) => ({
        _id: b._id.toString(),
        name: b.name,
        game: b.game,
        status: b.status,
        priceInCoins: b.priceInCoins,
        cardsPerPack: b.cardsPerPack,
        totalPacks: b.totalPacks,
        packsOpened: b.packsOpened,
        cardsCount: Array.isArray(b.cards) ? b.cards.length : 0,
        createdAt: b.createdAt,
      })),
      total,
      page,
      totalPages,
    });
  } catch (err) {
    console.error("[admin/boxes GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    name,
    description,
    game,
    priceInCoins,
    cardsPerPack,
    totalPacks,
    rarityWeights,
  } = body as {
    name?: { de: string; en: string };
    description?: { de: string; en: string };
    game?: string;
    priceInCoins?: number;
    cardsPerPack?: number;
    totalPacks?: number | null;
    rarityWeights?: Array<{ rarity: string; weight: number }>;
  };

  if (!name?.de || !name?.en) {
    return NextResponse.json(
      { error: "name.de and name.en are required" },
      { status: 400 }
    );
  }
  if (!game) {
    return NextResponse.json({ error: "game is required" }, { status: 400 });
  }
  if (priceInCoins === undefined || priceInCoins === null) {
    return NextResponse.json(
      { error: "priceInCoins is required" },
      { status: 400 }
    );
  }
  if (!cardsPerPack) {
    return NextResponse.json(
      { error: "cardsPerPack is required" },
      { status: 400 }
    );
  }
  if (!Array.isArray(rarityWeights) || rarityWeights.length === 0) {
    return NextResponse.json(
      { error: "rarityWeights is required" },
      { status: 400 }
    );
  }

  const weightSum = rarityWeights.reduce((acc, rw) => acc + (rw.weight ?? 0), 0);
  if (weightSum !== 100) {
    return NextResponse.json(
      { error: "rarityWeights must sum to 100" },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    const box = await Box.create({
      name,
      description: description ?? null,
      game,
      priceInCoins,
      cardsPerPack,
      totalPacks: totalPacks ?? null,
      rarityWeights,
      status: "draft",
      packsOpened: 0,
      cards: [],
      createdBy: userId,
    });

    return NextResponse.json(box.toObject(), { status: 201 });
  } catch (err) {
    console.error("[admin/boxes POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
