"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { UpvoteItemTile, type VotingItem } from "@/components/votes/upvote-item-tile";

interface Props {
  lang: string;
  dict: Record<string, string>;
  campaignId: string;
  topN: number;
  items: VotingItem[];
  initialPicks: string[];
}

export function UpvoteItemGrid({
  lang,
  dict,
  campaignId,
  topN,
  items,
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
            title: (dict["submitErrorTooMany"] ?? "You can pick at most {{max}}.").replace(
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
        body: JSON.stringify({ itemRefIds: [...picks] }),
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
          <span className="text-text-muted">{dict["voteSavedHint"] ?? "Editable until close."}</span>
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
        {items.map((item) => (
          <li key={item._id}>
            <UpvoteItemTile
              item={item}
              lang={lang}
              selected={picks.has(item._id)}
              onClick={() => toggle(item._id)}
            />
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <p className="text-sm text-text-muted">
          {isDe ? "Diese Abstimmung enthält keine Einträge." : "This vote has no items."}
        </p>
      )}
    </div>
  );
}
