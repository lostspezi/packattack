"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, X, type LucideIcon } from "lucide-react";

export type TopBannerTone = "green" | "blue" | "yellow" | "red" | "purple" | "neutral";

interface TopBannerProps {
  /**
   * Stable identifier used for the dismissal key in localStorage. Pick
   * something unique per feature + per visible item, e.g.
   * `upvote:[campaignId]` or `release-note:2026-04-25`. The component
   * persists `dismissedKeyPrefix + id`.
   */
  id: string;
  /** Where the CTA link goes. */
  href: string;
  /** Short uppercase label on the left, e.g. "Your vote counts". */
  headline: string;
  /** Main label, shown bold. */
  title: string;
  /** Optional secondary text shown only on md+ viewports. */
  body?: string;
  ctaLabel: string;
  dismissLabel: string;
  /** Optional Lucide icon shown before the headline on sm+ viewports. */
  icon?: LucideIcon;
  /** Color tone (gradient + icon + CTA). Defaults to "green". */
  tone?: TopBannerTone;
  /** When true, the gradient slowly pans horizontally to draw attention. */
  pulse?: boolean;
  /**
   * Override the localStorage key prefix. Useful if a feature wants to
   * reset all its dismissals later (just clear keys with this prefix).
   * Defaults to `topBanner:dismissed:`.
   */
  dismissedKeyPrefix?: string;
}

const DEFAULT_PREFIX = "topBanner:dismissed:";

const TONE_CLASSES: Record<TopBannerTone, { bar: string; border: string; icon: string; cta: string }> = {
  green: {
    bar: "from-pa-green/25 via-pa-green/15 to-pa-green/25",
    border: "border-pa-green/30",
    icon: "text-pa-green",
    cta: "bg-pa-green/30 hover:bg-pa-green/50",
  },
  blue: {
    bar: "from-blue-500/25 via-blue-500/15 to-blue-500/25",
    border: "border-blue-500/30",
    icon: "text-blue-400",
    cta: "bg-blue-500/30 hover:bg-blue-500/50",
  },
  yellow: {
    bar: "from-yellow-500/25 via-yellow-500/15 to-yellow-500/25",
    border: "border-yellow-500/30",
    icon: "text-yellow-400",
    cta: "bg-yellow-500/30 hover:bg-yellow-500/50",
  },
  red: {
    bar: "from-red-500/25 via-red-500/15 to-red-500/25",
    border: "border-red-500/30",
    icon: "text-red-400",
    cta: "bg-red-500/30 hover:bg-red-500/50",
  },
  purple: {
    bar: "from-pa-lila/30 via-pa-lila/15 to-pa-lila/30",
    border: "border-pa-lila/30",
    icon: "text-pa-lila",
    cta: "bg-pa-lila/30 hover:bg-pa-lila/50",
  },
  neutral: {
    bar: "from-white/10 via-white/5 to-white/10",
    border: "border-white/15",
    icon: "text-text-secondary",
    cta: "bg-white/10 hover:bg-white/20",
  },
};

const dismissListeners = new Set<() => void>();

function notifyDismiss() {
  dismissListeners.forEach((cb) => cb());
}

function buildSubscribe(prefix: string) {
  return (cb: () => void) => {
    dismissListeners.add(cb);
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith(prefix)) cb();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
    }
    return () => {
      dismissListeners.delete(cb);
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", onStorage);
      }
    };
  };
}

function readDismissed(key: string): boolean {
  try {
    return Boolean(window.localStorage.getItem(key));
  } catch {
    return false;
  }
}

export function TopBanner({
  id,
  href,
  headline,
  title,
  body,
  ctaLabel,
  dismissLabel,
  icon: Icon,
  tone = "green",
  pulse = false,
  dismissedKeyPrefix = DEFAULT_PREFIX,
}: TopBannerProps) {
  const storageKey = `${dismissedKeyPrefix}${id}`;

  // SSR-safe: server snapshot is always "not dismissed", client snapshot
  // reads localStorage. useSyncExternalStore avoids hydration mismatches
  // and the setState-in-effect lint rule.
  const dismissed = useSyncExternalStore(
    buildSubscribe(dismissedKeyPrefix),
    () => readDismissed(storageKey),
    () => false
  );

  if (dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // localStorage blocked (private mode etc.)
    }
    notifyDismiss();
  };

  const t = TONE_CLASSES[tone];
  const pulseClass = pulse ? " votes-top-banner-pulse" : "";

  return (
    <div className={`relative w-full bg-gradient-to-r ${t.bar} border-b ${t.border}${pulseClass}`}>
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-3">
        {Icon ? <Icon className={`w-4 h-4 ${t.icon} shrink-0 hidden sm:block`} /> : null}
        <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold text-text-primary uppercase tracking-wide text-xs">
            {headline}
          </span>
          <span className="font-medium text-text-primary truncate">{title}</span>
          {body ? (
            <span className="text-text-secondary hidden md:inline truncate">· {body}</span>
          ) : null}
        </div>
        <Link
          href={href}
          className={`shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-text-primary px-3 py-1 rounded-md transition-colors ${t.cta}`}
        >
          {ctaLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label={dismissLabel}
          title={dismissLabel}
          className="shrink-0 p-1 rounded text-text-secondary hover:text-text-primary hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
