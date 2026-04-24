/**
 * Level-System Konfiguration für PACKATTACK.
 *
 * Formel: XP zum Aufstieg von Level N nach N+1 = round(BASE_XP * N^EXPONENT)
 * Moderat progressive Kurve (Level 10 nach ~15k Gesamt-XP, Level 100 bei ~8,5M).
 *
 * Level ist hart gecapped auf MAX_LEVEL. Jenseits davon akkumuliert nur noch XP,
 * ohne dass sich das Level ändert (Prestige-Anzeige, falls später gewünscht).
 */

export const MAX_LEVEL = 100;
export const BASE_XP = 100;
export const EXPONENT = 1.6;

export const LEVEL_MILESTONES: readonly number[] = [10, 25, 50, 100];

/** XP, die nötig sind, um von `level` nach `level + 1` aufzusteigen. */
export function xpForLevelUp(level: number): number {
  if (!Number.isFinite(level) || level < 1) return 0;
  if (level >= MAX_LEVEL) return Number.POSITIVE_INFINITY;
  return Math.round(BASE_XP * Math.pow(level, EXPONENT));
}

/** Kumulative XP, die nötig sind, um `level` (ab Level 1) zu erreichen. Level 1 = 0 XP. */
export function totalXpForLevel(level: number): number {
  if (!Number.isFinite(level) || level <= 1) return 0;
  const cap = Math.min(Math.floor(level), MAX_LEVEL);
  let total = 0;
  for (let i = 1; i < cap; i++) {
    total += xpForLevelUp(i);
  }
  return total;
}

// Precomputed cumulative XP lookup for fast level-from-xp resolution.
// cumulativeXp[n] = kumulative XP, um Level (n+1) zu erreichen.
// Also cumulativeXp[0] = 0 (Level 1 braucht 0 XP),
//      cumulativeXp[1] = xpForLevelUp(1) (Level 2),
//      cumulativeXp[MAX_LEVEL - 1] = XP für MAX_LEVEL.
// Die Semantik spiegelt totalXpForLevel(level+1); beide Funktionen müssen
// synchron bleiben, wenn die Formel geändert wird.
const cumulativeXp: number[] = (() => {
  const table = new Array<number>(MAX_LEVEL);
  let sum = 0;
  table[0] = 0;
  for (let level = 1; level < MAX_LEVEL; level++) {
    sum += xpForLevelUp(level);
    table[level] = sum;
  }
  return table;
})();

/**
 * Gibt das Level zurück, das einem Gesamt-XP-Wert entspricht (binary search).
 * Negative/NaN-Eingaben werden als Level 1 behandelt (Defensiv-Annahme).
 */
export function levelForTotalXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1;
  let lo = 1;
  let hi = MAX_LEVEL;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (cumulativeXp[mid - 1] <= xp) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

/** Wie viel XP der User bereits im aktuellen Level gesammelt hat. */
export function xpIntoLevel(xp: number): number {
  const level = levelForTotalXp(xp);
  return Math.max(0, xp - totalXpForLevel(level));
}

/** Wie viel XP bis zum nächsten Level fehlen. 0 wenn Max-Level erreicht. */
export function xpToNextLevel(xp: number): number {
  const level = levelForTotalXp(xp);
  if (level >= MAX_LEVEL) return 0;
  return xpForLevelUp(level) - xpIntoLevel(xp);
}

/** Fortschritt 0..1 im aktuellen Level. Max-Level zeigt 1. */
export function progressInLevel(xp: number): number {
  const level = levelForTotalXp(xp);
  if (level >= MAX_LEVEL) return 1;
  const needed = xpForLevelUp(level);
  if (needed <= 0) return 1;
  return xpIntoLevel(xp) / needed;
}

/** Ist `level` ein Milestone-Level (prominente Feier, Push erlaubt)? */
export function isLevelMilestone(level: number): boolean {
  return LEVEL_MILESTONES.includes(level);
}
