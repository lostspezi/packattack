"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { CardReview } from "./card-review";
import { useToast } from "@/components/ui/toast";
import { Clock, AlertTriangle, Volume2, VolumeX } from "lucide-react";

type CardChoice = "claim" | "convert" | null;

interface PendingCard {
  pullId: string;
  cardId: string;
  name: string;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  image: string | null;
  packGroupId: string;
  packIndex: number;
  cardIndex: number;
  status: string;
}

interface PendingData {
  pending: boolean;
  packGroupId: string;
  boxId: string;
  boxSlug: string;
  boxName: { de?: string; en?: string };
  packCount: number;
  totalCards: number;
  pendingCount: number;
  decidedCount: number;
  expiresAt: string | null;
  battleId: string | null;
  cards: PendingCard[];
}

// Polling is only an insurance policy — real updates arrive via the
// `pending-pulls-changed` event and the explicit refetch from decide/open.
// 30s is long enough not to matter for perf but short enough to self-heal if
// an event is missed.
const POLL_INTERVAL = 30_000;
const WARNING_THRESHOLD = 60; // seconds — play warning sound
const CRITICAL_THRESHOLD = 30; // seconds — urgent UI
const NOTIFY_THRESHOLD = 90; // seconds — send browser notification
const PENDING_PULLS_EVENT = "pending-pulls-changed";

/** Dispatch from anywhere to make the guard refetch immediately. */
export function notifyPendingPulls() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PENDING_PULLS_EVENT));
  }
}

/**
 * Suppress / unsuppress the guard overlay.
 * While suppressed, the guard still polls but won't render the blocking overlay.
 * Use this when another component (e.g. PackOpening) handles card review itself.
 */
let _suppressed = false;
export function suppressPendingGuard(value: boolean) {
  _suppressed = value;
}
export function isPendingGuardSuppressed() {
  return _suppressed;
}

export function PendingPullsGuard({ children }: { children: React.ReactNode }) {
  const params = useParams<{ lang: string }>();
  const lang = params?.lang ?? "de";
  const isDe = lang === "de";
  const { toast } = useToast();

  const [pendingData, setPendingData] = useState<PendingData | null>(null);
  const [choices, setChoices] = useState<Map<number, CardChoice>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [totalSeconds, setTotalSeconds] = useState(300);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const notifiedRef = useRef(false);
  const warningSoundPlayedRef = useRef(false);
  const tickSoundRef = useRef<HTMLAudioElement | null>(null);
  const warnSoundRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSessionRef = useRef<string | null>(null);
  const hadPendingRef = useRef(false);

  // Preload sounds
  useEffect(() => {
    tickSoundRef.current = new Audio("/sounds/card-flip.mp3");
    tickSoundRef.current.volume = 0.15;
    warnSoundRef.current = new Audio("/sounds/card-epic.mp3");
    warnSoundRef.current.volume = 0.4;
    return () => {
      tickSoundRef.current = null;
      warnSoundRef.current = null;
    };
  }, []);

  // Fetch pending pulls
  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch("/api/pulls/pending");
      if (!res.ok) return;
      const data = await res.json() as PendingData | { pending: false };
      if (!data.pending) {
        if (hadPendingRef.current) {
          // Was pending, now cleared — auto-converted by server
          setPendingData(null);
          setChoices(new Map());
          lastSessionRef.current = null;
          hadPendingRef.current = false;
        }
        return;
      }
      const d = data as PendingData;
      hadPendingRef.current = true;
      // Only reset choices if it's a different session (battle or pack group)
      const sessionKey = d.battleId ?? d.packGroupId;
      if (sessionKey !== lastSessionRef.current) {
        lastSessionRef.current = sessionKey;
        setChoices(new Map());
        notifiedRef.current = false;
        warningSoundPlayedRef.current = false;
      }
      setPendingData(d);
    } catch {
      // Silently fail — will retry on next poll
    }
  }, []);

  // Poll on mount, periodically, and on custom event
  useEffect(() => {
    fetchPending();
    pollRef.current = setInterval(fetchPending, POLL_INTERVAL);
    window.addEventListener(PENDING_PULLS_EVENT, fetchPending);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      window.removeEventListener(PENDING_PULLS_EVENT, fetchPending);
    };
  }, [fetchPending]);

  // Countdown timer
  const expiresAtStr = pendingData?.expiresAt ?? null;
  useEffect(() => {
    if (!expiresAtStr) {
      setSecondsLeft(null);
      return;
    }

    const expiresMs = new Date(expiresAtStr).getTime();
    const total = Math.max(1, Math.ceil((expiresMs - Date.now()) / 1000));
    setTotalSeconds(total);

    function tick() {
      const remaining = Math.max(0, Math.ceil((expiresMs - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        // Time's up — refetch to get server-side auto-conversion result
        setPendingData(null);
        setChoices(new Map());
        lastSessionRef.current = null;
        fetchPending();
      }
    }

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [expiresAtStr, fetchPending]);

  // Sound + notification effects based on timer
  useEffect(() => {
    if (secondsLeft === null || !pendingData) return;

    // Warning sound at threshold
    if (secondsLeft <= WARNING_THRESHOLD && secondsLeft > 0 && !warningSoundPlayedRef.current) {
      warningSoundPlayedRef.current = true;
      if (soundEnabled && warnSoundRef.current) {
        warnSoundRef.current.play().catch(() => {});
      }
    }

    // Tick sound in critical phase (every 5 seconds)
    if (secondsLeft <= CRITICAL_THRESHOLD && secondsLeft > 0 && secondsLeft % 5 === 0) {
      if (soundEnabled && tickSoundRef.current) {
        const clone = tickSoundRef.current.cloneNode() as HTMLAudioElement;
        clone.volume = 0.2;
        clone.play().catch(() => {});
      }
    }

    // Browser notification
    if (secondsLeft <= NOTIFY_THRESHOLD && secondsLeft > 0 && !notifiedRef.current) {
      notifiedRef.current = true;
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(
          isDe ? "Karten warten auf deine Entscheidung!" : "Cards waiting for your decision!",
          {
            body: isDe
              ? `Noch ${secondsLeft} Sekunden, bevor alle Karten automatisch in Coins umgewandelt werden.`
              : `${secondsLeft} seconds left before all cards are auto-converted to coins.`,
            icon: "/icon-192.png",
            tag: "pending-pulls",
          },
        );
      }
    }
  }, [secondsLeft, pendingData, soundEnabled, isDe]);

  // Request notification permission on first render if not yet granted
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Handle card choice
  function setChoice(idx: number, choice: CardChoice) {
    setChoices((prev) => new Map(prev).set(idx, choice));
  }

  // Handle confirm
  async function handleConfirm() {
    if (!pendingData) return;
    setSubmitting(true);
    try {
      const recoveredIndices = new Set(
        pendingData.cards
          .map((c, i) => (c.status === "reserved" || c.status === "converted") ? i : -1)
          .filter((i) => i >= 0),
      );

      for (let i = 0; i < pendingData.cards.length; i++) {
        if (recoveredIndices.has(i)) continue;
        const card = pendingData.cards[i];
        const decision = choices.get(i);
        if (!decision) continue;

        const res = await fetch("/api/pulls/decide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pullId: card.pullId,
            packGroupId: card.packGroupId,
            cardId: card.cardId,
            cardIndex: card.cardIndex,
            packIndex: card.packIndex,
            rarity: card.rarity,
            coinValue: card.coinValue,
            conversionValue: card.conversionValue,
            decision,
            boxId: pendingData.boxId,
          }),
        });
        const data = (await res.json()) as { newBalance?: number; error?: string };
        if (!res.ok) {
          toast({ type: "error", title: data.error ?? `Failed on card ${i + 1}` });
          setSubmitting(false);
          return;
        }
      }

      toast({
        type: "success",
        title: isDe
          ? "Alle Karten entschieden!"
          : "All cards decided!",
      });
      window.dispatchEvent(new CustomEvent("coin-balance-refresh"));
      setPendingData(null);
      setChoices(new Map());
      lastSessionRef.current = null;
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  // Format time
  function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  const hasPending = pendingData && pendingData.pendingCount > 0;

  // If no pending, or another component is handling the review (e.g. PackOpening), skip
  if (!hasPending || isPendingGuardSuppressed()) return <>{children}</>;

  const recoveredIndices = new Set(
    pendingData.cards
      .map((c, i) => (c.status === "reserved" || c.status === "converted") ? i : -1)
      .filter((i) => i >= 0),
  );

  const boxName = isDe
    ? (pendingData.boxName.de || pendingData.boxName.en || "Box")
    : (pendingData.boxName.en || pendingData.boxName.de || "Box");

  const isCritical = secondsLeft !== null && secondsLeft <= CRITICAL_THRESHOLD;
  const isWarning = secondsLeft !== null && secondsLeft <= WARNING_THRESHOLD;

  return (
    <>
      {/* Blocking overlay */}
      <div className="fixed inset-0 z-[100] flex flex-col bg-bg/98 backdrop-blur-sm overflow-auto">
        {/* Timer bar */}
        <div
          className={[
            "sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b",
            isCritical
              ? "bg-red-950/80 border-red-500/30"
              : isWarning
                ? "bg-yellow-950/60 border-yellow-500/20"
                : "bg-surface/80 border-border",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            {isCritical ? (
              <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
            ) : (
              <Clock className="w-5 h-5 text-text-muted" />
            )}
            <div>
              <p className={`text-sm font-bold ${isCritical ? "text-red-400" : "text-text-primary"}`}>
                {isDe ? "Karten warten auf deine Entscheidung" : "Cards waiting for your decision"}
              </p>
              <p className={`text-xs ${isCritical ? "text-red-400/70" : "text-text-muted"}`}>
                {isDe
                  ? "Entscheide dich, bevor die Zeit abläuft — sonst werden alle in Coins umgewandelt."
                  : "Decide before time runs out — otherwise all cards will be auto-converted to coins."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Sound toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled((s) => !s)}
              className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted transition-colors"
              aria-label={soundEnabled ? "Mute" : "Unmute"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Timer display */}
            {secondsLeft !== null && (
              <div
                className={[
                  "flex items-center gap-1.5 rounded-xl px-4 py-2 text-lg font-mono font-bold tabular-nums",
                  isCritical
                    ? "bg-red-500/20 text-red-400 animate-pulse"
                    : isWarning
                      ? "bg-yellow-500/15 text-yellow-400"
                      : "bg-white/5 text-text-primary",
                ].join(" ")}
              >
                <Clock className="w-4 h-4" />
                {formatTime(secondsLeft)}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {secondsLeft !== null && pendingData.expiresAt && (
          <div className="h-1 bg-white/5">
            <div
              className={[
                "h-full transition-all duration-1000 ease-linear",
                isCritical ? "bg-red-500" : isWarning ? "bg-yellow-500" : "bg-pa-green",
              ].join(" ")}
              style={{
                width: `${Math.max(0, (secondsLeft / totalSeconds) * 100)}%`,
              }}
            />
          </div>
        )}

        {/* Card review */}
        <div className="flex-1">
          <CardReview
            cards={pendingData.cards}
            boxName={boxName}
            lang={lang}
            isRecovery={recoveredIndices.size > 0}
            recoveredIndices={recoveredIndices}
            choices={choices}
            onSetChoice={setChoice}
            onConfirm={() => void handleConfirm()}
            submitting={submitting}
          />
        </div>
      </div>

      {/* Children still render underneath but are non-interactive */}
      <div className="pointer-events-none" aria-hidden="true">
        {children}
      </div>
    </>
  );
}
