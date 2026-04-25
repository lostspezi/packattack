import { describe, it, expect } from "vitest";
import { planVoteReplacement } from "@/lib/votes/replace-votes";

const id = (s: string) => ({ toString: () => s });

describe("planVoteReplacement", () => {
  it("inserts all when starting from empty", () => {
    const plan = planVoteReplacement({
      campaignId: id("c1"),
      userId: id("u1"),
      currentCardRefIds: [],
      desiredCardRefIds: [id("a"), id("b"), id("c")],
    });
    expect(plan.toInsert.sort()).toEqual(["a", "b", "c"]);
    expect(plan.toDelete).toEqual([]);
    expect(plan.unchanged).toEqual([]);
  });

  it("deletes all when desired is empty", () => {
    const plan = planVoteReplacement({
      campaignId: id("c1"),
      userId: id("u1"),
      currentCardRefIds: [id("a"), id("b")],
      desiredCardRefIds: [],
    });
    expect(plan.toInsert).toEqual([]);
    expect(plan.toDelete.sort()).toEqual(["a", "b"]);
    expect(plan.unchanged).toEqual([]);
  });

  it("computes set difference for partial overlap", () => {
    const plan = planVoteReplacement({
      campaignId: id("c1"),
      userId: id("u1"),
      currentCardRefIds: [id("a"), id("b"), id("c")],
      desiredCardRefIds: [id("b"), id("c"), id("d")],
    });
    expect(plan.toInsert).toEqual(["d"]);
    expect(plan.toDelete).toEqual(["a"]);
    expect(plan.unchanged.sort()).toEqual(["b", "c"]);
  });

  it("is idempotent when current equals desired", () => {
    const plan = planVoteReplacement({
      campaignId: id("c1"),
      userId: id("u1"),
      currentCardRefIds: [id("x"), id("y")],
      desiredCardRefIds: [id("x"), id("y")],
    });
    expect(plan.toInsert).toEqual([]);
    expect(plan.toDelete).toEqual([]);
    expect(plan.unchanged.sort()).toEqual(["x", "y"]);
  });

  it("handles ObjectId-like inputs via toString", () => {
    class FakeOid {
      constructor(private v: string) {}
      toString() {
        return this.v;
      }
    }
    const plan = planVoteReplacement({
      campaignId: new FakeOid("camp"),
      userId: new FakeOid("user"),
      currentCardRefIds: [new FakeOid("a")],
      desiredCardRefIds: [new FakeOid("a"), new FakeOid("b")],
    });
    expect(plan.toInsert).toEqual(["b"]);
    expect(plan.unchanged).toEqual(["a"]);
  });
});
