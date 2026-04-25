"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Compass,
  Heart,
  Layers,
  Loader2,
  Sparkles,
  Eye,
} from "lucide-react";
import { BINDER_THEMES } from "./theme-picker";

interface ExploreBinder {
  _id: string;
  slug: string;
  name: string;
  description: string;
  type: "free" | "set-template";
  setTemplate: { game: string; set: string } | null;
  theme: string;
  coverPackPullId: string | null;
  isPublic: boolean;
  cardCount: number;
  pageCount: number;
  likeCount: number;
  viewCount: number;
  updatedAt: string;
}

interface ExploreViewProps {
  lang: string;
}

type SortMode = "recent" | "top";

export function ExploreView({ lang }: ExploreViewProps) {
  const isDe = lang === "de";
  const [items, setItems] = useState<ExploreBinder[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("recent");
  const [game, setGame] = useState<string>("");
  const [knownGames, setKnownGames] = useState<string[]>([]);

  const buildUrl = useCallback(
    (cursor: string | null) => {
      const url = new URL("/api/binders/explore", window.location.origin);
      url.searchParams.set("sort", sort);
      if (game) url.searchParams.set("game", game);
      if (cursor) url.searchParams.set("cursor", cursor);
      return url.toString();
    },
    [sort, game],
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(buildUrl(null))
      .then(async (res) => {
        if (!res.ok) throw new Error();
        return (await res.json()) as {
          binders: ExploreBinder[];
          nextCursor: string | null;
        };
      })
      .then((data) => {
        setItems(data.binders);
        setNextCursor(data.nextCursor);
        const games = new Set<string>();
        for (const b of data.binders) {
          if (b.setTemplate?.game) games.add(b.setTemplate.game);
        }
        setKnownGames((prev) => {
          const merged = new Set(prev);
          for (const g of games) merged.add(g);
          return Array.from(merged).sort();
        });
      })
      .catch(() =>
        setError(isDe ? "Konnte nicht laden." : "Could not load."),
      )
      .finally(() => setLoading(false));
  }, [buildUrl, isDe]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(nextCursor));
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        binders: ExploreBinder[];
        nextCursor: string | null;
      };
      setItems((prev) => [...prev, ...data.binders]);
      setNextCursor(data.nextCursor);
    } catch {
      setError(isDe ? "Konnte nicht laden." : "Could not load.");
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, buildUrl, isDe]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Compass className="w-7 h-7 text-pa-green" />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {isDe ? "Binder entdecken" : "Discover binders"}
          </h1>
          <p className="text-sm text-text-secondary">
            {isDe
              ? "Was die Community so kuratiert."
              : "What the community curates."}
          </p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => setSort("recent")}
            className={[
              "px-3 py-1.5 rounded-md transition-colors inline-flex items-center gap-1.5",
              sort === "recent"
                ? "bg-pa-green/15 text-pa-green"
                : "text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isDe ? "Neueste" : "Recent"}
          </button>
          <button
            type="button"
            onClick={() => setSort("top")}
            className={[
              "px-3 py-1.5 rounded-md transition-colors inline-flex items-center gap-1.5",
              sort === "top"
                ? "bg-pa-green/15 text-pa-green"
                : "text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            <Heart className="w-3.5 h-3.5" />
            {isDe ? "Top" : "Top"}
          </button>
        </div>
        <select
          value={game}
          onChange={(e) => setGame(e.target.value)}
          className="bg-white/3 border border-white/8 text-text-primary rounded-[10px] px-3 py-1.5 text-sm outline-none"
        >
          <option value="">{isDe ? "Alle TCGs" : "All TCGs"}</option>
          {knownGames.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-pa-green mb-2" />
          <p className="text-sm text-text-muted">
            {isDe ? "Laden…" : "Loading…"}
          </p>
        </div>
      ) : error ? (
        <div className="py-16 text-center text-error">{error}</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <BookOpen className="w-10 h-10 mx-auto text-text-muted mb-3" />
          <p className="text-text-muted">
            {isDe
              ? "Noch nichts veröffentlicht. Setz einen deiner Binder auf öffentlich!"
              : "Nothing published yet. Make one of yours public!"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((b) => (
              <ExploreTile key={b._id} binder={b} lang={lang} isDe={isDe} />
            ))}
          </div>
          {nextCursor && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="bg-pa-green text-bg font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-pa-green-hover disabled:opacity-60 inline-flex items-center gap-2"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                {isDe ? "Mehr" : "More"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ExploreTile({
  binder,
  lang,
  isDe,
}: {
  binder: ExploreBinder;
  lang: string;
  isDe: boolean;
}) {
  const theme =
    BINDER_THEMES.find((t) => t.key === binder.theme) ?? BINDER_THEMES[0];
  return (
    <Link
      href={`/${lang}/b/${binder.slug}`}
      className="bg-surface border border-border rounded-xl overflow-hidden hover:border-pa-green/30 hover:-translate-y-1 transition-all duration-300 flex flex-col"
    >
      <div
        className={`relative h-36 ${theme.swatchClass} flex items-center justify-center`}
      >
        <BookOpen className="w-10 h-10 text-white/80" />
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white border border-white/15">
          {binder.type === "set-template"
            ? binder.setTemplate
              ? `${binder.setTemplate.game} · Set`
              : "Set"
            : isDe
              ? "Frei"
              : "Free"}
        </span>
      </div>
      <div className="p-3.5 space-y-1">
        <h3 className="text-sm font-bold text-text-primary line-clamp-1">
          {binder.name}
        </h3>
        <p className="text-xs text-text-muted line-clamp-2 min-h-[2em]">
          {binder.description ||
            (isDe ? "Keine Beschreibung." : "No description.")}
        </p>
        <div className="flex items-center justify-between text-xs text-text-secondary pt-1">
          <span className="inline-flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            {binder.cardCount}
          </span>
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Heart className="w-3.5 h-3.5" />
              {binder.likeCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {binder.viewCount}
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
