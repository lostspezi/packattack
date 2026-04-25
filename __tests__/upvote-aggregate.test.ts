import { describe, it, expect } from "vitest";
import {
  aggregateVotes,
  countUniqueVoters,
  rankAggregatedVotes,
} from "@/lib/votes/aggregate";

describe("aggregateVotes", () => {
  it("counts votes per card and includes zero-vote cards", () => {
    const result = aggregateVotes(
      [
        { cardRefId: "a", userId: "u1" },
        { cardRefId: "a", userId: "u2" },
        { cardRefId: "b", userId: "u1" },
      ],
      ["a", "b", "c"]
    );

    const map = Object.fromEntries(result.map((r) => [r.cardRefId, r.voteCount]));
    expect(map).toEqual({ a: 2, b: 1, c: 0 });
  });

  it("ignores votes for cards not in the campaign", () => {
    const result = aggregateVotes(
      [
        { cardRefId: "phantom", userId: "u1" },
        { cardRefId: "a", userId: "u1" },
      ],
      ["a"]
    );
    expect(result).toEqual([{ cardRefId: "a", voteCount: 1 }]);
  });

  it("returns empty list for empty card pool", () => {
    expect(aggregateVotes([{ cardRefId: "x", userId: "u1" }], [])).toEqual([]);
  });
});

describe("rankAggregatedVotes", () => {
  it("sorts by vote count descending", () => {
    const positions = new Map([
      ["a", 0],
      ["b", 1],
      ["c", 2],
    ]);
    const ranked = rankAggregatedVotes(
      [
        { cardRefId: "a", voteCount: 3 },
        { cardRefId: "b", voteCount: 7 },
        { cardRefId: "c", voteCount: 1 },
      ],
      positions
    );
    expect(ranked.map((r) => r.cardRefId)).toEqual(["b", "a", "c"]);
  });

  it("breaks ties by position (lower position first)", () => {
    const positions = new Map([
      ["a", 5],
      ["b", 1],
      ["c", 3],
    ]);
    const ranked = rankAggregatedVotes(
      [
        { cardRefId: "a", voteCount: 5 },
        { cardRefId: "b", voteCount: 5 },
        { cardRefId: "c", voteCount: 5 },
      ],
      positions
    );
    expect(ranked.map((r) => r.cardRefId)).toEqual(["b", "c", "a"]);
  });

  it("breaks position ties by cardRefId lexicographically", () => {
    const positions = new Map([
      ["zzz", 0],
      ["aaa", 0],
    ]);
    const ranked = rankAggregatedVotes(
      [
        { cardRefId: "zzz", voteCount: 1 },
        { cardRefId: "aaa", voteCount: 1 },
      ],
      positions
    );
    expect(ranked.map((r) => r.cardRefId)).toEqual(["aaa", "zzz"]);
  });
});

describe("countUniqueVoters", () => {
  it("counts each user once even with multiple votes", () => {
    const count = countUniqueVoters([
      { cardRefId: "a", userId: "u1" },
      { cardRefId: "b", userId: "u1" },
      { cardRefId: "c", userId: "u1" },
      { cardRefId: "a", userId: "u2" },
    ]);
    expect(count).toBe(2);
  });

  it("returns 0 for empty input", () => {
    expect(countUniqueVoters([])).toBe(0);
  });
});
