import { describe, it, expect } from "vitest";
import {
  ARENA_COLORS,
  ARENA_ZONES,
  ARENA_SIZES,
  PLAYER_POSITIONS,
  PLAYER_COLORS,
  ARENA_ASPECT_RATIO,
} from "@/lib/arena-constants";

describe("arena-constants", () => {
  it("has all player color entries", () => {
    expect(PLAYER_COLORS).toHaveLength(4);
  });

  it("has player positions for 2, 3, and 4 players", () => {
    expect(PLAYER_POSITIONS[2]).toHaveLength(2);
    expect(PLAYER_POSITIONS[3]).toHaveLength(3);
    expect(PLAYER_POSITIONS[4]).toHaveLength(4);
  });

  it("all player positions are between 0 and 1", () => {
    for (const positions of Object.values(PLAYER_POSITIONS)) {
      for (const pos of positions) {
        expect(pos).toBeGreaterThanOrEqual(0);
        expect(pos).toBeLessThanOrEqual(1);
      }
    }
  });

  it("zones are ordered top to bottom", () => {
    expect(ARENA_ZONES.skyTop).toBeLessThan(ARENA_ZONES.railingY);
    expect(ARENA_ZONES.railingY).toBeLessThan(ARENA_ZONES.floorTop);
    expect(ARENA_ZONES.floorTop).toBeLessThan(ARENA_ZONES.handTop);
  });

  it("aspect ratio is 16:9", () => {
    expect(ARENA_ASPECT_RATIO).toBeCloseTo(16 / 9);
  });

  it("colors are valid hex numbers", () => {
    for (const color of Object.values(ARENA_COLORS)) {
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThanOrEqual(0xffffff);
    }
  });
});
