export interface AggregateVoteInput {
  cardRefId: string;
  userId: string;
}

export interface AggregateVoteOutput {
  cardRefId: string;
  voteCount: number;
}

/**
 * Reduziert flache Vote-Records (eine Reihe pro User-x-Karte) zu pro-Karte
 * Vote-Counts. Karten ohne Stimmen erscheinen mit count 0, sofern in
 * `allCardRefIds` enthalten — wichtig für vollständige Reveal-Anzeige.
 *
 * Tie-Breaker: stabile Sortierung über `position` (Caller-supplied), sekundär
 * `cardRefId` lexikografisch — verhindert Flackern bei Gleichstand.
 */
export function aggregateVotes(
  votes: AggregateVoteInput[],
  allCardRefIds: string[]
): AggregateVoteOutput[] {
  const counts = new Map<string, number>();
  for (const id of allCardRefIds) counts.set(id, 0);
  for (const vote of votes) {
    if (!counts.has(vote.cardRefId)) continue;
    counts.set(vote.cardRefId, (counts.get(vote.cardRefId) ?? 0) + 1);
  }
  return [...counts.entries()].map(([cardRefId, voteCount]) => ({
    cardRefId,
    voteCount,
  }));
}

export function rankAggregatedVotes(
  aggregated: AggregateVoteOutput[],
  positionByCardRefId: Map<string, number>
): AggregateVoteOutput[] {
  return [...aggregated].sort((a, b) => {
    if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
    const posA = positionByCardRefId.get(a.cardRefId) ?? Number.MAX_SAFE_INTEGER;
    const posB = positionByCardRefId.get(b.cardRefId) ?? Number.MAX_SAFE_INTEGER;
    if (posA !== posB) return posA - posB;
    return a.cardRefId.localeCompare(b.cardRefId);
  });
}

export function countUniqueVoters(votes: AggregateVoteInput[]): number {
  return new Set(votes.map((v) => v.userId)).size;
}
