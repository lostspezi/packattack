import { describe, it, expect } from "vitest";
import {
  TourPatchSchema,
  TOUR_DEFAULTS,
} from "@/lib/packi/tour-validation";

describe("TourPatchSchema", () => {
  it("accepts a minimal patch with just completed=true", () => {
    const result = TourPatchSchema.safeParse({ completed: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.completed).toBe(true);
    }
  });

  it("rejects an empty patch", () => {
    const result = TourPatchSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("parses ISO date strings to Date objects", () => {
    const result = TourPatchSchema.safeParse({
      skippedAt: "2026-04-23T12:00:00Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skippedAt).toBeInstanceOf(Date);
    }
  });

  it("preserves explicit null for nullable date fields", () => {
    const result = TourPatchSchema.safeParse({
      skippedAt: null,
      lastPromptAt: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skippedAt).toBeNull();
      expect(result.data.lastPromptAt).toBeNull();
    }
  });

  it("rejects non-ISO date strings", () => {
    expect(
      TourPatchSchema.safeParse({ skippedAt: "yesterday" }).success,
    ).toBe(false);
    expect(
      TourPatchSchema.safeParse({ skippedAt: "2026-04-23" }).success,
    ).toBe(false);
  });

  it("accepts completedSteps array with step IDs", () => {
    const result = TourPatchSchema.safeParse({
      completedSteps: ["dashboard-welcome", "packs-browse"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects oversized completedSteps arrays", () => {
    const result = TourPatchSchema.safeParse({
      completedSteps: Array.from({ length: 51 }, (_, i) => `s${i}`),
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty or oversized step IDs", () => {
    expect(
      TourPatchSchema.safeParse({ completedSteps: [""] }).success,
    ).toBe(false);
    expect(
      TourPatchSchema.safeParse({
        completedSteps: ["x".repeat(65)],
      }).success,
    ).toBe(false);
  });

  it("accepts addCompletedStep as atomic append trigger", () => {
    const result = TourPatchSchema.safeParse({
      addCompletedStep: "pack-open",
    });
    expect(result.success).toBe(true);
  });

  it("accepts incrementSessionCount flag", () => {
    const result = TourPatchSchema.safeParse({ incrementSessionCount: true });
    expect(result.success).toBe(true);
  });

  it("rejects negative session counts", () => {
    expect(
      TourPatchSchema.safeParse({ sessionCountSincePrompt: -1 }).success,
    ).toBe(false);
  });
});

describe("TOUR_DEFAULTS", () => {
  it("matches the schema defaults for a brand-new user", () => {
    expect(TOUR_DEFAULTS).toEqual({
      completed: false,
      skippedAt: null,
      completedSteps: [],
      lastPromptAt: null,
      sessionCountSincePrompt: 0,
    });
  });
});
