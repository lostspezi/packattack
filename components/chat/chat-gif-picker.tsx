"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Loader2, Search, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessageGif } from "@/components/chat/chat-message-gif";
import type { ChatUiCopy } from "@/lib/chat-copy";
import type {
  ChatGifFavoritesResponse,
  ChatGifPickerResponse,
  ChatGifSummary,
} from "@/types/chat";

interface ChatGifPickerProps {
  open: boolean;
  onClose: () => void;
  onAttach: (gif: ChatGifSummary) => void;
  copy: ChatUiCopy;
  anchorRef: RefObject<HTMLElement | null>;
}

const DEFAULT_RESULTS: ChatGifPickerResponse = {
  gifs: [],
  mode: "trending",
  query: "",
  offset: 0,
  nextOffset: null,
  total: 0,
};

function filterFavorites(favorites: ChatGifSummary[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return favorites;
  }

  return favorites.filter((gif) => gif.title.toLowerCase().includes(normalized));
}

export function ChatGifPicker({
  open,
  onClose,
  onAttach,
  copy,
  anchorRef,
}: ChatGifPickerProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [results, setResults] = useState<ChatGifPickerResponse>(DEFAULT_RESULTS);
  const [favorites, setFavorites] = useState<ChatGifSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoriteMutationId, setFavoriteMutationId] = useState<string | null>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const visibleFavorites = useMemo(
    () => filterFavorites(favorites, query),
    [favorites, query]
  );
  const visibleGifs = favoritesOnly ? visibleFavorites : results.gifs;

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor || typeof window === "undefined") {
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const preferredWidth = Math.max(340, Math.min(420, rect.width + 120));
    const width = Math.min(preferredWidth, window.innerWidth - 16);
    const estimatedHeight = Math.min(460, panelRef.current?.offsetHeight ?? 420);
    const shouldOpenUpward =
      rect.top > estimatedHeight + 16 ||
      window.innerHeight - rect.bottom < estimatedHeight + 16;
    const left = Math.min(
      window.innerWidth - width - 8,
      Math.max(8, rect.right - width)
    );

    setPanelStyle({
      position: "fixed",
      left,
      width,
      maxWidth: window.innerWidth - 16,
      maxHeight: Math.min(estimatedHeight, window.innerHeight - 24),
      zIndex: 96,
      ...(shouldOpenUpward
        ? { bottom: window.innerHeight - rect.top + 10 }
        : { top: rect.bottom + 10 }),
    });
  }, [anchorRef]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      setFavoritesOnly(false);
      setError(null);
      setResults(DEFAULT_RESULTS);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      updatePosition();
      searchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    updatePosition();
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, onClose, open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 275);

    return () => window.clearTimeout(timeout);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadFavorites() {
      setFavoritesLoading(true);
      try {
        const res = await fetch("/api/chat/gifs/favorites", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("favorites_failed");
        }
        const payload = (await res.json()) as ChatGifFavoritesResponse;
        if (!cancelled) {
          setFavorites(payload.gifs);
        }
      } catch {
        if (!cancelled) {
          setError(copy.gifs.loadError);
        }
      } finally {
        if (!cancelled) {
          setFavoritesLoading(false);
        }
      }
    }

    void loadFavorites();

    return () => {
      cancelled = true;
    };
  }, [copy.gifs.loadError, open]);

  useEffect(() => {
    if (!open || favoritesOnly) return;

    let cancelled = false;

    async function loadInitialResults() {
      setLoading(true);
      setError(null);
      try {
        const searchParams = new URLSearchParams();
        if (debouncedQuery) {
          searchParams.set("mode", "search");
          searchParams.set("q", debouncedQuery);
        } else {
          searchParams.set("mode", "trending");
        }

        const res = await fetch(`/api/chat/gifs?${searchParams.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("load_failed");
        }
        const payload = (await res.json()) as ChatGifPickerResponse;
        if (!cancelled) {
          setResults(payload);
        }
      } catch {
        if (!cancelled) {
          setError(copy.gifs.loadError);
          setResults({
            ...DEFAULT_RESULTS,
            mode: debouncedQuery ? "search" : "trending",
            query: debouncedQuery,
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialResults();

    return () => {
      cancelled = true;
    };
  }, [copy.gifs.loadError, debouncedQuery, favoritesOnly, open]);

  async function loadMore() {
    if (favoritesOnly || loadingMore || results.nextOffset === null) {
      return;
    }

    setLoadingMore(true);
    try {
      const searchParams = new URLSearchParams({
        mode: debouncedQuery ? "search" : "trending",
        offset: String(results.nextOffset),
      });
      if (debouncedQuery) {
        searchParams.set("q", debouncedQuery);
      }

      const res = await fetch(`/api/chat/gifs?${searchParams.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("load_failed");
      }
      const payload = (await res.json()) as ChatGifPickerResponse;
      setResults((current) => ({
        ...payload,
        gifs: [
          ...current.gifs,
          ...payload.gifs.filter(
            (gif) => !current.gifs.some((existing) => existing.id === gif.id)
          ),
        ],
      }));
    } catch {
      setError(copy.gifs.loadError);
    } finally {
      setLoadingMore(false);
    }
  }

  function isFavorite(gif: ChatGifSummary) {
    return favorites.some((favorite) => favorite.id === gif.id);
  }

  async function toggleFavorite(gif: ChatGifSummary) {
    if (favoriteMutationId === gif.id) {
      return;
    }

    const saved = isFavorite(gif);
    setFavoriteMutationId(gif.id);
    try {
      const res = await fetch(
        saved ? `/api/chat/gifs/favorites/${encodeURIComponent(gif.id)}` : "/api/chat/gifs/favorites",
        {
          method: saved ? "DELETE" : "POST",
          headers: saved ? undefined : { "Content-Type": "application/json" },
          body: saved ? undefined : JSON.stringify(gif),
        }
      );
      if (!res.ok) {
        throw new Error("favorite_failed");
      }
      const payload = (await res.json()) as ChatGifFavoritesResponse;
      setFavorites(payload.gifs);
    } catch {
      setError(copy.gifs.favoriteError);
    } finally {
      setFavoriteMutationId(null);
    }
  }

  function handleAttach(gif: ChatGifSummary) {
    onAttach(gif);
    onClose();
  }

  const showEmptyState = !loading && !favoritesLoading && visibleGifs.length === 0;

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      style={panelStyle}
      className="overflow-hidden rounded-[18px] border border-white/10 bg-surface-elevated/98 shadow-2xl shadow-black/35 ring-1 ring-white/8 backdrop-blur-xl"
    >
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary">{copy.gifs.title}</p>
            <p className="text-xs text-text-muted">{copy.gifs.poweredBy}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-white/4 text-text-muted transition-colors hover:text-pa-green"
            aria-label={copy.page.collapse}
            title={copy.page.collapse}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex-1">
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.gifs.searchPlaceholder}
              className="w-full"
            />
          </div>
          <button
            type="button"
            onClick={() => setFavoritesOnly((current) => !current)}
            className={[
              "inline-flex items-center gap-2 rounded-[10px] border px-4 py-3 text-sm font-medium transition-colors",
              favoritesOnly
                ? "border-pa-green/20 bg-pa-green/12 text-pa-green"
                : "border-white/8 bg-white/4 text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            <Star className={`h-4 w-4 ${favoritesOnly ? "fill-current" : ""}`} />
            {copy.gifs.favorites}
          </button>
        </div>

        {error ? (
          <div className="rounded-[12px] border border-red-500/15 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading || favoritesLoading ? (
          <div className="flex min-h-[220px] items-center justify-center text-text-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : showEmptyState ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-[14px] border border-white/6 bg-black/10 px-4 text-center text-sm text-text-muted">
            {favoritesOnly
              ? copy.gifs.emptyFavorites
              : debouncedQuery
                ? copy.gifs.emptySearch
                : copy.gifs.emptyTrending}
          </div>
        ) : (
          <div className="grid max-h-[320px] grid-cols-2 gap-3 overflow-y-auto pr-1">
            {visibleGifs.map((gif) => {
              const saved = isFavorite(gif);
              const saving = favoriteMutationId === gif.id;
              return (
                <div
                  key={`${gif.provider}-${gif.id}`}
                  className="group relative overflow-hidden rounded-[14px] border border-white/8 bg-black/10 text-left transition-colors hover:border-pa-green/20"
                >
                  <span className="absolute right-2 top-2 z-10">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void toggleFavorite(gif);
                      }}
                      disabled={saving}
                      className={[
                        "inline-flex h-8 w-8 items-center justify-center rounded-full border bg-black/55 backdrop-blur transition-colors",
                        saved
                          ? "border-pa-green/20 text-pa-green"
                          : "border-white/12 text-white/80 hover:text-pa-green",
                        saving ? "opacity-60" : "",
                      ].join(" ")}
                      aria-label={saved ? copy.gifs.removeFavorite : copy.gifs.saveFavorite}
                      title={saved ? copy.gifs.removeFavorite : copy.gifs.saveFavorite}
                    >
                      <Star className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
                    </button>
                  </span>
                  <button type="button" onClick={() => handleAttach(gif)} className="block w-full text-left">
                    <ChatMessageGif
                      gif={gif}
                      linkToSource={false}
                      className="rounded-none border-none bg-transparent"
                      imageClassName="min-h-[120px]"
                    />
                    <div className="flex items-center gap-2 border-t border-white/6 px-3 py-2">
                      <Search className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      <span className="truncate text-xs text-text-secondary">{gif.title}</span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!favoritesOnly && results.nextOffset !== null && !loading ? (
          <div className="flex justify-center">
            <Button size="sm" variant="secondary" onClick={loadMore} loading={loadingMore}>
              {copy.gifs.loadMore}
            </Button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
