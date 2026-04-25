import { describe, it, expect } from "vitest";
import {
  aggregateVotes,
  countUniqueVoters,
  rankAggregatedVotes,
} from "@/lib/votes/aggregate";

describe("aggregateVotes", () => {
  it("counts votes per item and includes zero-vote items", () => {
    const result = aggregateVotes(
      [
        { itemRefId: "a", userId: "u1" },
        { itemRefId: "a", userId: "u2" },
        { itemRefId: "b", userId: "u1" },
      ],
      ["a", "b", "c"]
    );

    const map = Object.fromEntries(result.map((r) => [r.itemRefId, r.voteCount]));
    expect(map).toEqual({ a: 2, b: 1, c: 0 });
  });

  it("ignores votes for items not in the campaign", () => {
    const result = aggregateVotes(
      [
        { itemRefId: "phantom", userId: "u1" },
        { itemRefId: "a", userId: "u1" },
      ],
      ["a"]
    );
    expect(result).toEqual([{ itemRefId: "a", voteCount: 1 }]);
  });

  it("returns empty list for empty item pool", () => {
    expect(aggregateVotes([{ itemRefId: "x", userId: "u1" }], [])).toEqual([]);
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
        { itemRefId: "a", voteCount: 3 },
        { itemRefId: "b", voteCount: 7 },
        { itemRefId: "c", voteCount: 1 },
      ],
      positions
    );
    expect(ranked.map((r) => r.itemRefId)).toEqual(["b", "a", "c"]);
  });

  it("breaks ties by position (lower position first)", () => {
    const positions = new Map([
      ["a", 5],
      ["b", 1],
      ["c", 3],
    ]);
    const ranked = rankAggregatedVotes(
      [
        { itemRefId: "a", voteCount: 5 },
        { itemRefId: "b", voteCount: 5 },
        { itemRefId: "c", voteCount: 5 },
      ],
      positions
    );
    expect(ranked.map((r) => r.itemRefId)).toEqual(["b", "c", "a"]);
  });

  it("breaks position ties by itemRefId lexicographically", () => {
    const positions = new Map([
      ["zzz", 0],
      ["aaa", 0],
    ]);
    const ranked = rankAggregatedVotes(
      [
        { itemRefId: "zzz", voteCount: 1 },
        { itemRefId: "aaa", voteCount: 1 },
      ],
      positions
    );
    expect(ranked.map((r) => r.itemRefId)).toEqual(["aaa", "zzz"]);
  });
});

describe("countUniqueVoters", () => {
  it("counts each user once even with multiple votes", () => {
    const count = countUniqueVoters([
      { itemRefId: "a", userId: "u1" },
      { itemRefId: "b", userId: "u1" },
      { itemRefId: "c", userId: "u1" },
      { itemRefId: "a", userId: "u2" },
    ]);
    expect(count).toBe(2);
  });

  it("returns 0 for empty input", () => {
    expect(countUniqueVoters([])).toBe(0);
  });
});
