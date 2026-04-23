import { describe, it, expect } from "vitest";
import { buildCorrectionsBlock } from "@/lib/packi/corrections";
import { PackiKnowledgeInputSchema } from "@/lib/packi/knowledge-validation";
import { buildSystemBlocks } from "@/lib/packi/system-prompt";

describe("buildCorrectionsBlock", () => {
  it("returns null for empty list so no system block is appended", () => {
    expect(buildCorrectionsBlock([])).toBeNull();
  });

  it("formats entries with topic labels and authoritative header", () => {
    const block = buildCorrectionsBlock([
      { topic: "Coins", correction: "User kriegen 50 Coins beim Signup, nicht 100.", priority: 90 },
      { topic: "Events", correction: "Das Halloween-Event ist bis 31.10. aktiv.", priority: 80 },
    ]);
    expect(block).toContain("ADMIN-KORREKTUREN");
    expect(block).toContain("verbindlich");
    expect(block).toContain("[Coins] User kriegen 50 Coins");
    expect(block).toContain("[Events] Das Halloween-Event");
  });
});

describe("buildSystemBlocks with corrections", () => {
  const ctx = {
    username: "Alice",
    lang: "de",
    route: "/de/dashboard",
    onboardingCompleted: true,
    tourCompleted: false,
  };

  it("omits corrections block when none are provided", () => {
    const blocks = buildSystemBlocks(ctx);
    expect(blocks).toHaveLength(2);
  });

  it("appends corrections as a third uncached block (cache stays on persona)", () => {
    const blocks = buildSystemBlocks(ctx, "ADMIN-KORREKTUREN:\n- [x] y");
    expect(blocks).toHaveLength(3);
    expect(blocks[0].cache_control).toEqual({ type: "ephemeral" });
    expect(blocks[1].cache_control).toBeUndefined();
    expect(blocks[2].cache_control).toBeUndefined();
    expect(blocks[2].text).toContain("ADMIN-KORREKTUREN");
  });
});

describe("PackiKnowledgeInputSchema", () => {
  it("accepts minimal valid input", () => {
    const result = PackiKnowledgeInputSchema.safeParse({
      topic: "Test",
      correction: "Eine Korrektur.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe(50);
      expect(result.data.active).toBe(true);
      expect(result.data.language).toBeNull();
    }
  });

  it("rejects empty topic or correction", () => {
    expect(
      PackiKnowledgeInputSchema.safeParse({ topic: "", correction: "x" }).success,
    ).toBe(false);
    expect(
      PackiKnowledgeInputSchema.safeParse({ topic: "x", correction: "" }).success,
    ).toBe(false);
  });

  it("rejects overlong fields", () => {
    expect(
      PackiKnowledgeInputSchema.safeParse({
        topic: "x".repeat(121),
        correction: "y",
      }).success,
    ).toBe(false);
    expect(
      PackiKnowledgeInputSchema.safeParse({
        topic: "x",
        correction: "y".repeat(2001),
      }).success,
    ).toBe(false);
  });

  it("clamps priority to 0-100", () => {
    expect(
      PackiKnowledgeInputSchema.safeParse({
        topic: "x",
        correction: "y",
        priority: 150,
      }).success,
    ).toBe(false);
    expect(
      PackiKnowledgeInputSchema.safeParse({
        topic: "x",
        correction: "y",
        priority: -1,
      }).success,
    ).toBe(false);
  });

  it("accepts valid language codes and coerces missing/null to null", () => {
    expect(
      PackiKnowledgeInputSchema.parse({
        topic: "x",
        correction: "y",
        language: "de",
      }).language,
    ).toBe("de");
    expect(
      PackiKnowledgeInputSchema.parse({
        topic: "x",
        correction: "y",
        language: null,
      }).language,
    ).toBeNull();
    expect(
      PackiKnowledgeInputSchema.parse({
        topic: "x",
        correction: "y",
      }).language,
    ).toBeNull();
  });
});
