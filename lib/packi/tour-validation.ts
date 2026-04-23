import { z } from "zod";

export const TourPatchSchema = z
  .object({
    completed: z.boolean().optional(),
    skippedAt: z
      .union([z.string().datetime(), z.null()])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === null ? null : new Date(v))),
    completedSteps: z.array(z.string().min(1).max(64)).max(50).optional(),
    addCompletedStep: z.string().min(1).max(64).optional(),
    lastPromptAt: z
      .union([z.string().datetime(), z.null()])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === null ? null : new Date(v))),
    sessionCountSincePrompt: z.number().int().min(0).max(10000).optional(),
    incrementSessionCount: z.boolean().optional(),
  })
  .refine(
    (data) => Object.keys(data).some((k) => data[k as keyof typeof data] !== undefined),
    { message: "at least one field required" },
  );

export type TourPatch = z.infer<typeof TourPatchSchema>;

export interface TourState {
  completed: boolean;
  skippedAt: string | null;
  completedSteps: string[];
  lastPromptAt: string | null;
  sessionCountSincePrompt: number;
}

export const TOUR_DEFAULTS: TourState = {
  completed: false,
  skippedAt: null,
  completedSteps: [],
  lastPromptAt: null,
  sessionCountSincePrompt: 0,
};
