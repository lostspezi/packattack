/**
 * Shared box weight distribution validation.
 * Used by both the API (publish guard) and the UI (distribution check).
 */

export type ValidationLevel = "error" | "warning" | "tip" | "ok";

export interface ValidationItem {
  level: ValidationLevel;
  message: { de: string; en: string };
}

export interface BoxValidationInput {
  cards: Array<{
    name: string;
    weight: number;
    rarity: string;
  }>;
  rarityWeights: Array<{ rarity: string }>;
  cardsPerPack: number;
}

export function validateBoxWeights(input: BoxValidationInput): ValidationItem[] {
  const { cards, rarityWeights, cardsPerPack } = input;
  const items: ValidationItem[] = [];

  if (cards.length === 0) {
    items.push({
      level: "error",
      message: {
        de: "Die Box enthält keine Karten — es muss mindestens eine Karte hinzugefügt werden.",
        en: "The box contains no cards — at least one card must be added.",
      },
    });
    return items;
  }

  const totalWeight = cards.reduce((a, c) => a + c.weight, 0);

  // Cards per pack > available cards
  if (cardsPerPack > cards.length) {
    items.push({
      level: "error",
      message: {
        de: `Karten pro Pack (${cardsPerPack}) ist größer als die Anzahl der Karten in der Box (${cards.length}).`,
        en: `Cards per pack (${cardsPerPack}) exceeds the number of cards in the box (${cards.length}).`,
      },
    });
  }

  // Only 1 card
  if (cards.length === 1) {
    items.push({
      level: "warning",
      message: {
        de: "Nur 1 Karte in der Box — es gibt keine Abwechslung beim Ziehen.",
        en: "Only 1 card in the box — there's no variety when drawing.",
      },
    });
  }

  // All weights identical
  const allSameWeight = cards.every((c) => c.weight === cards[0].weight);
  if (allSameWeight && cards.length > 1) {
    items.push({
      level: "tip",
      message: {
        de: "Alle Karten haben das gleiche Gewicht — jede hat die selbe Ziehchance. Passe die Gewichte an, wenn manche Karten seltener sein sollen.",
        en: "All cards have the same weight — each has an equal draw chance. Adjust weights if some cards should be rarer.",
      },
    });
  }

  // Single card dominates >80%
  const dominant = cards.find((c) => totalWeight > 0 && (c.weight / totalWeight) * 100 > 80);
  if (dominant && cards.length > 1) {
    const pct = ((dominant.weight / totalWeight) * 100).toFixed(1);
    items.push({
      level: "warning",
      message: {
        de: `"${dominant.name}" hat ${pct}% Ziehchance — sie dominiert die Box fast komplett.`,
        en: `"${dominant.name}" has a ${pct}% draw chance — it almost completely dominates the box.`,
      },
    });
  }

  // Rarity >90%
  const rarityMap = new Map<string, number>();
  for (const card of cards) {
    rarityMap.set(card.rarity, (rarityMap.get(card.rarity) ?? 0) + card.weight);
  }
  for (const [rarity, weight] of rarityMap) {
    const pct = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
    if (pct > 90 && rarityMap.size > 1) {
      items.push({
        level: "warning",
        message: {
          de: `Die Rarität "${rarity}" macht ${pct.toFixed(1)}% aus — die anderen Raritäten sind fast unerreichbar.`,
          en: `Rarity "${rarity}" accounts for ${pct.toFixed(1)}% — other rarities are nearly unreachable.`,
        },
      });
    }
  }

  // Cards with <0.01% chance
  const ghostCards = cards.filter((c) => totalWeight > 0 && (c.weight / totalWeight) * 100 < 0.01);
  if (ghostCards.length > 0) {
    const names = ghostCards.length <= 3 ? ` (${ghostCards.map((c) => c.name).join(", ")})` : "";
    items.push({
      level: "tip",
      message: {
        de: `${ghostCards.length} Karte(n) mit unter 0.01% Ziehchance — sie werden extrem selten gezogen.${names}`,
        en: `${ghostCards.length} card(s) with less than 0.01% draw chance — they will be drawn extremely rarely.${names}`,
      },
    });
  }

  // Rarities with no cards
  const usedRarities = new Set(cards.map((c) => c.rarity));
  const emptyRarities = rarityWeights.filter((rw) => rw.rarity && !usedRarities.has(rw.rarity));
  if (emptyRarities.length > 0) {
    items.push({
      level: "tip",
      message: {
        de: `Raritäten ohne Karten: ${emptyRarities.map((r) => `"${r.rarity}"`).join(", ")} — diese können entfernt werden.`,
        en: `Rarities with no cards: ${emptyRarities.map((r) => `"${r.rarity}"`).join(", ")} — these can be removed.`,
      },
    });
  }

  return items;
}

/** Returns true if the box has any errors that should block publishing. */
export function hasPublishBlockingErrors(items: ValidationItem[]): boolean {
  return items.some((i) => i.level === "error");
}

/** Returns true if the box has warnings (non-blocking but concerning). */
export function hasWarnings(items: ValidationItem[]): boolean {
  return items.some((i) => i.level === "warning");
}
