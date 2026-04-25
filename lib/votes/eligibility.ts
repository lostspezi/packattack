import type { UpvoteCampaignStatus } from "@/models/upvote-campaign";

export type VoteValidationError =
  | "campaign_not_active"
  | "too_many_votes"
  | "duplicate_card"
  | "unknown_card"
  | "invalid_card_id";

export interface ValidateVotePayloadInput {
  cardRefIds: string[];
  campaign: {
    status: UpvoteCampaignStatus;
    topN: number;
    endsAt: Date | null;
    cards: { _id: { toString(): string } }[];
  };
  now?: Date;
}

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export function validateVotePayload(
  input: ValidateVotePayloadInput
): { ok: true } | { ok: false; error: VoteValidationError } {
  const { cardRefIds, campaign } = input;
  const now = input.now ?? new Date();

  if (campaign.status !== "active") return { ok: false, error: "campaign_not_active" };
  if (campaign.endsAt && campaign.endsAt.getTime() <= now.getTime()) {
    return { ok: false, error: "campaign_not_active" };
  }
  if (cardRefIds.length > campaign.topN) return { ok: false, error: "too_many_votes" };

  const seen = new Set<string>();
  for (const id of cardRefIds) {
    if (!OBJECT_ID_RE.test(id)) return { ok: false, error: "invalid_card_id" };
    if (seen.has(id)) return { ok: false, error: "duplicate_card" };
    seen.add(id);
  }

  const validIds = new Set(campaign.cards.map((c) => c._id.toString()));
  for (const id of cardRefIds) {
    if (!validIds.has(id)) return { ok: false, error: "unknown_card" };
  }

  return { ok: true };
}
