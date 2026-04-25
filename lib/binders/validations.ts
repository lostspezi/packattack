import { z } from "zod";
import { Types } from "mongoose";
import { BINDER_THEMES, BINDER_TYPES } from "@/models/binder";

const objectIdString = z
  .string()
  .refine((v) => Types.ObjectId.isValid(v), { message: "invalid object id" });

export const createBinderSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).optional().default(""),
    type: z.enum(BINDER_TYPES),
    setTemplate: z
      .object({
        game: z.string().trim().min(1).max(60),
        set: z.string().trim().min(1).max(60),
      })
      .optional()
      .nullable(),
    theme: z.enum(BINDER_THEMES).optional().default("classic"),
  })
  .superRefine((data, ctx) => {
    if (data.type === "set-template" && !data.setTemplate) {
      ctx.addIssue({
        code: "custom",
        path: ["setTemplate"],
        message: "set-template requires game + set",
      });
    }
  });

export type CreateBinderInput = z.infer<typeof createBinderSchema>;

export const updateBinderSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(500).optional(),
    theme: z.enum(BINDER_THEMES).optional(),
    coverPackPullId: objectIdString.nullable().optional(),
    isPublic: z.boolean().optional(),
  })
  .strict();

export type UpdateBinderInput = z.infer<typeof updateBinderSchema>;

const slotCoordSchema = z.object({
  pageIndex: z.number().int().min(0),
  slotPosition: z.number().int().min(0).max(8),
});

export const slotOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("place"),
    packPullId: objectIdString,
    pageIndex: z.number().int().min(0),
    slotPosition: z.number().int().min(0).max(8),
    expectedCurrent: objectIdString.nullable().optional(),
  }),
  z.object({
    op: z.literal("remove"),
    pageIndex: z.number().int().min(0),
    slotPosition: z.number().int().min(0).max(8),
    expectedCurrent: objectIdString.optional(),
  }),
  z.object({
    op: z.literal("swap"),
    from: slotCoordSchema,
    to: slotCoordSchema,
  }),
  z.object({
    op: z.literal("move"),
    packPullId: objectIdString,
    pageIndex: z.number().int().min(0),
    slotPosition: z.number().int().min(0).max(8),
    expectedCurrent: objectIdString.nullable().optional(),
  }),
]);

export type SlotOpInput = z.infer<typeof slotOpSchema>;

export const updatePageSchema = z
  .object({
    title: z.string().trim().max(60).nullable().optional(),
    backgroundId: z.string().trim().max(60).nullable().optional(),
  })
  .strict();

export type UpdatePageInput = z.infer<typeof updatePageSchema>;

export const updateSlotNoteSchema = z
  .object({
    note: z.string().trim().max(200).nullable(),
  })
  .strict();

export type UpdateSlotNoteInput = z.infer<typeof updateSlotNoteSchema>;
