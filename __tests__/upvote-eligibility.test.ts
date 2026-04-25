import { describe, it, expect } from "vitest";
import { validateVotePayload } from "@/lib/votes/eligibility";
import { Types } from "mongoose";

const oid = () => new Types.ObjectId().toHexString();

const makeCampaign = (
  overrides: Partial<{
    status: "draft" | "active" | "closed";
    topN: number;
    endsAt: Date | null;
    itemCount: number;
    itemIds: string[];
  }> = {}
) => {
  const itemCount = overrides.itemCount ?? 5;
  const itemIds = overrides.itemIds ?? Array.from({ length: itemCount }, oid);
  return {
    itemIds,
    campaign: {
      status: overrides.status ?? ("active" as const),
      topN: overrides.topN ?? 3,
      endsAt: overrides.endsAt ?? null,
      items: itemIds.map((id) => ({ _id: id })),
    },
  };
};

describe("validateVotePayload", () => {
  it("accepts a valid selection within topN", () => {
    const { itemIds, campaign } = makeCampaign();
    const result = validateVotePayload({
      itemRefIds: itemIds.slice(0, 3),
      campaign,
    });
    expect(result).toEqual({ ok: true });
  });

  it("accepts an empty selection (user clears their vote)", () => {
    const { campaign } = makeCampaign();
    expect(validateVotePayload({ itemRefIds: [], campaign })).toEqual({ ok: true });
  });

  it("rejects when status is draft", () => {
    const { itemIds, campaign } = makeCampaign({ status: "draft" });
    const result = validateVotePayload({ itemRefIds: itemIds.slice(0, 1), campaign });
    expect(result).toEqual({ ok: false, error: "campaign_not_active" });
  });

  it("rejects when status is closed", () => {
    const { itemIds, campaign } = makeCampaign({ status: "closed" });
    expect(validateVotePayload({ itemRefIds: itemIds.slice(0, 1), campaign })).toEqual({
      ok: false,
      error: "campaign_not_active",
    });
  });

  it("rejects when endsAt has passed (lazy expired)", () => {
    const { itemIds, campaign } = makeCampaign({
      endsAt: new Date("2020-01-01"),
    });
    expect(
      validateVotePayload({
        itemRefIds: itemIds.slice(0, 1),
        campaign,
        now: new Date("2026-04-25"),
      })
    ).toEqual({ ok: false, error: "campaign_not_active" });
  });

  it("rejects when more than topN items selected", () => {
    const { itemIds, campaign } = makeCampaign({ topN: 2 });
    expect(validateVotePayload({ itemRefIds: itemIds.slice(0, 3), campaign })).toEqual({
      ok: false,
      error: "too_many_votes",
    });
  });

  it("rejects duplicate item ids in selection", () => {
    const { itemIds, campaign } = makeCampaign();
    expect(
      validateVotePayload({
        itemRefIds: [itemIds[0], itemIds[0]],
        campaign,
      })
    ).toEqual({ ok: false, error: "duplicate_item" });
  });

  it("rejects malformed ObjectId", () => {
    const { campaign } = makeCampaign();
    expect(validateVotePayload({ itemRefIds: ["not-an-oid"], campaign })).toEqual({
      ok: false,
      error: "invalid_item_id",
    });
  });

  it("rejects item id that is not in the campaign", () => {
    const { campaign } = makeCampaign();
    expect(validateVotePayload({ itemRefIds: [oid()], campaign })).toEqual({
      ok: false,
      error: "unknown_item",
    });
  });
});
