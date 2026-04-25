export interface InventoryCard {
  packPullId: string;
  cardId: string;
  name: string;
  game: string;
  set: string;
  setName: string;
  rarity: string;
  image: string | null;
  createdAt: string;
}

export interface CollectionMeta {
  games: string[];
  setsByGame: Record<string, string[]>;
  rarities: string[];
}

export interface InventoryPageParams {
  cursor?: string | null;
  game?: string;
  set?: string;
  rarity?: string;
  q?: string;
}

export async function fetchInventoryPage(
  params: InventoryPageParams = {},
): Promise<{ items: InventoryCard[]; nextCursor: string | null }> {
  const url = new URL("/api/collection", window.location.origin);
  url.searchParams.set("onlyFree", "1");
  if (params.cursor) url.searchParams.set("cursor", params.cursor);
  if (params.game) url.searchParams.set("game", params.game);
  if (params.set) url.searchParams.set("set", params.set);
  if (params.rarity) url.searchParams.set("rarity", params.rarity);
  if (params.q) url.searchParams.set("q", params.q);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("inventory fetch failed");
  return res.json() as Promise<{ items: InventoryCard[]; nextCursor: string | null }>;
}

export async function fetchCollectionMeta(): Promise<CollectionMeta> {
  const res = await fetch("/api/collection/meta");
  if (!res.ok) throw new Error("meta fetch failed");
  return res.json() as Promise<CollectionMeta>;
}
