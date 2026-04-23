import { describe, it, expect, beforeEach } from "vitest";
import {
  mergeCompletedSteps,
  readLocalProgress,
  writeLocalProgress,
  clearLocalProgress,
} from "@/lib/tour/progress";

// JSDOM-free localStorage polyfill for the node test environment.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, String(v));
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
  key(i: number) {
    return [...this.store.keys()][i] ?? null;
  }
  get length() {
    return this.store.size;
  }
}

beforeEach(() => {
  const memory = new MemoryStorage();
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: memory },
    configurable: true,
    writable: true,
  });
});

describe("mergeCompletedSteps", () => {
  it("unions both lists, preserving insertion order of first-seen", () => {
    expect(mergeCompletedSteps(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for two empty inputs", () => {
    expect(mergeCompletedSteps([], [])).toEqual([]);
  });

  it("drops duplicates within a single list", () => {
    expect(mergeCompletedSteps(["a", "a", "b"], ["c"])).toEqual(["a", "b", "c"]);
  });
});

describe("local tour progress", () => {
  it("returns null when nothing is stored", () => {
    expect(readLocalProgress()).toBeNull();
  });

  it("round-trips a progress blob", () => {
    writeLocalProgress({
      completedSteps: ["dashboard-welcome"],
      lastStep: "dashboard-welcome",
      updatedAt: 1234,
    });
    expect(readLocalProgress()).toEqual({
      completedSteps: ["dashboard-welcome"],
      lastStep: "dashboard-welcome",
      updatedAt: 1234,
    });
  });

  it("ignores malformed stored blobs", () => {
    window.localStorage.setItem("packi.tour.progress", "{nope");
    expect(readLocalProgress()).toBeNull();
  });

  it("clearLocalProgress removes the key", () => {
    writeLocalProgress({
      completedSteps: ["x"],
      lastStep: "x",
      updatedAt: 0,
    });
    clearLocalProgress();
    expect(readLocalProgress()).toBeNull();
  });
});
