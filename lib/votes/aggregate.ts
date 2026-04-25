export interface AggregateVoteInput {
  itemRefId: string;
  userId: string;
}

export interface AggregateVoteOutput {
  itemRefId: string;
  voteCount: number;
}

/**
 * Reduziert flache Vote-Records (eine Reihe pro User-x-Item) zu pro-Item
 * Vote-Counts. Items ohne Stimmen erscheinen mit count 0, sofern in
 * `allItemRefIds` enthalten — wichtig für vollständige Reveal-Anzeige.
 *
 * Tie-Breaker: stabile Sortierung über `position` (Caller-supplied), sekundär
 * `itemRefId` lexikografisch — verhindert Flackern bei Gleichstand.
 */
export function aggregateVotes(
  votes: AggregateVoteInput[],
  allItemRefIds: string[]
): AggregateVoteOutput[] {
  const counts = new Map<string, number>();
  for (const id of allItemRefIds) counts.set(id, 0);
  for (const vote of votes) {
    if (!counts.has(vote.itemRefId)) continue;
    counts.set(vote.itemRefId, (counts.get(vote.itemRefId) ?? 0) + 1);
  }
  return [...counts.entries()].map(([itemRefId, voteCount]) => ({
    itemRefId,
    voteCount,
  }));
}

export function rankAggregatedVotes(
  aggregated: AggregateVoteOutput[],
  positionByItemRefId: Map<string, number>
): AggregateVoteOutput[] {
  return [...aggregated].sort((a, b) => {
    if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
    const posA = positionByItemRefId.get(a.itemRefId) ?? Number.MAX_SAFE_INTEGER;
    const posB = positionByItemRefId.get(b.itemRefId) ?? Number.MAX_SAFE_INTEGER;
    if (posA !== posB) return posA - posB;
    return a.itemRefId.localeCompare(b.itemRefId);
  });
}

export function countUniqueVoters(votes: AggregateVoteInput[]): number {
  return new Set(votes.map((v) => v.userId)).size;
}
