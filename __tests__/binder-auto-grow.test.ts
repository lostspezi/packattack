import { describe, it, expect } from "vitest";
import { autoGrowIfNeeded, isPageFull, MAX_PAGES } from "@/lib/binders/auto-grow";
import { makeEmptyPage, placeCard, type PlainPage } from "@/lib/binders/slot-ops";

function fillFully(page: PlainPage, prefix = "pp"): PlainPage {
  const fullPage: PlainPage = {
    ...page,
    slots: page.slots.map((s) => ({ ...s, packPullId: `${prefix}-${s.position}` })),
  };
  return fullPage;
}

describe("isPageFull", () => {
  it("false on a fresh page", () => {
    expect(isPageFull(makeEmptyPage())).toBe(false);
  });

  it("true when every slot is occupied", () => {
    expect(isPageFull(fillFully(makeEmptyPage()))).toBe(true);
  });

  it("false with eight occupied slots", () => {
    let page = makeEmptyPage();
    for (let i = 0; i < 8; i += 1) {
      page = placeCard({
        pages: [page],
        coord: { pageIndex: 0, slotPosition: i },
        packPullId: `pp-${i}`,
      }).pages[0];
    }
    expect(isPageFull(page)).toBe(false);
  });
});

describe("autoGrowIfNeeded", () => {
  it("returns one empty page when given empty pages array", () => {
    const result = autoGrowIfNeeded([]);
    expect(result).toHaveLength(1);
    expect(isPageFull(result[0])).toBe(false);
  });

  it("does not append when last page has free space", () => {
    const pages = [makeEmptyPage()];
    const result = autoGrowIfNeeded(pages);
    expect(result).toHaveLength(1);
  });

  it("appends a page when last page is full", () => {
    const pages = [fillFully(makeEmptyPage())];
    const result = autoGrowIfNeeded(pages);
    expect(result).toHaveLength(2);
    expect(isPageFull(result[1])).toBe(false);
  });

  it("respects MAX_PAGES cap", () => {
    const pages = Array.from({ length: MAX_PAGES }, (_, i) =>
      fillFully(makeEmptyPage(), `p${i}`),
    );
    const result = autoGrowIfNeeded(pages);
    expect(result).toHaveLength(MAX_PAGES);
  });
});
