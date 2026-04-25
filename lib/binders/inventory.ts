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

export async function fetchInventory(): Promise<InventoryCard[]> {
  const url = "/api/collection?onlyFree=1";
  const out: InventoryCard[] = [];
  let cursor: string | null = null;
  let safety = 0;
  do {
    const next: string = cursor
      ? `${url}&cursor=${encodeURIComponent(cursor)}`
      : url;
    const res = await fetch(next);
    if (!res.ok) break;
    const data = (await res.json()) as {
      items: InventoryCard[];
      nextCursor: string | null;
    };
    out.push(...data.items);
    cursor = data.nextCursor;
    safety += 1;
  } while (cursor && safety < 50);
  return out;
}
