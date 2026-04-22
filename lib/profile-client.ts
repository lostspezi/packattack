"use client";

/**
 * Shared /api/profile fetcher with in-flight deduplication.
 *
 * A single `coin-balance-change` event easily woke three subscribers at once
 * (header CoinBalance, BalancePage, pack/[id] page), each firing an
 * independent `fetch("/api/profile")`. This utility collapses concurrent
 * callers onto a single pending request so bursts produce one roundtrip.
 */
export interface ProfileSnapshot {
  coins?: number;
  [key: string]: unknown;
}

let inFlight: Promise<ProfileSnapshot | null> | null = null;

export function fetchProfile(): Promise<ProfileSnapshot | null> {
  if (inFlight) return inFlight;
  inFlight = fetch("/api/profile")
    .then(async (res) => (res.ok ? ((await res.json()) as ProfileSnapshot) : null))
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
