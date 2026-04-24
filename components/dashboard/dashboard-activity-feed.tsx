"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Package,
  Swords,
  Coins,
  RotateCw,
  Sparkles,
} from "lucide-react";
import type { ActivityItem, ActivityKind } from "@/lib/dashboard/activity";

const KIND_ICON: Record<ActivityKind, React.ComponentType<{ className?: string }>> = {
  pull: Package,
  battle: Swords,
  coin: Coins,
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "gerade eben";
  const min = Math.floor(sec / 60);
  if (min < 60) return `vor ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `vor ${hr} h`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `vor ${d} Tagen`;
  return new Date(iso).toLocaleDateString("de-DE");
}

function toneClasses(tone: ActivityItem["tone"]): string {
  if (tone === "positive") return "bg-pa-green/10 text-pa-green";
  if (tone === "negative") return "bg-error/10 text-error-light";
  return "bg-white/4 text-text-muted";
}

interface DashboardActivityFeedProps {
  initialItems: ActivityItem[];
}

export function DashboardActivityFeed({ initialItems }: DashboardActivityFeedProps) {
  const [items, setItems] = useState<ActivityItem[]>(initialItems);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const seenIds = useRef(new Set(initialItems.map((i) => i.id)));
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEvent = useCallback((data: string) => {
    try {
      const item = JSON.parse(data) as ActivityItem;
      if (!item?.id || seenIds.current.has(item.id)) return;
      seenIds.current.add(item.id);
      setItems((prev) => [item, ...prev].slice(0, 50));
      setHighlight(item.id);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => {
        setHighlight((current) => (current === item.id ? null : current));
        highlightTimer.current = null;
      }, 1500);
    } catch {
      /* malformed message */
    }
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/dashboard/activity/events");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (event) => handleEvent(event.data);
    return () => {
      es.close();
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, [handleEvent]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-text-primary">Aktivität</h3>
        <span
          className={`text-xs flex items-center gap-1 ${
            connected ? "text-pa-green" : "text-text-muted"
          }`}
          title={connected ? "Live" : "Offline"}
        >
          {connected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-pa-green animate-pulse" />
              Live
            </>
          ) : (
            <>
              <RotateCw className="w-3 h-3" /> Verbinde …
            </>
          )}
        </span>
      </div>

      {items.length === 0 ? (
        <Card variant="soft" className="p-8 text-center">
          <Sparkles className="w-6 h-6 text-text-muted mx-auto mb-2" />
          <p className="text-text-secondary text-sm">
            Noch nichts passiert. Öffne dein erstes Pack und es geht los.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind] ?? Package;
            const isNew = highlight === item.id;
            return (
              <li key={item.id}>
                <Card
                  variant="soft"
                  className={`p-3 flex items-center gap-3 transition-colors ${
                    isNew ? "ring-2 ring-pa-green/40" : ""
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${toneClasses(
                      item.tone
                    )}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-sm font-medium truncate">
                      {item.title}
                    </p>
                    {item.detail && (
                      <p className="text-text-muted text-xs truncate">
                        {item.detail}
                      </p>
                    )}
                  </div>
                  <span className="text-text-muted text-xs shrink-0">
                    {timeAgo(item.createdAt)}
                  </span>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
