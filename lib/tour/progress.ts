import type { TourState } from "@/lib/packi/tour-validation";

const LOCAL_STORAGE_KEY = "packi.tour.progress";

export interface LocalTourProgress {
  completedSteps: string[];
  lastStep: string | null;
  updatedAt: number;
}

/**
 * Fire-and-forget server sync. Optimistic: we always update localStorage
 * first so a flaky network doesn't block step advancement. Server-side
 * failures are logged but never surfaced — the tour keeps running.
 */
export async function patchTour(
  body: Record<string, unknown>,
): Promise<TourState | null> {
  try {
    const res = await fetch("/api/me/tour", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as TourState;
  } catch {
    return null;
  }
}

export function readLocalProgress(): LocalTourProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalTourProgress;
    if (!parsed || !Array.isArray(parsed.completedSteps)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLocalProgress(progress: LocalTourProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // storage full or disabled — acceptable, server copy is source of truth
  }
}

export function clearLocalProgress(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function mergeCompletedSteps(
  server: string[],
  local: string[],
): string[] {
  const set = new Set<string>();
  for (const s of server) set.add(s);
  for (const s of local) set.add(s);
  return [...set];
}
