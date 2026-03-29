"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";

interface GlobalQueueBannerProps {
  lang: string;
  dict: Record<string, string>;
}

export function GlobalQueueBanner({ lang, dict }: GlobalQueueBannerProps) {
  const router = useRouter();
  const [inQueue, setInQueue] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll queue status
  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/battles/queue/status");
        const data = await res.json();
        if (cancelled) return;

        if (data.matched && data.battle?.slug) {
          setInQueue(false);
          router.push(`/${lang}/battles/${data.battle.slug}`);
          return;
        }

        if (data.inQueue) {
          setInQueue(true);
          setWaitSeconds(data.waitSeconds ?? 0);
        } else {
          setInQueue(false);
        }
      } catch {
        // ignore
      }
    }

    check();
    pollRef.current = setInterval(check, 3000);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [lang, router]);

  // Local timer for smooth counting
  useEffect(() => {
    if (!inQueue) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setWaitSeconds((s) => s + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [inQueue]);

  async function handleLeave() {
    setLeaving(true);
    try {
      await fetch("/api/battles/queue/leave", { method: "DELETE" });
      setInQueue(false);
    } catch {
      // ignore
    } finally {
      setLeaving(false);
    }
  }

  if (!inQueue) return null;

  const m = Math.floor(waitSeconds / 60);
  const s = waitSeconds % 60;
  const timeStr = `${m}:${s.toString().padStart(2, "0")}`;

  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-4 bg-pa-green/90 px-4 py-2.5 text-white backdrop-blur-sm">
      <div className="flex items-center gap-2.5">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <p className="text-sm font-semibold">
          {dict["searchingForBattle"] ?? "Suche Battle..."}{" "}
          <span className="tabular-nums font-black">{timeStr}</span>
        </p>
      </div>
      <button
        onClick={handleLeave}
        disabled={leaving}
        className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1 text-sm font-medium transition-colors hover:bg-white/30 disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" />
        {dict["cancelSearch"] ?? "Abbrechen"}
      </button>
    </div>
  );
}
