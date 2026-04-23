import { describe, it, expect } from "vitest";
import {
  buildContextBlock,
  buildSystemBlocks,
  PACKI_PERSONA,
  type PackiContext,
} from "@/lib/packi/system-prompt";

const baseCtx: PackiContext = {
  username: "Alice",
  lang: "de",
  route: "/de/dashboard",
  onboardingCompleted: true,
  tourCompleted: false,
};

describe("buildContextBlock", () => {
  it("produces deterministic output for identical context", () => {
    expect(buildContextBlock(baseCtx)).toBe(buildContextBlock(baseCtx));
  });

  it("includes all relevant context fields", () => {
    const block = buildContextBlock(baseCtx);
    expect(block).toContain("User: Alice");
    expect(block).toContain("Sprache: de");
    expect(block).toContain("Aktuelle Route: /de/dashboard");
    expect(block).toContain("Onboarding abgeschlossen: true");
    expect(block).toContain("Tour abgeschlossen: false");
  });

  it("changes when any field changes (cache-busting correctness)", () => {
    const a = buildContextBlock(baseCtx);
    const b = buildContextBlock({ ...baseCtx, username: "Bob" });
    const c = buildContextBlock({ ...baseCtx, lang: "en" });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("buildSystemBlocks", () => {
  it("returns exactly two text blocks: persona (cached) and context (uncached)", () => {
    const blocks = buildSystemBlocks(baseCtx);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("text");
    expect(blocks[0].text).toBe(PACKI_PERSONA);
    expect(blocks[0].cache_control).toEqual({ type: "ephemeral" });
    expect(blocks[1].type).toBe("text");
    expect(blocks[1].cache_control).toBeUndefined();
  });

  it("persona is long enough to hit Sonnet cache minimum (~2048 tokens ≈ 7000+ chars)", () => {
    // Rough sanity check — actual token count verified via countTokens at runtime.
    // Characters are a conservative lower bound given the German+English mix.
    expect(PACKI_PERSONA.length).toBeGreaterThan(7000);
  });

  it("persona contains mandatory guardrail anchors", () => {
    expect(PACKI_PERSONA).toContain("Keine Admin-Aktionen");
    expect(PACKI_PERSONA).toContain("Keine Zahlen/Versprechen");
    expect(PACKI_PERSONA).toContain("Kein Off-Topic");
    expect(PACKI_PERSONA).toContain("Keine User-Daten");
  });
});
