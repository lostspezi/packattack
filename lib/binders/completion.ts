import type { PlainPage } from "./slot-ops";

export interface CompletionStats {
  expected: number;
  matched: number;
  filledTotal: number;
  ratio: number;
}

/**
 * Counts template completion: how many slots that have an expected card also
 * hold a pack pull whose underlying master card matches the expected.
 *
 * The caller passes a resolver because the slot itself only knows the
 * packPullId, not the master cardId. Resolver: packPullId -> cardId.
 *
 * Slots without expectedCardId do not contribute to either side of the ratio.
 */
export function computeCompletion(
  pages: PlainPage[],
  resolveCardId: (packPullId: string) => string | null,
): CompletionStats {
  let expected = 0;
  let matched = 0;
  let filledTotal = 0;
  for (const page of pages) {
    for (const slot of page.slots) {
      if (slot.packPullId) filledTotal += 1;
      if (!slot.expectedCardId) continue;
      expected += 1;
      if (!slot.packPullId) continue;
      const cardId = resolveCardId(slot.packPullId);
      if (cardId && cardId === slot.expectedCardId) matched += 1;
    }
  }
  const ratio = expected === 0 ? 0 : matched / expected;
  return { expected, matched, filledTotal, ratio };
}
