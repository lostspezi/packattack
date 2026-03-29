"use client";

import type { ChatBadgeSummary } from "@/types/chat";

interface ChatUserBadgesProps {
  badges: ChatBadgeSummary[];
  lang?: string;
  iconSize?: "sm" | "md";
  interactive?: boolean;
  onBadgeClick?: (badge: ChatBadgeSummary) => void;
  className?: string;
}

export function ChatUserBadges({
  badges,
  iconSize = "sm",
  interactive = false,
  onBadgeClick,
  className,
}: ChatUserBadgesProps) {
  if (badges.length === 0) {
    return null;
  }

  const sizeClassName = iconSize === "md" ? "h-5 w-5" : "h-4 w-4";

  return (
    <div className={["flex flex-wrap items-center gap-1.5", className].filter(Boolean).join(" ")}>
      {badges.map((badge) => {
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

        if (interactive && onBadgeClick) {
          return (
            <button
              key={badge.key}
              type="button"
              title={badge.label}
              onClick={(event) => {
                event.stopPropagation();
                onBadgeClick(badge);
              }}
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/6 px-1.5 py-0.5 outline-none transition-colors hover:border-pa-green/20 hover:bg-white/8 focus-visible:border-pa-green/20"
            >
              {content}
            </button>
          );
        }

        return (
          <span
            key={badge.key}
            title={badge.label}
            className="inline-flex cursor-default items-center justify-center rounded-full border border-white/10 bg-white/6 px-1.5 py-0.5"
          >
            {content}
          </span>
        );
      })}
    </div>
  );
}
