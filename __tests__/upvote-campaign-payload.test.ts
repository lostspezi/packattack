import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import {
  cardInputSchema,
  createCampaignSchema,
  patchActiveCampaignSchema,
} from "@/lib/admin/upvote-campaign-payload";

const oid = () => new Types.ObjectId().toHexString();

const validInternalCard = () => ({
  source: "internal" as const,
  internalCardId: oid(),
  position: 0,
});

const validJustTcgCard = (position = 0) => ({
  source: "justtcg" as const,
  justTcgId: "tcg_abc_123",
  position,
  name: "Charizard",
  game: "pokemon",
  set: "base1",
  setName: "Base Set",
  rarity: "Holo Rare",
  image: "https://example.com/charizard.png",
  tcgplayerId: "12345",
});

describe("cardInputSchema", () => {
  it("accepts a valid internal card", () => {
    expect(cardInputSchema.safeParse(validInternalCard()).success).toBe(true);
  });

  it("accepts a valid JustTCG card", () => {
    expect(cardInputSchema.safeParse(validJustTcgCard()).success).toBe(true);
  });

  it("rejects invalid ObjectId for internal source", () => {
    const result = cardInputSchema.safeParse({
      source: "internal",
      internalCardId: "not-an-oid",
      position: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative position", () => {
    const result = cardInputSchema.safeParse({
      ...validInternalCard(),
      position: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown source value", () => {
    const result = cardInputSchema.safeParse({
      source: "external",
      justTcgId: "x",
      position: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("createCampaignSchema", () => {
  const baseValid = () => ({
    title: { de: "Beste Karten", en: "Best cards" },
    question: { de: "Welche kommt rein?", en: "Which one is in?" },
    topN: 3,
    cards: [validInternalCard(), validJustTcgCard(1), validInternalCard(), validInternalCard()],
  });

  it("accepts a fully valid payload", () => {
    expect(createCampaignSchema.safeParse(baseValid()).success).toBe(true);
  });

  it("accepts payload with optional description and endsAt", () => {
    const payload = {
      ...baseValid(),
      description: { de: "Vote", en: "Vote" },
      endsAt: "2026-12-31T23:59:59.000Z",
    };
    expect(createCampaignSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects when topN exceeds card count", () => {
    const payload = { ...baseValid(), topN: 5, cards: [validInternalCard()] };
    expect(createCampaignSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects empty cards array", () => {
    const payload = { ...baseValid(), cards: [] };
    expect(createCampaignSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects empty bilingual title", () => {
    const payload = { ...baseValid(), title: { de: "", en: "Hello" } };
    expect(createCampaignSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects topN out of range", () => {
    const payload = { ...baseValid(), topN: 11 };
    expect(createCampaignSchema.safeParse(payload).success).toBe(false);
  });
});

describe("patchActiveCampaignSchema", () => {
  it("accepts description / question / endsAt updates", () => {
    expect(
      patchActiveCampaignSchema.safeParse({
        description: { de: "neu", en: "new" },
        question: { de: "Was?", en: "What?" },
        endsAt: "2026-12-31T23:59:59.000Z",
      }).success
    ).toBe(true);
  });

  it("ignores extra fields like topN or cards", () => {
    const result = patchActiveCampaignSchema.safeParse({
      question: { de: "Hi", en: "Hi" },
      topN: 5,
      cards: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).topN).toBeUndefined();
      expect((result.data as Record<string, unknown>).cards).toBeUndefined();
    }
  });

  it("accepts an empty patch (no-op)", () => {
    expect(patchActiveCampaignSchema.safeParse({}).success).toBe(true);
  });
});
