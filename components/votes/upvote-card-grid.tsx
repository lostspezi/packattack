"use client";

import { useCallback, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface CampaignCard {
  _id: string;
  source: "internal" | "justtcg";
  name: string;
  game: string;
  set: string;
  setName: string;
  rarity: string;
  image: string | null;
  tcgplayerId: string | null;
  position: number;
}

interface Props {
  lang: string;
  dict: Record<string, string>;
  campaignId: string;
  topN: number;
  cards: CampaignCard[];
  initialPicks: string[];
}

export function UpvoteCardGrid({
  lang,
  dict,
  campaignId,
  topN,
  cards,
  initialPicks,
}: Props) {
  const isDe = lang === "de";
  const { toast } = useToast();
  const [picks, setPicks] = useState<Set<string>>(new Set(initialPicks));
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);

  const counterText = useMemo(() => {
    return (dict["selectionCounter"] ?? "{{selected}} of {{max}} selected")
      .replace("{{selected}}", String(picks.size))
      .replace("{{max}}", String(topN));
  }, [dict, picks.size, topN]);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(picks);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= topN) {
          toast({
            type: "info",
            title: (dict["submitErrorTooMany"] ?? "You can pick at most {{max}} cards.").replace(
              "{{max}}",
              String(topN)
            ),
          });
          return;
        }
        next.add(id);
      }
      setPicks(next);
      setDirty(true);
    },
    [picks, topN, toast, dict]
  );

  const clearAll = useCallback(() => {
    setPicks(new Set());
    setDirty(true);
  }, []);

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/votes/${campaignId}/votes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardRefIds: [...picks] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errKey = data?.error;
        let message = dict["submitErrorUnknown"] ?? "Something went wrong.";
        if (errKey === "campaign_not_active") message = dict["submitErrorClosed"] ?? message;
        if (errKey === "too_many_votes") {
          message = (dict["submitErrorTooMany"] ?? "Too many.").replace("{{max}}", String(topN));
        }
        toast({ type: "error", title: message });
        return;
      }
      toast({ type: "success", title: dict["submitSuccess"] ?? "Selection saved." });
      setDirty(false);
    } catch {
      toast({ type: "error", title: dict["submitErrorUnknown"] ?? "Network error" });
    } finally {
      setSubmitting(false);
    }
  }, [campaignId, picks, dict, toast, topN]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 bg-bg/80 backdrop-blur py-2">
        <div className="text-sm text-text-secondary">
          <span className="font-bold text-text-primary">{counterText}</span>
          {" · "}
          <span className="text-text-muted">{dict["voteSavedHint"] ?? "Editable until the vote closes."}</span>
        </div>
        <div className="flex gap-2">
          {picks.size > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={submitting}>
              {dict["clearSelection"] ?? "Clear"}
            </Button>
          )}
          <Button variant="primary" size="md" onClick={submit} disabled={submitting || !dirty}>
            {dict["submitButton"] ?? "Save selection"}
          </Button>
        </div>
      </div>

      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {cards.map((card) => {
          const selected = picks.has(card._id);
          return (
            <li key={card._id}>
              <button
                type="button"
                onClick={() => toggle(card._id)}
                className={`relative w-full text-left rounded-xl overflow-hidden border-2 transition-all ${
                  selected
                    ? "border-pa-green ring-2 ring-pa-green/40"
                    : "border-border hover:border-pa-green/30"
                }`}
              >
                <div className="aspect-[3/4] bg-surface-2 relative">
                  {card.image ? (
                    <img
                      src={card.image}
                      alt={card.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-muted">
                      ?
                    </div>
                  )}
                  {selected && (
                    <div className="absolute top-2 right-2 bg-pa-green text-bg rounded-full w-7 h-7 flex items-center justify-center shadow-lg">
                      <Check className="w-4 h-4" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div className="p-2 bg-surface">
                  <div className="text-xs font-medium text-text-primary truncate">
                    {card.name}
                  </div>
                  <div className="text-[10px] text-text-muted truncate flex items-center gap-1">
                    {card.setName}
                    <Badge variant="info">{card.rarity}</Badge>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {cards.length === 0 && (
        <p className="text-sm text-text-muted">
          {isDe ? "Diese Abstimmung enthält keine Karten." : "This vote has no cards."}
        </p>
      )}
    </div>
  );
}
