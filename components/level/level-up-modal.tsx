"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Trophy, X } from "lucide-react";

interface PendingNotification {
  _id: string;
  title: string;
  message: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  meta: {
    kind?: string;
    oldLevel?: number;
    newLevel?: number;
    isMilestone?: boolean;
    unlockedCount?: number;
    achievementKey?: string;
  } | null;
  createdAt: string;
}

/**
 * Eingebettetes Modal, das beim Mount nach unconfirmed Level-Up- oder
 * Achievement-Notifications fragt und der Reihe nach zeigt. Acknowledgt
 * jede Notification, bevor die nächste erscheint.
 */
export function LevelUpModal() {
  const [queue, setQueue] = useState<PendingNotification[]>([]);
  // `visible` ist der erste Eintrag der Queue — abgeleitet statt separat
  // gemanagt, damit kein Effekt nach jedem Poll nachziehen muss.
  const visible = queue[0] ?? null;

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch("/api/me/notifications/level-up", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data.notifications) ? (data.notifications as PendingNotification[]) : [];
      if (list.length === 0) return;
      setQueue((prev) => {
        const existingIds = new Set(prev.map((n) => n._id));
        const incoming = list.filter((n) => !existingIds.has(n._id));
        return incoming.length > 0 ? [...prev, ...incoming] : prev;
      });
    } catch {
      // Silent — network blips should not break UI
    }
  }, []);

  useEffect(() => {
    // Initial fetch + regelmäßig nachziehen. setState landet hier in der
    // async fetchPending-Kette — Mount-Side-Effect, kein Render-Loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPending();
    const id = setInterval(() => {
      void fetchPending();
    }, 60_000);
    return () => clearInterval(id);
  }, [fetchPending]);

  const dismiss = useCallback(async () => {
    if (!visible) return;
    const id = visible._id;
    setQueue((prev) => prev.filter((n) => n._id !== id));
    try {
      await fetch("/api/me/notifications/level-up", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch {
      // Next polling round will retry acknowledgment.
    }
  }, [visible]);

  if (!visible) return null;

  const isLevelUp = visible.meta?.kind === "level_up";
  const isMilestone = visible.meta?.isMilestone === true;
  const newLevel = visible.meta?.newLevel ?? null;
  const oldLevel = visible.meta?.oldLevel ?? null;
  const unlockedCount = visible.meta?.unlockedCount ?? 0;
  // Der allererste Level-Up (1 → 2) ist für den User ein „Ah, das passiert
  // wirklich“-Moment und verdient Konfetti — auch wenn Level 2 technisch kein
  // Milestone ist. Danach bleibt's reserviert für die großen Stufen.
  const celebrate = isMilestone || (isLevelUp && oldLevel === 1 && newLevel === 2);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      {celebrate && <Confetti />}
      <Card className="relative w-full max-w-md p-6 text-center space-y-4 shadow-xl">
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-3 right-3 text-secondary hover:text-primary"
          aria-label="Schließen"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex justify-center">
          <div
            className={
              celebrate
                ? "h-20 w-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 grid place-items-center"
                : "h-16 w-16 rounded-full bg-pa-green/20 grid place-items-center"
            }
          >
            {isLevelUp ? (
              <Trophy className={celebrate ? "h-10 w-10 text-white" : "h-8 w-8 text-pa-green"} />
            ) : (
              <Sparkles className="h-8 w-8 text-pa-green" />
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-primary">{visible.title}</h2>
          {isLevelUp && newLevel != null && (
            <div className="text-4xl font-black text-primary mt-1">Level {newLevel}</div>
          )}
          <p className="text-sm text-secondary mt-2">{visible.message}</p>
        </div>

        {unlockedCount > 0 && (
          <p className="text-sm text-pa-green">
            {unlockedCount} neue Belohnung{unlockedCount > 1 ? "en" : ""} freigeschaltet.
          </p>
        )}

        <div className="flex justify-center gap-2 pt-2">
          <Button variant="secondary" onClick={dismiss}>Später</Button>
          <Button
            onClick={() => {
              dismiss();
              window.location.href = "/profile/achievements";
            }}
          >
            Ansehen
          </Button>
        </div>
      </Card>
    </div>
  );
}

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  hue: number;
}

function Confetti() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  // Random-Werte einmalig im Client-Effekt erzeugen — so bleibt Rendering
  // pur und SSR/CSR stimmen überein. Der initiale Seed ist ein legitimer
  // Side-Effect, der die UI erst nach Mount mit Konfetti füllt.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPieces(
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 2 + Math.random() * 2,
        hue: Math.floor(Math.random() * 360),
      })),
    );
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-[-10%] block h-2 w-2 rounded-sm"
          style={{
            left: `${p.left}%`,
            background: `hsl(${p.hue}, 90%, 60%)`,
            animation: `pa-confetti-fall ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes pa-confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
