import { describe, it, expect } from "vitest";
import { canTransition, isVotingOpen, shouldAutoClose } from "@/lib/votes/lifecycle";

describe("canTransition", () => {
  it("allows draft -> active", () => {
    expect(canTransition("draft", "active")).toBe(true);
  });

  it("allows active -> closed", () => {
    expect(canTransition("active", "closed")).toBe(true);
  });

  it("forbids closed -> active (no reopen)", () => {
    expect(canTransition("closed", "active")).toBe(false);
  });

  it("forbids draft -> closed (must activate first)", () => {
    expect(canTransition("draft", "closed")).toBe(false);
  });

  it("forbids active -> draft", () => {
    expect(canTransition("active", "draft")).toBe(false);
  });

  it("forbids closed -> draft", () => {
    expect(canTransition("closed", "draft")).toBe(false);
  });
});

describe("shouldAutoClose", () => {
  const now = new Date("2026-04-25T12:00:00Z");

  it("returns true when active and endsAt is in the past", () => {
    expect(
      shouldAutoClose({ status: "active", endsAt: new Date("2026-04-24T12:00:00Z") }, now)
    ).toBe(true);
  });

  it("returns true when active and endsAt is exactly now", () => {
    expect(shouldAutoClose({ status: "active", endsAt: now }, now)).toBe(true);
  });

  it("returns false when active but endsAt is in the future", () => {
    expect(
      shouldAutoClose({ status: "active", endsAt: new Date("2026-05-01T12:00:00Z") }, now)
    ).toBe(false);
  });

  it("returns false when active and endsAt is null (manual close only)", () => {
    expect(shouldAutoClose({ status: "active", endsAt: null }, now)).toBe(false);
  });

  it("returns false for draft regardless of endsAt", () => {
    expect(
      shouldAutoClose({ status: "draft", endsAt: new Date("2020-01-01") }, now)
    ).toBe(false);
  });

  it("returns false for closed regardless of endsAt", () => {
    expect(
      shouldAutoClose({ status: "closed", endsAt: new Date("2020-01-01") }, now)
    ).toBe(false);
  });
});

describe("isVotingOpen", () => {
  const now = new Date("2026-04-25T12:00:00Z");

  it("is open when active and no endsAt", () => {
    expect(isVotingOpen({ status: "active", endsAt: null }, now)).toBe(true);
  });

  it("is open when active and endsAt in the future", () => {
    expect(
      isVotingOpen({ status: "active", endsAt: new Date("2026-12-31") }, now)
    ).toBe(true);
  });

  it("is closed when active but endsAt has passed", () => {
    expect(
      isVotingOpen({ status: "active", endsAt: new Date("2020-01-01") }, now)
    ).toBe(false);
  });

  it("is closed when status is draft", () => {
    expect(isVotingOpen({ status: "draft", endsAt: null }, now)).toBe(false);
  });

  it("is closed when status is closed", () => {
    expect(isVotingOpen({ status: "closed", endsAt: null }, now)).toBe(false);
  });
});
