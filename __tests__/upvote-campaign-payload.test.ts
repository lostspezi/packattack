import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import {
  itemInputSchema,
  createCampaignSchema,
  patchActiveCampaignSchema,
} from "@/lib/admin/upvote-campaign-payload";

const oid = () => new Types.ObjectId().toHexString();

const validInternalCard = () => ({
  kind: "card" as const,
  source: "internal" as const,
  internalCardId: oid(),
  position: 0,
});

const validJustTcgCard = (position = 0) => ({
  kind: "card" as const,
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

const validBox = (position = 0) => ({
  kind: "box" as const,
  boxId: oid(),
  position,
});

const validOption = (position = 0) => ({
  kind: "option" as const,
  label: { de: "Pokemon", en: "Pokemon" },
  description: { de: "Sammelkartenspiel", en: "Trading card game" },
  image: "https://example.com/pokemon.png",
  position,
});

describe("itemInputSchema (discriminated union by kind)", () => {
  it("accepts a valid internal card", () => {
    expect(itemInputSchema.safeParse(validInternalCard()).success).toBe(true);
  });

  it("accepts a valid JustTCG card", () => {
    expect(itemInputSchema.safeParse(validJustTcgCard()).success).toBe(true);
  });

  it("accepts a valid box reference", () => {
    expect(itemInputSchema.safeParse(validBox()).success).toBe(true);
  });

  it("accepts a valid option", () => {
    expect(itemInputSchema.safeParse(validOption()).success).toBe(true);
  });

  it("accepts an option with no description and no image", () => {
    const minimal = {
      kind: "option" as const,
      label: { de: "Foo", en: "Foo" },
      position: 0,
    };
    expect(itemInputSchema.safeParse(minimal).success).toBe(true);
  });

  it("rejects internal card without internalCardId", () => {
    const result = itemInputSchema.safeParse({
      kind: "card",
      source: "internal",
      position: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects justtcg card missing required snapshot fields", () => {
    const result = itemInputSchema.safeParse({
      kind: "card",
      source: "justtcg",
      justTcgId: "x",
      position: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects box without valid boxId", () => {
    expect(
      itemInputSchema.safeParse({ kind: "box", boxId: "not-an-oid", position: 0 }).success
    ).toBe(false);
  });

  it("rejects option with empty label", () => {
    expect(
      itemInputSchema.safeParse({
        kind: "option",
        label: { de: "", en: "Hi" },
        position: 0,
      }).success
    ).toBe(false);
  });

  it("rejects unknown kind value", () => {
    expect(
      itemInputSchema.safeParse({ kind: "mystery", position: 0 }).success
    ).toBe(false);
  });

  it("rejects negative position", () => {
    expect(
      itemInputSchema.safeParse({ ...validInternalCard(), position: -1 }).success
    ).toBe(false);
  });
});

describe("createCampaignSchema", () => {
  const baseValid = () => ({
    title: { de: "Beste Karten", en: "Best cards" },
    question: { de: "Welche kommt rein?", en: "Which one is in?" },
    topN: 3,
    items: [validInternalCard(), validJustTcgCard(1), validInternalCard(), validInternalCard()],
  });

  it("accepts a fully valid card payload", () => {
    expect(createCampaignSchema.safeParse(baseValid()).success).toBe(true);
  });

  it("accepts a mixed payload (cards + boxes + options)", () => {
    const payload = {
      ...baseValid(),
      items: [validInternalCard(), validBox(1), validOption(2), validJustTcgCard(3)],
    };
    expect(createCampaignSchema.safeParse(payload).success).toBe(true);
  });

  it("accepts payload with optional description and endsAt", () => {
    const payload = {
      ...baseValid(),
      description: { de: "Vote", en: "Vote" },
      endsAt: "2026-12-31T23:59:59.000Z",
    };
    expect(createCampaignSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects when topN exceeds item count", () => {
    const payload = { ...baseValid(), topN: 5, items: [validBox(0)] };
    expect(createCampaignSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects empty items array", () => {
    const payload = { ...baseValid(), items: [] };
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

  it("ignores extra fields like topN or items", () => {
    const result = patchActiveCampaignSchema.safeParse({
      question: { de: "Hi", en: "Hi" },
      topN: 5,
      items: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).topN).toBeUndefined();
      expect((result.data as Record<string, unknown>).items).toBeUndefined();
    }
  });

  it("accepts an empty patch (no-op)", () => {
    expect(patchActiveCampaignSchema.safeParse({}).success).toBe(true);
  });
});
