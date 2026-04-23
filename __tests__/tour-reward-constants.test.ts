import { describe, it, expect } from "vitest";
import { SIGNUP_BONUS_COINS, TOUR_REWARD_COINS } from "@/lib/constants";

describe("tour economy constants", () => {
  it("signup bonus matches tour reward so net delta after completion is zero", () => {
    // A new user can buy the tutorial box with their starter coins (which
    // equals the box price), and the reward at the end replenishes the
    // same amount — leaving the user with a non-trivial, but not generous,
    // balance that nudges them toward the balance-topup page.
    expect(SIGNUP_BONUS_COINS).toBe(10);
    expect(TOUR_REWARD_COINS).toBe(10);
  });

  it("both constants are positive integers", () => {
    expect(Number.isInteger(SIGNUP_BONUS_COINS)).toBe(true);
    expect(SIGNUP_BONUS_COINS).toBeGreaterThan(0);
    expect(Number.isInteger(TOUR_REWARD_COINS)).toBe(true);
    expect(TOUR_REWARD_COINS).toBeGreaterThan(0);
  });
});
