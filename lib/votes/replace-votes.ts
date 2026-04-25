type IdLike = { toString(): string };

export interface ReplaceVotesInput {
  campaignId: IdLike;
  userId: IdLike;
  currentCardRefIds: IdLike[];
  desiredCardRefIds: IdLike[];
}

export interface ReplaceVotesPlan {
  toInsert: string[];
  toDelete: string[];
  unchanged: string[];
}

export function planVoteReplacement(input: ReplaceVotesInput): ReplaceVotesPlan {
  const current = new Set(input.currentCardRefIds.map((id) => id.toString()));
  const desired = new Set(input.desiredCardRefIds.map((id) => id.toString()));

  const toInsert: string[] = [];
  const toDelete: string[] = [];
  const unchanged: string[] = [];

  for (const id of desired) {
    if (current.has(id)) unchanged.push(id);
    else toInsert.push(id);
  }
  for (const id of current) {
    if (!desired.has(id)) toDelete.push(id);
  }

  return { toInsert, toDelete, unchanged };
}
