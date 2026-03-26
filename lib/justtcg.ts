import { createHash } from "crypto";
import { getRedis } from "@/lib/redis";

const BASE_URL = "https://api.justtcg.com/v1";

function getApiKey(): string {
  return process.env.JUSTTCG_API_KEY ?? "";
}

async function fetchJustTCG<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        "X-API-Key": getApiKey(),
      },
    });

    if (!res.ok) {
      console.error(
        `[JustTCG] Request failed: ${res.status} ${res.statusText} — ${path}`
      );
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.error(`[JustTCG] Fetch error for ${path}:`, err);
    return null;
  }
}

async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T | null>
): Promise<T | null> {
  const redis = getRedis();

  try {
    const hit = await redis.get(key);
    if (hit !== null) {
      return JSON.parse(hit) as T;
    }
  } catch (err) {
    console.error(`[JustTCG] Redis get error for key ${key}:`, err);
  }

  const data = await fetcher();

  if (data !== null) {
    try {
      await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
    } catch (err) {
      console.error(`[JustTCG] Redis set error for key ${key}:`, err);
    }
  }

  return data;
}

export interface JustTCGGame {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface JustTCGSet {
  id: string;
  slug: string;
  name: string;
  game: string;
  [key: string]: unknown;
}

export interface JustTCGCardVariant {
  condition: string;
  printing: string;
  price: number;
}

export interface JustTCGCard {
  id: string;
  name: string;
  game: string;
  set: string;
  setName: string;
  rarity: string;
  image: string | null;
  tcgplayerId: string | null;
  marketPrice: number | null;
  variants: JustTCGCardVariant[];
  [key: string]: unknown;
}

export interface JustTCGCardsResponse {
  cards: JustTCGCard[];
  total?: number;
  page?: number;
  limit?: number;
}

export interface SearchCardsParams {
  game?: string;
  set?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getGames(): Promise<JustTCGGame[] | null> {
  return cached<JustTCGGame[]>("justtcg:games", 3600, async () => {
    const res = await fetchJustTCG<{ data: JustTCGGame[] } | JustTCGGame[]>("/games");
    if (!res) return null;
    // API wraps response in { data: [...] }
    return Array.isArray(res) ? res : res.data ?? null;
  });
}

export async function getRarities(game: string): Promise<string[] | null> {
  const cacheKey = `justtcg:rarities:${game}`;
  return cached<string[]>(cacheKey, 3600, async () => {
    // Fetch a large sample of cards to extract unique rarities
    const res = await fetchJustTCG<{ data: Array<{ rarity: string }> }>(`/cards?game=${encodeURIComponent(game)}&limit=100`);
    if (!res || !res.data) return null;
    const rarities = [...new Set(res.data.map((c) => c.rarity).filter(Boolean))].sort();
    return rarities.length > 0 ? rarities : null;
  });
}

export async function getSets(game: string): Promise<JustTCGSet[] | null> {
  const cacheKey = `justtcg:sets:${game}`;
  return cached<JustTCGSet[]>(cacheKey, 3600, async () => {
    const res = await fetchJustTCG<{ data: JustTCGSet[] } | JustTCGSet[]>(`/sets?game=${encodeURIComponent(game)}`);
    if (!res) return null;
    return Array.isArray(res) ? res : res.data ?? null;
  });
}

export async function searchCards(
  params: SearchCardsParams
): Promise<JustTCGCardsResponse | null> {
  const query = new URLSearchParams();
  if (params.game) query.set("game", params.game);
  if (params.set) query.set("set", params.set);
  if (params.search) query.set("search", params.search);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.limit !== undefined) query.set("limit", String(params.limit));

  const queryString = query.toString();
  const hash = createHash("sha256").update(queryString).digest("hex");
  const cacheKey = `justtcg:cards:search:${hash}`;

  return cached<JustTCGCardsResponse>(cacheKey, 300, async () => {
    const res = await fetchJustTCG<{ data: JustTCGCard[]; meta?: { total?: number; page?: number; limit?: number } }>(`/cards${queryString ? `?${queryString}` : ""}`);
    if (!res) return null;
    const cards = Array.isArray(res) ? res as unknown as JustTCGCard[] : res.data ?? [];
    return {
      cards,
      total: res.meta?.total,
      page: res.meta?.page,
      limit: res.meta?.limit,
    } as JustTCGCardsResponse;
  });
}

export async function getCard(id: string): Promise<JustTCGCard | null> {
  const cacheKey = `justtcg:card:${id}`;
  return cached<JustTCGCard>(cacheKey, 300, async () => {
    const res = await fetchJustTCG<{ data: JustTCGCard } | JustTCGCard>(`/cards/${encodeURIComponent(id)}`);
    if (!res) return null;
    // Single card may be wrapped in { data: {...} }
    if ("data" in res && !("name" in res)) return (res as { data: JustTCGCard }).data;
    return res as JustTCGCard;
  });
}
