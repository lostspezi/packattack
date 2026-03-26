"use client";

import React, { useState, useEffect, useRef } from "react";
import { CardLightbox } from "@/components/packs/card-lightbox";

interface LiveEvent {
  userName: string;
  userImage: string | null;
  cardName: string;
  cardImage: string | null;
  rarity: string;
  coinValue: number;
  decision: string;
  timestamp: number;
}

function timeAgo(ts: number, isDe: boolean): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return isDe ? "gerade eben" : "just now";
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

function isRare(coinValue: number): boolean {
  return coinValue >= 20;
}

interface CardPoolEntry {
  name: string;
  chance: number;
  coinValue: number;
  marketPrice: number | null;
  setName: string;
}

export function LiveEvents({
  boxId,
  initialEvents,
  cardPool,
  lang,
}: {
  boxId: string;
  initialEvents: LiveEvent[];
  cardPool: CardPoolEntry[];
  lang: string;
}) {
  const isDe = lang === "de";
  const [events, setEvents] = useState<LiveEvent[]>(initialEvents);
  const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/packs/${boxId}/events`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as LiveEvent;
        setEvents((prev) => [event, ...prev].slice(0, 20));
      } catch {
        // Invalid data
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [boxId]);

  // Refresh timestamps every 10s
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="bg-surface border border-border rounded-[14px] p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_theme(colors.red.500)]" />
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            Live Pulls
          </span>
        </div>

        {events.length === 0 ? (
          <p className="text-xs text-text-muted py-4 text-center">
            {isDe ? "Noch keine Events..." : "No events yet..."}
          </p>
        ) : (
          <div className="space-y-1">
            {events.slice(0, 6).map((ev, i) => {
              const rare = isRare(ev.coinValue);
              return (
                <button
                  key={`${ev.timestamp}-${i}`}
                  type="button"
                  onClick={() => setSelectedEvent(ev)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all text-left hover:bg-white/4 ${
                    rare ? "bg-pa-green/5 border-l-2 border-l-pa-green" : ""
                  }`}
                >
                  {/* Card image */}
                  {ev.cardImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ev.cardImage} alt="" className="w-7 rounded shrink-0" loading="lazy" />
                  ) : (
                    <div className="w-7 aspect-[63/88] bg-white/6 rounded shrink-0" />
                  )}

                  {/* Event text */}
                  <div className="flex-1 min-w-0 truncate">
                    <span className={`font-semibold ${rare ? "text-pa-green" : "text-text-primary"}`}>
                      {ev.userName}
                    </span>
                    <span className="text-text-muted"> → </span>
                    <span className={rare ? "text-text-primary font-semibold" : "text-text-secondary"}>
                      {ev.cardName}
                    </span>
                    {rare && (
                      <span className="text-yellow-400 ml-1">{ev.coinValue}</span>
                    )}
                  </div>

                  {/* Time */}
                  <span className="text-text-muted shrink-0 tabular-nums">
                    {timeAgo(ev.timestamp, isDe)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedEvent && (() => {
        const poolCard = cardPool.find((c) => c.name === selectedEvent.cardName);
        return (
          <CardLightbox
            card={{
              name: selectedEvent.cardName,
              image: selectedEvent.cardImage,
              rarity: selectedEvent.rarity,
              setName: poolCard?.setName ?? "",
              coinValue: selectedEvent.coinValue,
              marketPrice: poolCard?.marketPrice ?? null,
              chance: poolCard?.chance ?? 0,
            }}
            lang={lang}
            open={true}
            onClose={() => setSelectedEvent(null)}
          />
        );
      })()}
    </>
  );
}
