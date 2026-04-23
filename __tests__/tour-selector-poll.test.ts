import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { waitForElement } from "@/lib/tour/selector-poll";

interface FakeElement {
  tagName: string;
}

interface FakeDocument {
  querySelector: (selector: string) => FakeElement | null;
}

let byId: Map<string, FakeElement>;
let originalDocument: unknown;

beforeEach(() => {
  byId = new Map();
  originalDocument = (globalThis as { document?: unknown }).document;
  const fakeDoc: FakeDocument = {
    querySelector(selector) {
      const match = selector.match(/^\[data-tour="(.+)"\]$/);
      if (!match) return null;
      return byId.get(match[1]) ?? null;
    },
  };
  Object.defineProperty(globalThis, "document", {
    value: fakeDoc,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  if (originalDocument === undefined) {
    delete (globalThis as { document?: unknown }).document;
  } else {
    Object.defineProperty(globalThis, "document", {
      value: originalDocument,
      configurable: true,
      writable: true,
    });
  }
});

describe("waitForElement", () => {
  it("resolves synchronously when the target is already present", async () => {
    byId.set("ready", { tagName: "DIV" });
    const result = await waitForElement('[data-tour="ready"]');
    expect(result).toBeTruthy();
  });

  it("resolves when the element appears within the timeout", async () => {
    setTimeout(() => byId.set("late", { tagName: "DIV" }), 120);
    const result = await waitForElement('[data-tour="late"]', {
      timeoutMs: 1000,
      intervalMs: 40,
    });
    expect(result).toBeTruthy();
  });

  it("returns null when the deadline elapses", async () => {
    const result = await waitForElement('[data-tour="never"]', {
      timeoutMs: 60,
      intervalMs: 20,
    });
    expect(result).toBeNull();
  });

  it("aborts early when the signal fires", async () => {
    const controller = new AbortController();
    const promise = waitForElement('[data-tour="pending"]', {
      timeoutMs: 2000,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 40);
    const result = await promise;
    expect(result).toBeNull();
  });
});
