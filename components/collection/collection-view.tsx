"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, Library, Filter } from "lucide-react";

type PullStatus = "pending" | "claimed" | "converted" | "reserved";

interface CollectionItem {
  packPullId: string;
  cardId: string;
  name: string;
  game: string;
  set: string;
  setName: string;
  rarity: string;
  image: string | null;
  status: PullStatus;
  binderId: string | null;
  battleId: string | null;
  createdAt: string;
}

interface CollectionResponse {
  items: CollectionItem[];
  nextCursor: string | null;
}

interface CollectionViewProps {
  lang: string;
}

const PAGE_SIZE_HINT = 60;
const SEARCH_DEBOUNCE_MS = 250;

export function CollectionView({ lang }: CollectionViewProps) {
  const isDe = lang === "de";

  const [items, setItems] = useState<CollectionItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [game, setGame] = useState<string>("");
  const [rarity, setRarity] = useState<string>("");
  const [onlyFree, setOnlyFree] = useState(false);

  const requestIdRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const buildUrl = useCallback(
    (cursor: string | null) => {
      const url = new URL("/api/collection", window.location.origin);
      if (debouncedSearch) url.searchParams.set("q", debouncedSearch);
      if (game) url.searchParams.set("game", game);
      if (rarity) url.searchParams.set("rarity", rarity);
      if (onlyFree) url.searchParams.set("onlyFree", "1");
      if (cursor) url.searchParams.set("cursor", cursor);
      return url.toString();
    },
    [debouncedSearch, game, rarity, onlyFree],
  );

  useEffect(() => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    fetch(buildUrl(null))
      .then(async (res) => {
        if (!res.ok) throw new Error("fetch failed");
        return (await res.json()) as CollectionResponse;
      })
      .then((data) => {
        if (reqId !== requestIdRef.current) return;
        setItems(data.items);
        setNextCursor(data.nextCursor);
      })
      .catch(() => {
        if (reqId !== requestIdRef.current) return;
        setError(isDe ? "Konnte nicht laden." : "Could not load.");
      })
      .finally(() => {
        if (reqId === requestIdRef.current) setLoading(false);
      });
  }, [buildUrl, isDe]);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(nextCursor));
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as CollectionResponse;
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch {
      setError(isDe ? "Konnte nicht laden." : "Could not load.");
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, buildUrl, isDe]);

  const games = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) set.add(it.game);
    return Array.from(set).sort();
  }, [items]);
  const rarities = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) set.add(it.rarity);
    return Array.from(set).sort();
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Library className="w-7 h-7 text-pa-green" />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {isDe ? "Sammlung" : "Collection"}
          </h1>
          <p className="text-sm text-text-secondary">
            {isDe
              ? "Alle Karten aus deinen Battles und Pack-Öffnungen."
              : "Every card you won in battles and pack openings."}
          </p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isDe ? "Nach Karte suchen…" : "Search card…"}
            className="w-full bg-white/3 border border-white/8 text-text-primary rounded-[10px] pl-9 pr-3 py-2 outline-none focus:border-pa-green/35 focus:ring-2 focus:ring-pa-green/6"
          />
        </div>
        <select
          value={game}
          onChange={(e) => setGame(e.target.value)}
          className="bg-white/3 border border-white/8 text-text-primary rounded-[10px] px-3 py-2 outline-none"
        >
          <option value="">{isDe ? "Alle TCGs" : "All TCGs"}</option>
          {games.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={rarity}
          onChange={(e) => setRarity(e.target.value)}
          className="bg-white/3 border border-white/8 text-text-primary rounded-[10px] px-3 py-2 outline-none"
        >
          <option value="">{isDe ? "Alle Raritäten" : "All rarities"}</option>
          {rarities.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyFree}
            onChange={(e) => setOnlyFree(e.target.checked)}
            className="accent-pa-green"
          />
          <Filter className="w-4 h-4" />
          {isDe ? "Nur freie" : "Only free"}
        </label>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-pa-green mb-2" />
          <p className="text-sm text-text-muted">{isDe ? "Laden…" : "Loading…"}</p>
        </div>
      ) : error ? (
        <div className="py-16 text-center text-error">{error}</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <Library className="w-10 h-10 mx-auto text-text-muted mb-3" />
          <p className="text-text-muted">
            {isDe
              ? "Noch keine Karten. Öffne ein Pack oder gewinn ein Battle."
              : "No cards yet. Open a pack or win a battle."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {items.map((it) => (
              <CollectionCardTile key={it.packPullId} item={it} isDe={isDe} />
            ))}
          </div>

          {nextCursor && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="bg-pa-green text-bg font-bold text-sm px-6 py-3 rounded-xl hover:bg-pa-green-hover transition-colors disabled:opacity-60 inline-flex items-center gap-2"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                {loadingMore
                  ? isDe
                    ? "Laden…"
                    : "Loading…"
                  : isDe
                    ? "Mehr laden"
                    : "Load more"}
              </button>
            </div>
          )}

          <p className="text-xs text-text-muted text-center pt-2">
            {isDe
              ? `${items.length} Karten geladen${nextCursor ? "" : " — alles dabei."}`
              : `${items.length} cards loaded${nextCursor ? "" : " — that's everything."}`}
            {items.length >= PAGE_SIZE_HINT && nextCursor === null && ""}
          </p>
        </>
      )}
    </div>
  );
}

function CollectionCardTile({
  item,
  isDe,
}: {
  item: CollectionItem;
  isDe: boolean;
}) {
  const stateBadge = describeStateBadge(item, isDe);
  const dimmed = item.status === "converted";
  return (
    <div
      className={[
        "bg-surface border border-border rounded-xl overflow-hidden flex flex-col group hover:border-pa-green/30 transition-colors",
        dimmed ? "opacity-70" : "",
      ].join(" ")}
    >
      <div className="relative aspect-[5/7] bg-white/4 flex items-center justify-center">
        {item.image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.image}
            alt={item.name}
            className={[
              "object-contain w-full h-full",
              dimmed ? "grayscale" : "",
            ].join(" ")}
          />
        ) : (
          <Library className="w-8 h-8 text-text-muted" />
        )}
        {stateBadge && (
          <span
            className={[
              "absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
              stateBadge.tone,
            ].join(" ")}
          >
            {stateBadge.label}
          </span>
        )}
        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-black/70 text-text-primary border border-white/10">
          {item.rarity}
        </span>
      </div>
      <div className="p-2.5 space-y-0.5">
        <p
          className="text-[13px] font-semibold text-text-primary line-clamp-1"
          title={item.name}
        >
          {item.name}
        </p>
        <p
          className="text-[11px] text-text-muted line-clamp-1"
          title={item.setName}
        >
          {item.setName}
        </p>
      </div>
    </div>
  );
}

function describeStateBadge(
  item: CollectionItem,
  isDe: boolean,
): { label: string; tone: string } | null {
  if (item.binderId && item.status === "claimed") {
    return {
      label: isDe ? "im Binder" : "in binder",
      tone: "bg-black/70 text-pa-green border-pa-green/30",
    };
  }
  if (item.status === "pending") {
    return {
      label: isDe ? "ausstehend" : "pending",
      tone: "bg-black/70 text-amber-300 border-amber-400/30",
    };
  }
  if (item.status === "reserved") {
    return {
      label: isDe ? "im Versand" : "shipping",
      tone: "bg-black/70 text-sky-300 border-sky-400/30",
    };
  }
  if (item.status === "converted") {
    return {
      label: isDe ? "verkauft" : "sold",
      tone: "bg-black/70 text-text-muted border-white/15",
    };
  }
  if (item.battleId) {
    return {
      label: isDe ? "Battle" : "Battle",
      tone: "bg-black/70 text-rose-300 border-rose-400/30",
    };
  }
  return null;
}
