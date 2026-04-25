import { describe, it, expect } from "vitest";
import { validateVotePayload } from "@/lib/votes/eligibility";
import { Types } from "mongoose";

const oid = () => new Types.ObjectId().toHexString();

const makeCampaign = (overrides: Partial<{
  status: "draft" | "active" | "closed";
  topN: number;
  endsAt: Date | null;
  cardCount: number;
  cardIds: string[];
}> = {}) => {
  const cardCount = overrides.cardCount ?? 5;
  const cardIds = overrides.cardIds ?? Array.from({ length: cardCount }, oid);
  return {
    cardIds,
    campaign: {
      status: overrides.status ?? ("active" as const),
      topN: overrides.topN ?? 3,
      endsAt: overrides.endsAt ?? null,
      cards: cardIds.map((id) => ({ _id: id })),
    },
  };
};

describe("validateVotePayload", () => {
  it("accepts a valid selection within topN", () => {
    const { cardIds, campaign } = makeCampaign();
    const result = validateVotePayload({
      cardRefIds: cardIds.slice(0, 3),
      campaign,
    });
    expect(result).toEqual({ ok: true });
  });

  it("accepts an empty selection (user clears their vote)", () => {
    const { campaign } = makeCampaign();
    expect(validateVotePayload({ cardRefIds: [], campaign })).toEqual({ ok: true });
  });

  it("rejects when status is draft", () => {
    const { cardIds, campaign } = makeCampaign({ status: "draft" });
    const result = validateVotePayload({ cardRefIds: cardIds.slice(0, 1), campaign });
    expect(result).toEqual({ ok: false, error: "campaign_not_active" });
  });

  it("rejects when status is closed", () => {
    const { cardIds, campaign } = makeCampaign({ status: "closed" });
    expect(validateVotePayload({ cardRefIds: cardIds.slice(0, 1), campaign })).toEqual({
      ok: false,
      error: "campaign_not_active",
    });
  });

  it("rejects when endsAt has passed (lazy expired)", () => {
    const { cardIds, campaign } = makeCampaign({
      endsAt: new Date("2020-01-01"),
    });
    expect(
      validateVotePayload({
        cardRefIds: cardIds.slice(0, 1),
        campaign,
        now: new Date("2026-04-25"),
      })
    ).toEqual({ ok: false, error: "campaign_not_active" });
  });

  it("rejects when more than topN cards selected", () => {
    const { cardIds, campaign } = makeCampaign({ topN: 2 });
    expect(validateVotePayload({ cardRefIds: cardIds.slice(0, 3), campaign })).toEqual({
      ok: false,
      error: "too_many_votes",
    });
  });

  it("rejects duplicate card ids in selection", () => {
    const { cardIds, campaign } = makeCampaign();
    expect(
      validateVotePayload({
        cardRefIds: [cardIds[0], cardIds[0]],
        campaign,
      })
    ).toEqual({ ok: false, error: "duplicate_card" });
  });

  it("rejects malformed ObjectId", () => {
    const { campaign } = makeCampaign();
    expect(validateVotePayload({ cardRefIds: ["not-an-oid"], campaign })).toEqual({
      ok: false,
      error: "invalid_card_id",
    });
  });

  it("rejects card id that is not in the campaign", () => {
    const { campaign } = makeCampaign();
    expect(validateVotePayload({ cardRefIds: [oid()], campaign })).toEqual({
      ok: false,
      error: "unknown_card",
    });
  });
});
