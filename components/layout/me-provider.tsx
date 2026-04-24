"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TourState } from "@/lib/packi/tour-validation";

export interface MeSnapshot {
  coins: number;
  role: string;
  level: number;
  xp: number;
  cart: {
    totalItems: number;
    cartExpiresInSeconds: number;
  };
  pending: { exists: boolean };
  event: { startsAt: string; status: string } | null;
  tour: TourState;
}

export interface MeContextValue {
  me: MeSnapshot | null;
  setTour: (next: TourState) => void;
}

const MeContext = createContext<MeContextValue | null>(null);

/**
 * Fetches the consolidated /api/me snapshot once per mount so every
 * dashboard header widget (coin balance, cart badge, event countdown,
 * pending-pull guard) can hydrate from a single request instead of each
 * firing its own initial fetch. Event-driven refreshes remain per-widget;
 * this provider is strictly for collapsing the cold-load burst.
 *
 * setTour lets callers (Packi, Tour engine) push an updated tour state
 * back into the snapshot after a PATCH /api/me/tour without re-fetching.
 */
export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((res) => (res.ok ? (res.json() as Promise<MeSnapshot>) : null))
      .then((data) => {
        if (!cancelled && data) setMe(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setTour = useCallback((next: TourState) => {
    setMe((prev) => (prev ? { ...prev, tour: next } : prev));
  }, []);

  const value = useMemo<MeContextValue>(() => ({ me, setTour }), [me, setTour]);

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe(): MeSnapshot | null {
  return useContext(MeContext)?.me ?? null;
}

export function useMeContext(): MeContextValue {
  const ctx = useContext(MeContext);
  if (!ctx) {
    throw new Error("useMeContext must be used within <MeProvider>");
  }
  return ctx;
}
