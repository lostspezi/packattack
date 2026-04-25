import { describe, it, expect } from "vitest";
import { computeCompletion } from "@/lib/binders/completion";
import {
  makeEmptyPage,
  makeTemplatePages,
  type PlainPage,
} from "@/lib/binders/slot-ops";

function withCard(
  page: PlainPage,
  slotIndex: number,
  packPullId: string,
): PlainPage {
  const next = {
    ...page,
    slots: page.slots.map((s, i) =>
      i === slotIndex ? { ...s, packPullId } : { ...s },
    ),
  };
  return next;
}

describe("computeCompletion", () => {
  it("returns zero ratio for a free binder with no expected cards", () => {
    let page = makeEmptyPage();
    page = withCard(page, 0, "pp-A");
    const stats = computeCompletion([page], () => "card-1");
    expect(stats.expected).toBe(0);
    expect(stats.matched).toBe(0);
    expect(stats.filledTotal).toBe(1);
    expect(stats.ratio).toBe(0);
  });

  it("counts matches when packPull resolves to expected card", () => {
    const pages = makeTemplatePages(["card-A", "card-B", "card-C"]);
    pages[0].slots[0].packPullId = "pp-1";
    pages[0].slots[2].packPullId = "pp-3";
    const stats = computeCompletion(pages, (id) =>
      id === "pp-1" ? "card-A" : id === "pp-3" ? "card-C" : null,
    );
    expect(stats.expected).toBe(3);
    expect(stats.matched).toBe(2);
    expect(stats.filledTotal).toBe(2);
    expect(stats.ratio).toBeCloseTo(2 / 3);
  });

  it("does not count a slot where packPull resolves to a different card", () => {
    const pages = makeTemplatePages(["card-A"]);
    pages[0].slots[0].packPullId = "pp-X";
    const stats = computeCompletion(pages, () => "card-DIFFERENT");
    expect(stats.matched).toBe(0);
    expect(stats.expected).toBe(1);
    expect(stats.filledTotal).toBe(1);
  });
});
