"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface MeSnapshot {
  coins: number;
  role: string;
  cart: {
    totalItems: number;
    cartExpiresInSeconds: number;
  };
  pending: { exists: boolean };
  event: { startsAt: string; status: string } | null;
}

const MeContext = createContext<MeSnapshot | null>(null);

/**
 * Fetches the consolidated /api/me snapshot once per mount so every
 * dashboard header widget (coin balance, cart badge, event countdown,
 * pending-pull guard) can hydrate from a single request instead of each
 * firing its own initial fetch. Event-driven refreshes remain per-widget;
 * this provider is strictly for collapsing the cold-load burst.
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

  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}

export function useMe(): MeSnapshot | null {
  return useContext(MeContext);
}
