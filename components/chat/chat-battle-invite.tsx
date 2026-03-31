"use client";

import { useEffect, useState } from "react";
import { Swords, Clock } from "lucide-react";
import type { ChatBattleInviteSummary } from "@/types/chat";

/* ------------------------------------------------------------------ */
/*  Module-level battle status cache (shared across all instances)     */
/* ------------------------------------------------------------------ */

type BattleStatus =
  | "waiting"
  | "ready_check"
  | "countdown"
  | "active"
  | "sudden_death"
  | "finished"
  | "cancelled";

interface BattleState {
  status: BattleStatus;
  playerCount: number;
  lobbyExpiresAt: string | null;
}

type Listener = (state: BattleState) => void;

interface CacheEntry {
  state: BattleState;
  listeners: Set<Listener>;
  es: EventSource | null;
  fetched: boolean;
  fetchPromise: Promise<void> | null;
}

const TERMINAL: BattleStatus[] = ["cancelled", "finished"];

const EVENT_TO_STATUS: Partial<Record<string, BattleStatus>> = {
  battle_cancelled: "cancelled",
  battle_start: "active",
  battle_end: "finished",
  ready_check: "ready_check",
  player_joined: "waiting",
  player_left: "waiting",
};

const cache = new Map<string, CacheEntry>();

function getOrCreateEntry(slug: string): CacheEntry {
  let entry = cache.get(slug);
  if (!entry) {
    entry = {
      state: { status: "waiting", playerCount: 1, lobbyExpiresAt: null },
      listeners: new Set(),
      es: null,
      fetched: false,
      fetchPromise: null,
    };
    cache.set(slug, entry);
  }
  return entry;
}

function notify(entry: CacheEntry) {
  const snapshot = { ...entry.state };
  for (const fn of entry.listeners) fn(snapshot);
}

function updateState(entry: CacheEntry, partial: Partial<BattleState>) {
  let changed = false;
  if (partial.status !== undefined && partial.status !== entry.state.status) {
    entry.state.status = partial.status;
    changed = true;
  }
  if (partial.playerCount !== undefined && partial.playerCount !== entry.state.playerCount) {
    entry.state.playerCount = partial.playerCount;
    changed = true;
  }
  if (partial.lobbyExpiresAt !== undefined && partial.lobbyExpiresAt !== entry.state.lobbyExpiresAt) {
    entry.state.lobbyExpiresAt = partial.lobbyExpiresAt;
    changed = true;
  }
  if (changed) notify(entry);
}

function openSSE(entry: CacheEntry, sseId: string) {
  if (entry.es) return; // already open
  if (TERMINAL.includes(entry.state.status)) return;

  const es = new EventSource(`/api/battles/${sseId}/events`);
  entry.es = es;

  es.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as { type: string; data?: { playerCount?: number } };
      const mapped = EVENT_TO_STATUS[event.type];
      const partial: Partial<BattleState> = {};
      if (mapped) partial.status = mapped;
      if (typeof event.data?.playerCount === "number") partial.playerCount = event.data.playerCount;
      if (Object.keys(partial).length > 0) updateState(entry, partial);

      if (mapped && TERMINAL.includes(mapped)) {
        es.close();
        entry.es = null;
      }
    } catch { /* ignore */ }
  };

  es.onerror = () => {
    // Browser auto-reconnects; if terminal we already closed above
  };
}

function ensureFetched(slug: string, sseId: string): CacheEntry {
  const entry = getOrCreateEntry(slug);
  if (entry.fetched) return entry;
  if (entry.fetchPromise) return entry;

  entry.fetchPromise = fetch(`/api/battles/${slug}`)
    .then((res) => {
      if (!res.ok) {
        if (res.status === 404) updateState(entry, { status: "cancelled" });
        return;
      }
      return res.json().then((data: { battle?: { status?: string; players?: unknown[]; lobbyExpiresAt?: string } }) => {
        const battle = data?.battle;
        const partial: Partial<BattleState> = {};
        if (battle?.status) partial.status = battle.status as BattleStatus;
        if (Array.isArray(battle?.players)) partial.playerCount = battle.players.length;
        if (battle?.lobbyExpiresAt) partial.lobbyExpiresAt = battle.lobbyExpiresAt;
        if (Object.keys(partial).length > 0) updateState(entry, partial);

        if (!TERMINAL.includes(entry.state.status)) {
          openSSE(entry, sseId);
        }
      });
    })
    .catch(() => {})
    .finally(() => {
      entry.fetched = true;
      entry.fetchPromise = null;
    });

  return entry;
}

function subscribe(slug: string, sseId: string, listener: Listener): () => void {
  const entry = ensureFetched(slug, sseId);
  entry.listeners.add(listener);

  // Immediately fire with current cached state
  listener({ ...entry.state });

  return () => {
    entry.listeners.delete(listener);
    // Close SSE when no more listeners for this battle
    if (entry.listeners.size === 0 && entry.es) {
      entry.es.close();
      entry.es = null;
    }
  };
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

function useBattleStatus(invite: ChatBattleInviteSummary): BattleState {
  const [state, setState] = useState<BattleState>(() => {
    const entry = cache.get(invite.battleSlug);
    return entry ? { ...entry.state } : { status: "waiting", playerCount: 1, lobbyExpiresAt: null };
  });

  useEffect(() => {
    const sseId = invite.battleId || invite.battleSlug;
    return subscribe(invite.battleSlug, sseId, setState);
  }, [invite.battleSlug, invite.battleId]);

  return state;
}

/* ------------------------------------------------------------------ */
/*  Components                                                         */
/* ------------------------------------------------------------------ */

interface ChatBattleInviteProps {
  invite: ChatBattleInviteSummary;
  lang: string;
  className?: string;
}

const MODE_LABELS: Record<string, Record<string, string>> = {
  lowest_card: { de: "Niedrigste Karte", en: "Lowest Card" },
  highest_card: { de: "Höchste Karte", en: "Highest Card" },
  all_cards: { de: "Alle Karten", en: "All Cards" },
};

const STATUS_TEXT: Record<string, Record<BattleStatus, string | null>> = {
  de: {
    waiting: null,
    ready_check: "Battle startet gleich…",
    countdown: "Battle startet gleich…",
    active: "Battle läuft bereits",
    sudden_death: "Battle läuft bereits",
    finished: "Battle beendet",
    cancelled: "Battle abgebrochen",
  },
  en: {
    waiting: null,
    ready_check: "Battle starting soon…",
    countdown: "Battle starting soon…",
    active: "Battle already in progress",
    sudden_death: "Battle already in progress",
    finished: "Battle finished",
    cancelled: "Battle cancelled",
  },
};

function CardFan({ images }: { images: string[] }) {
  if (images.length === 0) return null;
  const cards = images.slice(0, 3);

  return (
    <div className="relative h-[80px] w-[90px] shrink-0">
      {cards[2] ? (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-12 origin-bottom transition-transform duration-500">
          <div className="h-[60px] w-[42px] overflow-hidden rounded-md border border-white/10 bg-surface shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cards[2]} alt="" className="h-full w-full object-cover" loading="lazy" />
          </div>
        </div>
      ) : null}
      {cards[1] ? (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 rotate-12 origin-bottom transition-transform duration-500">
          <div className="h-[60px] w-[42px] overflow-hidden rounded-md border border-white/10 bg-surface shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cards[1]} alt="" className="h-full w-full object-cover" loading="lazy" />
          </div>
        </div>
      ) : null}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[55%] z-10 transition-transform duration-500">
        <div className="h-[66px] w-[46px] overflow-hidden rounded-md border-2 border-indigo-400/40 bg-surface shadow-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cards[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      </div>
    </div>
  );
}

function calcLobbyRemaining(lobbyExpiresAt: string | null) {
  if (!lobbyExpiresAt) return 0;
  return Math.max(0, new Date(lobbyExpiresAt).getTime() - Date.now());
}

function useLobbyCountdown(lobbyExpiresAt: string | null, isActive: boolean) {
  const [remaining, setRemaining] = useState(() => calcLobbyRemaining(lobbyExpiresAt));

  useEffect(() => {
    if (!isActive || !lobbyExpiresAt) return;
    const interval = setInterval(() => setRemaining(calcLobbyRemaining(lobbyExpiresAt)), 1000);
    return () => clearInterval(interval);
  }, [isActive, lobbyExpiresAt]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return { remaining, minutes, seconds };
}

export function ChatBattleInvite({ invite, lang, className }: ChatBattleInviteProps) {
  const { status, playerCount: currentPlayers, lobbyExpiresAt } = useBattleStatus(invite);
  const modeLabel = MODE_LABELS[invite.mode]?.[lang] ?? invite.mode;
  const ctaLabel = lang === "de" ? "Zum Battle" : "Join Battle";
  const hasPreviewCards = invite.previewCards.length > 0;

  const statusText = (STATUS_TEXT[lang] ?? STATUS_TEXT.de)[status] ?? null;
  const isFull = currentPlayers >= invite.playerCount;
  const showCta = status === "waiting";
  const isEnded = status === "cancelled" || status === "finished";
  const { remaining, minutes, seconds } = useLobbyCountdown(lobbyExpiresAt, showCta);

  return (
    <div
      className={[
        "relative overflow-hidden rounded-[14px] border",
        isEnded
          ? "border-white/10 bg-gradient-to-br from-white/5 via-white/3 to-white/5 opacity-60"
          : "border-indigo-400/35 bg-gradient-to-br from-indigo-500/20 via-purple-500/12 to-blue-500/15 shadow-[0_0_20px_rgba(99,102,241,0.18)]",
        "p-3",
        className ?? "",
      ].join(" ")}
    >
      <div className="relative flex items-center gap-3">
        {hasPreviewCards ? (
          <CardFan images={invite.previewCards} />
        ) : invite.boxImage ? (
          <div className="w-16 shrink-0 rounded-[10px] border border-indigo-300/35 bg-black/25 p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={invite.boxImage}
              alt={invite.boxName}
              className="aspect-[63/88] w-full rounded-[8px] object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="flex h-[80px] w-[90px] shrink-0 items-center justify-center rounded-[10px] bg-white/5">
            <Swords className="h-6 w-6 text-indigo-300/60" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-indigo-200">
            {invite.entryFee} Coins
          </p>
          <p className="mt-0.5 break-words text-sm font-semibold text-text-primary">
            {invite.boxName}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-200/80">
            <span className="rounded-full border border-indigo-300/25 bg-indigo-500/15 px-2 py-0.5">
              {invite.rounds} {lang === "de" ? "Runden" : "Rounds"}
            </span>
            <span
              className={[
                "rounded-full border px-2 py-0.5",
                isFull && status === "waiting"
                  ? "border-yellow-400/30 bg-yellow-500/15 text-yellow-200/90"
                  : "border-indigo-300/25 bg-indigo-500/15",
              ].join(" ")}
            >
              {currentPlayers}/{invite.playerCount} {lang === "de" ? "Spieler" : "Players"}
            </span>
            <span className="rounded-full border border-indigo-300/25 bg-indigo-500/15 px-2 py-0.5">
              {modeLabel}
            </span>
          </div>
          {showCta && remaining > 0 && lobbyExpiresAt && (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-indigo-200/60">
              <Clock className="h-3 w-3" />
              <span>{minutes}:{seconds.toString().padStart(2, "0")} {lang === "de" ? "verbleibend" : "remaining"}</span>
            </div>
          )}
          {showCta ? (
            isFull ? (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-text-muted cursor-not-allowed">
                <Swords className="h-3.5 w-3.5" />
                {lang === "de" ? "Battle voll" : "Battle full"}
              </span>
            ) : (
              <a
                href={`/${lang}/battles/${invite.battleSlug}`}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/80 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-500"
              >
                <Swords className="h-3.5 w-3.5" />
                {ctaLabel}
              </a>
            )
          ) : statusText ? (
            <p className="mt-2 text-xs font-medium text-text-muted italic">
              {statusText}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
