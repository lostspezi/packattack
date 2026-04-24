/**
 * Zentrale XP-Sätze für alle Earning-Hooks. Hier änderst du die Balance,
 * ohne Call-Sites anfassen zu müssen.
 */

export const XP_RATES = {
  CARD_CONVERT: 3,
  BATTLE_WIN: 20,
  BATTLE_PARTICIPATE: 5,
  LOGIN_DAILY: 10,
  LOGIN_STREAK_BONUS_DAYS: 7,
  LOGIN_STREAK_BONUS_XP: 40,
} as const;

const RARITY_XP: Record<string, number> = {
  common: 2,
  uncommon: 3,
  rare: 5,
  "super rare": 8,
  epic: 10,
  legendary: 25,
  mythic: 50,
};

/**
 * XP für einen Pack-Pull. Rarity-Strings im Projekt sind nicht enum-basiert,
 * daher Fallback über coin-value bands. Cap gegen Missbrauch via hoher
 * conversionValue.
 */
export function xpForPackPull(rarity: string | null | undefined, coinValue: number): number {
  const key = typeof rarity === "string" ? rarity.toLowerCase().trim() : "";
  const mapped = key ? RARITY_XP[key] : undefined;
  if (mapped !== undefined) return mapped;
  if (!Number.isFinite(coinValue) || coinValue <= 0) return 1;
  if (coinValue <= 5) return 1;
  if (coinValue <= 15) return 3;
  if (coinValue <= 50) return 8;
  if (coinValue <= 100) return 15;
  return 25;
}

/** ISO-Datum (YYYY-MM-DD) in Server-Zeitzone. Genügt für Tages-Dedup. */
export function dayKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Ist `prev` genau ein Tag vor `current`? Für Streak-Erkennung. */
export function isConsecutiveDay(prev: string | null | undefined, current: string): boolean {
  if (!prev) return false;
  const prevDate = new Date(`${prev}T00:00:00Z`);
  const curDate = new Date(`${current}T00:00:00Z`);
  if (Number.isNaN(prevDate.getTime()) || Number.isNaN(curDate.getTime())) return false;
  const diffMs = curDate.getTime() - prevDate.getTime();
  return diffMs === 24 * 60 * 60 * 1000;
}
