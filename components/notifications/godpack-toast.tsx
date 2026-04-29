"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";
import type { ChatEventEnvelope, GodpackIncomingEvent } from "@/types/chat";

interface ToastEntry {
  id: string;
  username: string;
  game: string;
}

interface GodpackToastProps {
  currentUserId?: string | null;
}

const TOAST_VISIBLE_MS = 8000;

/**
 * Site-wide Live-Notification, die feuert sobald irgendwo auf der Plattform
 * ein Godpack getriggert wurde. Hört direkt auf den Lobby-SSE-Stream und
 * ignoriert das Event für den glücklichen User selbst — der erlebt das
 * Cosmic-Reveal als personalisiertes Erlebnis und braucht kein Toast.
 *
 * Eigene EventSource-Connection: bewusst entkoppelt vom Chat-Dock, damit
 * der Banner auch auf /chat und /admin/chat erscheint, wo das Dock
 * absichtlich nicht mountet.
 */
export function GodpackToast({ currentUserId }: GodpackToastProps) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const dismissTimers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const source = new EventSource("/api/chat/events");

    source.onmessage = (event) => {
      let envelope: ChatEventEnvelope;
      try {
        envelope = JSON.parse(event.data) as ChatEventEnvelope;
      } catch {
        return;
      }
      if (envelope.type !== "godpack_incoming") return;
      const payload = envelope.payload as unknown as GodpackIncomingEvent;
      if (currentUserId && payload.ownerUserId === currentUserId) return;

      const toastId = `${payload.eventId}:${Date.now()}`;
      setToasts((prev) => [
        ...prev,
        { id: toastId, username: payload.username, game: payload.game },
      ]);

      const dismissId = window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId));
        dismissTimers.current.delete(toastId);
      }, TOAST_VISIBLE_MS);
      dismissTimers.current.set(toastId, dismissId);
    };

    source.onerror = () => {
      // EventSource schließt und reconnected automatisch — Logging optional.
    };

    return () => {
      source.close();
      for (const id of dismissTimers.current.values()) {
        window.clearTimeout(id);
      }
      dismissTimers.current.clear();
    };
  }, [currentUserId]);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: -28, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.45, ease: [0.32, 1.2, 0.32, 1] }}
            className="relative pointer-events-auto"
          >
            <div
              className="flex items-center gap-3 rounded-full px-5 py-2.5 backdrop-blur-md border border-amber-300/40"
              style={{
                background:
                  "linear-gradient(135deg, rgba(60, 20, 100, 0.92) 0%, rgba(20, 8, 40, 0.92) 100%)",
                boxShadow:
                  "0 0 0 1px rgba(255,210,110,0.15), 0 14px 32px rgba(0,0,0,0.45), 0 0 28px rgba(255,180,60,0.25)",
              }}
            >
              <Sparkles
                className="w-4 h-4 text-amber-300 drop-shadow-[0_0_8px_rgba(255,200,80,0.65)]"
                aria-hidden="true"
              />
              <p className="text-sm text-white font-medium">
                <span className="font-bold text-amber-200">{toast.username}</span>
                {" zieht GERADE ein "}
                <span className="font-bold uppercase tracking-wider text-amber-200">GODPACK</span>
                {" — "}
                <span className="text-amber-200">{toast.game}</span>
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
