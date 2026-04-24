import type { UserEffects } from "./effects";

/**
 * Liefert den anzuzeigenden Titel: bevorzugt die User-Auswahl, sofern sie
 * noch in den freigeschalteten Titeln steckt. Sonst der zuletzt
 * freigeschaltete Titel (letzter Eintrag in der Liste). Sonst null.
 */
export function resolveDisplayTitle(
  effects: Pick<UserEffects, "cosmetics">,
  equipped: string | null | undefined,
): string | null {
  const titles = effects.cosmetics.titles;
  if (titles.length === 0) return null;
  if (equipped && titles.includes(equipped)) return equipped;
  return titles[titles.length - 1] ?? null;
}
