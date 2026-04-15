"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import type { ChatBadgeSummary } from "@/types/chat";

interface ChatBadgeDetailModalProps {
  badges: ChatBadgeSummary[];
  initialIndex: number;
  open: boolean;
  lang: string;
  labels: {
    awardedAt: string;
    reason: string;
  };
  onClose: () => void;
}

function formatAwardedAt(value: string | null, lang: string) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat(lang === "de" ? "de-DE" : "en-US", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return null;
  }
}

export function ChatBadgeDetailModal({
  badges,
  initialIndex,
  open,
  lang,
  labels,
  onClose,
}: ChatBadgeDetailModalProps) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, open]);

  const badge = badges[index] ?? null;
  const hasPrev = index > 0;
  const hasNext = index < badges.length - 1;
  const showArrows = badges.length > 1;
  const awardedAt = formatAwardedAt(badge?.awardedAt ?? null, lang);

  return (
    <Modal open={open && Boolean(badge)} onClose={onClose} title={badge?.label ?? ""} size="sm">
      {badge ? (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            {showArrows && (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                disabled={!hasPrev}
                className="rounded-full p-1.5 transition-colors hover:bg-white/8 disabled:opacity-20 disabled:cursor-default"
                aria-label="Previous badge"
              >
                <ChevronLeft className="w-5 h-5 text-text-muted" />
              </button>
            )}

            {badge.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={badge.iconUrl}
                alt={badge.label}
                className="h-24 w-24 rounded-[20px] border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-[20px] border border-white/10 bg-white/5 text-lg font-semibold text-text-primary">
                {badge.label.slice(0, 2).toUpperCase()}
              </div>
            )}

            {showArrows && (
              <button
                type="button"
                onClick={() => setIndex((i) => i + 1)}
                disabled={!hasNext}
                className="rounded-full p-1.5 transition-colors hover:bg-white/8 disabled:opacity-20 disabled:cursor-default"
                aria-label="Next badge"
              >
                <ChevronRight className="w-5 h-5 text-text-muted" />
              </button>
            )}
          </div>

          {showArrows && (
            <p className="text-center text-[11px] text-text-muted tabular-nums">
              {index + 1} / {badges.length}
            </p>
          )}

          {badge.description ? (
            <p className="text-center text-sm leading-relaxed text-text-secondary">
              {badge.description}
            </p>
          ) : null}

          <div className="space-y-2 rounded-[14px] border border-white/8 bg-white/4 p-4">
            {awardedAt ? (
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="text-text-muted">{labels.awardedAt}</span>
                <span className="text-right font-medium text-text-primary">{awardedAt}</span>
              </div>
            ) : null}
            {badge.awardReason ? (
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="text-text-muted">{labels.reason}</span>
                <span className="text-right font-medium text-text-primary">{badge.awardReason}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
