"use client";

import { useMemo, useState } from "react";
import { Heart, Layers } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type { BinderDTO, PlacedCardDTO } from "./binder-editor";
import { BINDER_THEMES } from "./theme-picker";
import { BinderSpread } from "./binder-spread";

interface BinderViewerProps {
  binder: BinderDTO;
  placedCards: PlacedCardDTO[];
  lang: string;
  viewerId: string | null;
}

export function BinderViewer({
  binder: initial,
  placedCards,
  lang,
  viewerId,
}: BinderViewerProps) {
  const isDe = lang === "de";
  const { toast } = useToast();
  const [binder, setBinder] = useState<BinderDTO>(initial);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [spreadIndex, setSpreadIndex] = useState(0);
  const cards = useMemo(() => {
    const map = new Map<string, PlacedCardDTO>();
    for (const c of placedCards) map.set(c.packPullId, c);
    return map;
  }, [placedCards]);

  async function toggleLike() {
    if (!viewerId) {
      toast({
        type: "info",
        title: isDe ? "Bitte einloggen." : "Please sign in.",
      });
      return;
    }
    setBusy(true);
    try {
      const method = liked ? "DELETE" : "POST";
      const res = await fetch(`/api/binders/${binder.slug}/like`, { method });
      if (!res.ok) throw new Error("like");
      const data = (await res.json()) as { likeCount?: number };
      setLiked((v) => !v);
      if (typeof data.likeCount === "number") {
        setBinder((b) => ({ ...b, likeCount: data.likeCount as number }));
      }
    } catch {
      toast({
        type: "error",
        title: isDe ? "Konnte nicht speichern." : "Could not save.",
      });
    } finally {
      setBusy(false);
    }
  }

  const theme =
    BINDER_THEMES.find((t) => t.key === binder.theme) ?? BINDER_THEMES[0];
  const totalSpreads = Math.max(1, Math.ceil(binder.pages.length / 2));
  const leftPageIndex = spreadIndex * 2;
  const rightPageIndex = leftPageIndex + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{binder.name}</h1>
          {binder.description && (
            <p className="text-sm text-text-secondary mt-1 max-w-2xl">
              {binder.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-secondary inline-flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            {binder.cardCount} {isDe ? "Karten" : "cards"}
          </span>
          <button
            type="button"
            onClick={toggleLike}
            disabled={busy}
            className={[
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              liked
                ? "bg-pa-green/10 text-pa-green"
                : "bg-white/5 text-text-primary hover:bg-white/10",
            ].join(" ")}
          >
            <Heart
              className={`w-4 h-4 ${liked ? "fill-current" : ""}`}
            />
            {binder.likeCount}
          </button>
        </div>
      </div>

      <BinderSpread
        theme={theme}
        leftPage={binder.pages[leftPageIndex] ?? null}
        rightPage={binder.pages[rightPageIndex] ?? null}
        leftPageIndex={leftPageIndex}
        rightPageIndex={rightPageIndex}
        cardLookup={(id) => cards.get(id)}
      />

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => setSpreadIndex((i) => Math.max(0, i - 1))}
          disabled={spreadIndex === 0}
          className="bg-surface border border-border rounded-lg px-3 py-1.5 hover:border-pa-green/30 disabled:opacity-40"
        >
          ‹
        </button>
        <span className="text-sm text-text-secondary">
          {leftPageIndex + 1} / {binder.pages.length}
        </span>
        <button
          type="button"
          onClick={() =>
            setSpreadIndex((i) => Math.min(totalSpreads - 1, i + 1))
          }
          disabled={spreadIndex >= totalSpreads - 1}
          className="bg-surface border border-border rounded-lg px-3 py-1.5 hover:border-pa-green/30 disabled:opacity-40"
        >
          ›
        </button>
      </div>
    </div>
  );
}
