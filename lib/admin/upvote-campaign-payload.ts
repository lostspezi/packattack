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

const positionSchema = z.number().int().nonnegative();

const cardItemSchema = z
  .object({
    kind: z.literal("card"),
    source: z.enum(["internal", "justtcg"]),
    internalCardId: objectId.optional(),
    justTcgId: z.string().trim().min(1).max(120).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    game: z.string().trim().min(1).max(80).optional(),
    set: z.string().trim().min(1).max(120).optional(),
    setName: z.string().trim().min(1).max(200).optional(),
    rarity: z.string().trim().min(1).max(80).optional(),
    image: z.string().trim().url().nullable().optional(),
    tcgplayerId: z.string().trim().max(120).nullable().optional(),
    position: positionSchema,
  })
  .refine(
    (d) => {
      if (d.source === "internal") return !!d.internalCardId;
      return !!(d.justTcgId && d.name && d.game && d.set && d.setName && d.rarity);
    },
    { message: "card_source_fields_incomplete" }
  );

const boxItemSchema = z.object({
  kind: z.literal("box"),
  boxId: objectId,
  position: positionSchema,
});

const optionItemSchema = z.object({
  kind: z.literal("option"),
  label: bilingualStrict,
  description: bilingualOptional.optional(),
  image: z.string().trim().url().nullable().optional(),
  position: positionSchema,
});

export const itemInputSchema = z.discriminatedUnion("kind", [
  cardItemSchema,
  boxItemSchema,
  optionItemSchema,
]);

export const createCampaignSchema = z
  .object({
    title: bilingualStrict,
    description: bilingualOptional.optional(),
    question: bilingualStrict,
    topN: z.number().int().min(1).max(10),
    endsAt: z.string().datetime().nullable().optional(),
    items: z.array(itemInputSchema).min(1).max(100),
  })
  .refine((data) => data.topN <= data.items.length, {
    message: "topN cannot exceed number of items",
    path: ["topN"],
  });

export const patchCampaignSchema = z.object({
  title: bilingualStrict.optional(),
  description: bilingualOptional.optional(),
  question: bilingualStrict.optional(),
  topN: z.number().int().min(1).max(10).optional(),
  endsAt: z.string().datetime().nullable().optional(),
  items: z.array(itemInputSchema).min(1).max(100).optional(),
});

export const patchActiveCampaignSchema = z.object({
  description: bilingualOptional.optional(),
  question: bilingualStrict.optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export type CreateCampaignPayload = z.infer<typeof createCampaignSchema>;
export type PatchCampaignPayload = z.infer<typeof patchCampaignSchema>;
export type PatchActiveCampaignPayload = z.infer<typeof patchActiveCampaignSchema>;
export type ItemInput = z.infer<typeof itemInputSchema>;
