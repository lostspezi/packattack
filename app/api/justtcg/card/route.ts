import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRedis } from "@/lib/redis";

const BASE_URL = "https://api.justtcg.com/v1";

// Fetch a single card with full variant data (including price history) live from JustTCG
export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const game = searchParams.get("game");
  const cardName = searchParams.get("name");
  const cardSet = searchParams.get("set");

  if (!game || !cardName) {
    return NextResponse.json({ error: "game and name parameters required" }, { status: 400 });
  }

  // Short cache (2 min) to avoid hammering the API on repeated clicks
  const cacheKey = `justtcg:card-detail:${game}:${cardSet ?? ""}:${cardName}`;
  const redis = getRedis();

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return NextResponse.json(JSON.parse(cached));
    }
  } catch { /* ignore cache miss */ }

  try {
    const apiKey = process.env.JUSTTCG_API_KEY ?? "";
    const params = new URLSearchParams({ game, search: cardName, limit: "5" });
    if (cardSet) params.set("set", cardSet);
    const res = await fetch(`${BASE_URL}/cards?${params.toString()}`, {
      headers: { "X-API-Key": apiKey },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }

    const data = await res.json() as { data?: Array<Record<string, unknown>> };
    const cards = data.data ?? [];

    if (cards.length === 0) {
      return NextResponse.json({ error: "card_not_found" }, { status: 404 });
    }

    // Find exact name match first, fallback to first result
    const exactMatch = cards.find((c) => (c.name as string) === cardName);
    const card = exactMatch ?? cards[0];

    // Normalize variants
    const variants = Array.isArray(card.variants) ? (card.variants as Array<Record<string, unknown>>).map((v) => ({
      condition: (v.condition as string) ?? "",
      printing: (v.printing as string) ?? "",
      price: (v.price as number) ?? 0,
      priceHistory: Array.isArray(v.priceHistory) ? v.priceHistory : [],
      priceHistory30d: Array.isArray(v.priceHistory30d) ? v.priceHistory30d : [],
      priceChange7d: v.priceChange7d ?? null,
      priceChange30d: v.priceChange30d ?? null,
      priceChange90d: v.priceChange90d ?? null,
      avgPrice: v.avgPrice ?? null,
      avgPrice30d: v.avgPrice30d ?? null,
      minPrice7d: v.minPrice7d ?? null,
      maxPrice7d: v.maxPrice7d ?? null,
    })) : [];

    const result = {
      id: card.id,
      name: card.name,
      game: card.game,
      set: card.set,
      setName: card.set_name ?? card.setName,
      rarity: card.rarity,
      tcgplayerId: card.tcgplayerId,
      variants,
    };

    // Cache for 2 minutes
    try {
      await redis.set(cacheKey, JSON.stringify({ card: result }), "EX", 120);
    } catch { /* ignore */ }

    return NextResponse.json({ card: result });
  } catch (err) {
    console.error("[justtcg/card GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
