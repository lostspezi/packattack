"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ChatBadgeSummary } from "@/types/chat";

interface ChatUserBadgesProps {
  badges: ChatBadgeSummary[];
  lang?: string;
  iconSize?: "sm" | "md";
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getTitle(badge: ChatBadgeSummary, lang: string) {
  const lines = [badge.label];
  if (badge.description) lines.push(badge.description);
  if (badge.awardReason) lines.push(`${lang === "de" ? "Grund" : "Reason"}: ${badge.awardReason}`);
  return lines.join("\n");
}

export function ChatUserBadges({
  badges,
  lang = "de",
  iconSize = "sm",
}: ChatUserBadgesProps) {
  const [activeBadge, setActiveBadge] = useState<{
    badge: ChatBadgeSummary;
    rect: DOMRect;
  } | null>(null);

  const tooltipStyle = useMemo(() => {
    if (!activeBadge || typeof window === "undefined") {
      return null;
    }

    const width = 260;
    const left = clamp(
      activeBadge.rect.left + activeBadge.rect.width / 2 - width / 2,
      8,
      window.innerWidth - width - 8
    );
    const prefersAbove = activeBadge.rect.top > 160;

    return {
      left,
      width,
      top: prefersAbove ? undefined : activeBadge.rect.bottom + 10,
      bottom: prefersAbove ? window.innerHeight - activeBadge.rect.top + 10 : undefined,
    };
  }, [activeBadge]);
  const activeAwardedAt = activeBadge ? formatAwardedAt(activeBadge.badge.awardedAt, lang) : null;

  if (badges.length === 0) {
    return null;
  }

  const sizeClassName = iconSize === "md" ? "h-5 w-5" : "h-4 w-4";

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {badges.map((badge) => {
          const title = getTitle(badge, lang);
          const content = badge.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={badge.iconUrl}
              alt={badge.label}
              className={`${sizeClassName} rounded-[4px] object-cover`}
              loading="lazy"
            />
          ) : (
            <span className="truncate px-2 text-[10px] font-semibold leading-5 text-text-primary">
              {badge.label}
            </span>
          );

          return (
            <span
              key={badge.key}
              role="button"
              tabIndex={0}
              title={title}
              onMouseEnter={(event) =>
                setActiveBadge({
                  badge,
                  rect: event.currentTarget.getBoundingClientRect(),
                })
              }
              onMouseLeave={() => setActiveBadge((current) => (current?.badge.key === badge.key ? null : current))}
              onFocus={(event) =>
                setActiveBadge({
                  badge,
                  rect: event.currentTarget.getBoundingClientRect(),
                })
              }
              onBlur={() => setActiveBadge((current) => (current?.badge.key === badge.key ? null : current))}
              className="inline-flex cursor-default items-center justify-center rounded-full border border-white/10 bg-white/6 px-1.5 py-0.5 outline-none transition-colors hover:border-pa-green/20 focus-visible:border-pa-green/20"
            >
              {content}
            </span>
          );
        })}
      </div>

      {activeBadge && tooltipStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[98] rounded-[14px] border border-white/10 bg-surface-elevated/98 p-3 shadow-2xl shadow-black/35 ring-1 ring-white/8 backdrop-blur-xl"
              style={tooltipStyle}
            >
              <div className="flex items-start gap-3">
                {activeBadge.badge.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeBadge.badge.iconUrl}
                    alt={activeBadge.badge.label}
                    className="h-10 w-10 rounded-[10px] object-cover"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">
                    {activeBadge.badge.label}
                  </p>
                  {activeBadge.badge.description ? (
                    <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                      {activeBadge.badge.description}
                    </p>
                  ) : null}
                  {activeBadge.badge.awardReason ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
                      <span className="font-semibold text-text-secondary">
                        {lang === "de" ? "Grund:" : "Reason:"}
                      </span>{" "}
                      {activeBadge.badge.awardReason}
                    </p>
                  ) : null}
                  {activeAwardedAt ? (
                    <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                      <span className="font-semibold text-text-secondary">
                        {lang === "de" ? "Verliehen:" : "Awarded:"}
                      </span>{" "}
                      {activeAwardedAt}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
