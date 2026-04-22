"use client";

import { useEffect, useState } from "react";
import { useMe } from "@/components/layout/me-provider";

/**
 * Self-contained countdown badge that reads the current event's start time
 * from the shared /api/me snapshot and displays a live countdown. Shows
 * nothing if there's no event or it has already started.
 */
export function EventCountdownBadge() {
  const me = useMe();
  const startsAt = me?.event ? new Date(me.event.startsAt).getTime() : null;
  const status = me?.event?.status ?? null;

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startsAt || status === "active" || status === "ended") return;
    const diff = startsAt - Date.now();
    if (diff <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startsAt, status]);

  if (!startsAt || status === "active" || status === "ended") return null;

  const diff = startsAt - now;
  const isLive = diff <= 0;
  const urgent = !isLive && diff < 3600000;
  let label: string;
  if (isLive) {
    label = "Live!";
  } else {
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (d > 0) {
      label = `${d}T ${h}h ${m}m ${String(s).padStart(2, "0")}s`;
    } else if (h > 0) {
      label = `${h}h ${m}m ${String(s).padStart(2, "0")}s`;
    } else {
      label = `${m}:${String(s).padStart(2, "0")}`;
    }
  }

  return (
    <span
      className={[
        "ml-1.5 inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none",
        isLive
          ? "animate-pulse bg-pa-green/20 text-pa-green"
          : urgent
            ? "bg-red-500/15 text-red-400"
            : "bg-yellow-500/15 text-yellow-400",
      ].join(" ")}
    >
      {label}
    </span>
  );
}
