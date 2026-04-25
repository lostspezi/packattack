"use client";

import { useMemo, useState } from "react";
import { Heart, Layers } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type {
  BinderDTO,
  ExpectedCardDTO,
  PlacedCardDTO,
} from "./binder-editor";
import { BINDER_THEMES } from "./theme-picker";
import { BinderSpread } from "./binder-spread";
import { CompletionMeter } from "./completion-meter";

interface BinderViewerProps {
  binder: BinderDTO;
  placedCards: PlacedCardDTO[];
  expectedCards: ExpectedCardDTO[];
  lang: string;
  viewerId: string | null;
}

export function BinderViewer({
  binder: initial,
  placedCards,
  expectedCards,
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
  const expectedById = useMemo(() => {
    const map = new Map<string, ExpectedCardDTO>();
    for (const c of expectedCards) map.set(c.cardId, c);
    return map;
  }, [expectedCards]);
  const completion = useMemo(() => {
    if (binder.type !== "set-template") {
      return { matched: 0, expected: 0 };
    }
    let matched = 0;
    let expected = 0;
    for (const page of binder.pages) {
      for (const slot of page.slots) {
        if (!slot.expectedCardId) continue;
        expected += 1;
        if (!slot.packPullId) continue;
        const placed = cards.get(slot.packPullId);
        if (placed && placed.cardId === slot.expectedCardId) matched += 1;
      }
    }
    return { matched, expected };
  }, [binder, cards]);

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

      {binder.type === "set-template" && (
        <div>
          <CompletionMeter
            matched={completion.matched}
            expected={completion.expected}
            isDe={isDe}
          />
        </div>
      )}

      <BinderSpread
        theme={theme}
        pages={binder.pages}
        spreadIndex={spreadIndex}
        onSpreadChange={setSpreadIndex}
        cardLookup={(id) => cards.get(id)}
        expectedLookup={(id) => expectedById.get(id)}
        isDe={isDe}
      />
    </div>
  );
}
