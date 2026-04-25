"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ThumbsUp, X, ArrowRight } from "lucide-react";

interface Props {
  lang: string;
  campaignId: string;
  title: string;
  question: string;
  dictHeadline: string;
  dictCta: string;
  dictDismiss: string;
}

const STORAGE_KEY_PREFIX = "votes:topBannerDismissed:";

const dismissListeners = new Set<() => void>();

function subscribeDismiss(cb: () => void) {
  dismissListeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key && e.key.startsWith(STORAGE_KEY_PREFIX)) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    dismissListeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function notifyDismiss() {
  dismissListeners.forEach((cb) => cb());
}

function isDismissedSnapshot(campaignId: string): boolean {
  try {
    return Boolean(window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${campaignId}`));
  } catch {
    return false;
  }
}

export function UpvoteTopBannerBar({
  lang,
  campaignId,
  title,
  question,
  dictHeadline,
  dictCta,
  dictDismiss,
}: Props) {
  // useSyncExternalStore handles SSR (server snapshot = false) plus client
  // updates without hydration warnings or setState-in-effect lint errors.
  const dismissed = useSyncExternalStore(
    subscribeDismiss,
    () => isDismissedSnapshot(campaignId),
    () => false
  );

  if (dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${campaignId}`, "1");
    } catch {
      // localStorage blocked (private mode etc.)
    }
    notifyDismiss();
  };

  return (
    <div className="relative w-full bg-gradient-to-r from-pa-green/25 via-pa-green/15 to-pa-green/25 border-b border-pa-green/30 votes-top-banner-pulse">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-3">
        <ThumbsUp className="w-4 h-4 text-pa-green shrink-0 hidden sm:block" />
        <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold text-text-primary uppercase tracking-wide text-xs">
            {dictHeadline}
          </span>
          <span className="font-medium text-text-primary truncate">{title}</span>
          <span className="text-text-secondary hidden md:inline truncate">· {question}</span>
        </div>
        <Link
          href={`/${lang}/votes/${campaignId}`}
          className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-text-primary bg-pa-green/30 hover:bg-pa-green/50 px-3 py-1 rounded-md transition-colors"
        >
          {dictCta}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label={dictDismiss}
          title={dictDismiss}
          className="shrink-0 p-1 rounded text-text-secondary hover:text-text-primary hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
