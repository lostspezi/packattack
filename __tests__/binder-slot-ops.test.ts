import { describe, it, expect } from "vitest";
import {
  SLOTS_PER_PAGE,
  SlotOpError,
  collectPackPullIds,
  findSlotOf,
  makeEmptyPage,
  makeTemplatePage,
  makeTemplatePages,
  placeCard,
  removeCard,
  swapSlots,
  type PlainPage,
} from "@/lib/binders/slot-ops";

function fillPages(pageCount: number): PlainPage[] {
  return Array.from({ length: pageCount }, () => makeEmptyPage());
}

describe("makeEmptyPage", () => {
  it("creates 9 empty slots with positions 0..8", () => {
    const page = makeEmptyPage();
    expect(page.slots).toHaveLength(SLOTS_PER_PAGE);
    page.slots.forEach((slot, idx) => {
      expect(slot.position).toBe(idx);
      expect(slot.packPullId).toBeNull();
      expect(slot.expectedCardId).toBeNull();
      expect(slot.note).toBeNull();
    });
    expect(page.title).toBeNull();
    expect(page.backgroundId).toBeNull();
  });
});

describe("makeTemplatePages", () => {
  it("groups expected cards into pages of 9", () => {
    const cards = Array.from({ length: 20 }, (_, i) => `card-${i}`);
    const pages = makeTemplatePages(cards);
    expect(pages).toHaveLength(3);
    expect(pages[0].slots[0].expectedCardId).toBe("card-0");
    expect(pages[2].slots[1].expectedCardId).toBe("card-19");
    expect(pages[2].slots[2].expectedCardId).toBeNull();
  });

  it("returns one empty page when no cards", () => {
    const pages = makeTemplatePages([]);
    expect(pages).toHaveLength(1);
    expect(pages[0].slots.every((s) => s.expectedCardId === null)).toBe(true);
  });

  it("rejects more than 9 cards in a single template page", () => {
    expect(() =>
      makeTemplatePage(Array.from({ length: 10 }, (_, i) => `c${i}`)),
    ).toThrow();
  });
});

describe("placeCard", () => {
  it("places into an empty slot, no displacement", () => {
    const before = fillPages(1);
    const result = placeCard({
      pages: before,
      coord: { pageIndex: 0, slotPosition: 4 },
      packPullId: "pp-A",
    });
    expect(result.displacedPackPullId).toBeNull();
    expect(result.pages[0].slots[4].packPullId).toBe("pp-A");
    expect(before[0].slots[4].packPullId).toBeNull();
  });

  it("swaps with the displaced card when slot is occupied", () => {
    let pages = fillPages(1);
    pages = placeCard({
      pages,
      coord: { pageIndex: 0, slotPosition: 0 },
      packPullId: "pp-A",
    }).pages;
    const result = placeCard({
      pages,
      coord: { pageIndex: 0, slotPosition: 0 },
      packPullId: "pp-B",
    });
    expect(result.displacedPackPullId).toBe("pp-A");
    expect(result.pages[0].slots[0].packPullId).toBe("pp-B");
  });

  it("rejects placing a card that already lives in another slot", () => {
    let pages = fillPages(1);
    pages = placeCard({
      pages,
      coord: { pageIndex: 0, slotPosition: 0 },
      packPullId: "pp-A",
    }).pages;
    expect(() =>
      placeCard({
        pages,
        coord: { pageIndex: 0, slotPosition: 1 },
        packPullId: "pp-A",
      }),
    ).toThrow(SlotOpError);
  });

  it("placing onto its own slot is a no-op (idempotent)", () => {
    let pages = fillPages(1);
    pages = placeCard({
      pages,
      coord: { pageIndex: 0, slotPosition: 3 },
      packPullId: "pp-A",
    }).pages;
    const again = placeCard({
      pages,
      coord: { pageIndex: 0, slotPosition: 3 },
      packPullId: "pp-A",
    });
    expect(again.displacedPackPullId).toBeNull();
    expect(again.pages[0].slots[3].packPullId).toBe("pp-A");
  });

  it("respects expectedCurrent and rejects on mismatch", () => {
    let pages = fillPages(1);
    pages = placeCard({
      pages,
      coord: { pageIndex: 0, slotPosition: 2 },
      packPullId: "pp-A",
    }).pages;
    expect(() =>
      placeCard({
        pages,
        coord: { pageIndex: 0, slotPosition: 2 },
        packPullId: "pp-B",
        expectedCurrent: null,
      }),
    ).toThrow(/EXPECTED_PRESENT_MISMATCH|expected/);
  });

  it("throws on out-of-range page", () => {
    const pages = fillPages(1);
    expect(() =>
      placeCard({
        pages,
        coord: { pageIndex: 5, slotPosition: 0 },
        packPullId: "pp-A",
      }),
    ).toThrow(SlotOpError);
  });

  it("throws on out-of-range slot position", () => {
    const pages = fillPages(1);
    expect(() =>
      placeCard({
        pages,
        coord: { pageIndex: 0, slotPosition: 99 },
        packPullId: "pp-A",
      }),
    ).toThrow(SlotOpError);
  });
});

describe("removeCard", () => {
  it("clears the slot and returns the removed id", () => {
    let pages = fillPages(1);
    pages = placeCard({
      pages,
      coord: { pageIndex: 0, slotPosition: 7 },
      packPullId: "pp-X",
    }).pages;
    const result = removeCard({
      pages,
      coord: { pageIndex: 0, slotPosition: 7 },
    });
    expect(result.removedPackPullId).toBe("pp-X");
    expect(result.pages[0].slots[7].packPullId).toBeNull();
    expect(result.pages[0].slots[7].note).toBeNull();
  });

  it("throws SLOT_EMPTY when slot has no card", () => {
    const pages = fillPages(1);
    expect(() =>
      removeCard({ pages, coord: { pageIndex: 0, slotPosition: 0 } }),
    ).toThrow(SlotOpError);
  });

  it("throws EXPECTED_PRESENT_MISMATCH when expectedCurrent does not match", () => {
    let pages = fillPages(1);
    pages = placeCard({
      pages,
      coord: { pageIndex: 0, slotPosition: 4 },
      packPullId: "pp-A",
    }).pages;
    expect(() =>
      removeCard({
        pages,
        coord: { pageIndex: 0, slotPosition: 4 },
        expectedCurrent: "pp-OTHER",
      }),
    ).toThrow(/EXPECTED_PRESENT_MISMATCH|expected/);
  });
});

describe("swapSlots", () => {
  it("swaps two non-empty slots", () => {
    let pages = fillPages(1);
    pages = placeCard({
      pages,
      coord: { pageIndex: 0, slotPosition: 0 },
      packPullId: "pp-A",
    }).pages;
    pages = placeCard({
      pages,
      coord: { pageIndex: 0, slotPosition: 8 },
      packPullId: "pp-B",
    }).pages;
    const next = swapSlots({
      pages,
      from: { pageIndex: 0, slotPosition: 0 },
      to: { pageIndex: 0, slotPosition: 8 },
    });
    expect(next[0].slots[0].packPullId).toBe("pp-B");
    expect(next[0].slots[8].packPullId).toBe("pp-A");
  });

  it("moves a card into an empty slot when the target is empty", () => {
    let pages = fillPages(1);
    pages = placeCard({
      pages,
      coord: { pageIndex: 0, slotPosition: 1 },
      packPullId: "pp-A",
    }).pages;
    const next = swapSlots({
      pages,
      from: { pageIndex: 0, slotPosition: 1 },
      to: { pageIndex: 0, slotPosition: 5 },
    });
    expect(next[0].slots[1].packPullId).toBeNull();
    expect(next[0].slots[5].packPullId).toBe("pp-A");
  });

  it("swaps notes along with cards", () => {
    let pages = fillPages(1);
    pages = placeCard({
      pages,
      coord: { pageIndex: 0, slotPosition: 0 },
      packPullId: "pp-A",
    }).pages;
    pages[0].slots[0].note = "first";
    pages = placeCard({
      pages,
      coord: { pageIndex: 0, slotPosition: 1 },
      packPullId: "pp-B",
    }).pages;
    pages[0].slots[1].note = "second";
    const next = swapSlots({
      pages,
      from: { pageIndex: 0, slotPosition: 0 },
      to: { pageIndex: 0, slotPosition: 1 },
    });
    expect(next[0].slots[0].note).toBe("second");
    expect(next[0].slots[1].note).toBe("first");
  });
});

describe("collectPackPullIds / findSlotOf", () => {
  it("collects all non-null packPullIds across pages", () => {
    let pages = fillPages(2);
    pages = placeCard({
      pages,
      coord: { pageIndex: 0, slotPosition: 0 },
      packPullId: "a",
    }).pages;
    pages = placeCard({
      pages,
      coord: { pageIndex: 1, slotPosition: 4 },
      packPullId: "b",
    }).pages;
    expect(Array.from(collectPackPullIds(pages)).sort()).toEqual(["a", "b"]);
  });

  it("findSlotOf returns coord or null", () => {
    let pages = fillPages(2);
    pages = placeCard({
      pages,
      coord: { pageIndex: 1, slotPosition: 6 },
      packPullId: "needle",
    }).pages;
    expect(findSlotOf(pages, "needle")).toEqual({
      pageIndex: 1,
      slotPosition: 6,
    });
    expect(findSlotOf(pages, "nope")).toBeNull();
  });
});
