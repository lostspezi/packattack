import { z } from "zod";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "invalid_object_id");

const bilingualStrict = z.object({
  de: z.string().trim().min(1).max(160),
  en: z.string().trim().min(1).max(160),
});

const bilingualOptional = z.object({
  de: z.string().trim().max(2000),
  en: z.string().trim().max(2000),
});

const cardInternal = z.object({
  source: z.literal("internal"),
  internalCardId: objectId,
  position: z.number().int().nonnegative(),
});

const cardJustTcg = z.object({
  source: z.literal("justtcg"),
  justTcgId: z.string().trim().min(1).max(120),
  position: z.number().int().nonnegative(),
  name: z.string().trim().min(1).max(200),
  game: z.string().trim().min(1).max(80),
  set: z.string().trim().min(1).max(120),
  setName: z.string().trim().min(1).max(200),
  rarity: z.string().trim().min(1).max(80),
  image: z.string().trim().url().nullable().optional(),
  tcgplayerId: z.string().trim().max(120).nullable().optional(),
});

export const cardInputSchema = z.discriminatedUnion("source", [cardInternal, cardJustTcg]);

export const createCampaignSchema = z
  .object({
    title: bilingualStrict,
    description: bilingualOptional.optional(),
    question: bilingualStrict,
    topN: z.number().int().min(1).max(10),
    endsAt: z.string().datetime().nullable().optional(),
    cards: z.array(cardInputSchema).min(1).max(100),
  })
  .refine((data) => data.topN <= data.cards.length, {
    message: "topN cannot exceed number of cards",
    path: ["topN"],
  });

export const patchCampaignSchema = z.object({
  title: bilingualStrict.optional(),
  description: bilingualOptional.optional(),
  question: bilingualStrict.optional(),
  topN: z.number().int().min(1).max(10).optional(),
  endsAt: z.string().datetime().nullable().optional(),
  cards: z.array(cardInputSchema).min(1).max(100).optional(),
});

export const patchActiveCampaignSchema = z.object({
  description: bilingualOptional.optional(),
  question: bilingualStrict.optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export type CreateCampaignPayload = z.infer<typeof createCampaignSchema>;
export type PatchCampaignPayload = z.infer<typeof patchCampaignSchema>;
export type PatchActiveCampaignPayload = z.infer<typeof patchActiveCampaignSchema>;
export type CardInput = z.infer<typeof cardInputSchema>;
