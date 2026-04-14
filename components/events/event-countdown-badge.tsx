"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Self-contained countdown badge that fetches the current event's
 * start time and displays a live countdown. Shows nothing if no event
 * or event has already started.
 */
export function EventCountdownBadge() {
  const [startsAt, setStartsAt] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStart = useCallback(async () => {
    try {
      const res = await fetch("/api/events/current");
      if (!res.ok) return;
      const data = await res.json();
      if (data.event) {
        setStartsAt(new Date(data.event.startsAt).getTime());
        setStatus(data.event.status);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchStart();
  }, [fetchStart]);

  useEffect(() => {
    if (!startsAt || status === "active" || status === "ended") {
      setLabel("");
      return;
    }

    function tick() {
      const diff = startsAt! - Date.now();
      if (diff <= 0) {
        setLabel("Live!");
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      setUrgent(diff < 3600000);

      if (d > 0) {
        setLabel(`${d}T ${h}h ${m}m ${String(s).padStart(2, "0")}s`);
      } else if (h > 0) {
        setLabel(`${h}h ${m}m ${String(s).padStart(2, "0")}s`);
      } else {
        setLabel(`${m}:${String(s).padStart(2, "0")}`);
      }
    }

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startsAt, status]);

  if (!label) return null;

  const isLive = label === "Live!";

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
