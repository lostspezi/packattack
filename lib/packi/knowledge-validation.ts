import { z } from "zod";

export const PackiKnowledgeInputSchema = z.object({
  topic: z.string().trim().min(1).max(120),
  correction: z.string().trim().min(1).max(2000),
  priority: z.number().int().min(0).max(100).default(50),
  active: z.boolean().default(true),
  language: z
    .string()
    .trim()
    .min(2)
    .max(5)
    .nullable()
    .optional()
    .transform((v) => (v == null ? null : v)),
});

export type PackiKnowledgeInput = z.infer<typeof PackiKnowledgeInputSchema>;

export const PackiKnowledgePatchSchema = PackiKnowledgeInputSchema.partial();
export type PackiKnowledgePatch = z.infer<typeof PackiKnowledgePatchSchema>;
