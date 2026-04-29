/**
 * Wandelt den DB-Slug eines Spiels in ein User-facing Label.
 *
 * Box.game ist im Datenmodell ein freier Slug-String wie `one-piece-card-game`
 * oder `pokemon-tcg`. Für Toasts, Chat-Messages und das Pre-Reveal-Build-up
 * brauchen wir eine kurze, lesbare Schreibweise — Card-Game-Suffixe weg,
 * Trennzeichen zu Spaces, Words capitalisieren.
 */
export function formatGameLabel(game: string): string {
  if (!game) return "";
  return game
    .replace(/-card-game$/i, "")
    .replace(/-tcg$/i, "")
    .replace(/[-_]/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}
