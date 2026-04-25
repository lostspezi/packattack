export const SLOTS_PER_PAGE = 9;

export interface PlainSlot {
  position: number;
  packPullId: string | null;
  expectedCardId: string | null;
  note: string | null;
}

export interface PlainPage {
  title: string | null;
  backgroundId: string | null;
  slots: PlainSlot[];
}

export interface SlotCoord {
  pageIndex: number;
  slotPosition: number;
}

export class SlotOpError extends Error {
  constructor(
    public readonly code:
      | "PAGE_OUT_OF_RANGE"
      | "SLOT_OUT_OF_RANGE"
      | "SLOT_EMPTY"
      | "SLOT_OCCUPIED"
      | "CARD_NOT_FOUND_IN_BINDER"
      | "CARD_ALREADY_IN_BINDER"
      | "EXPECTED_PRESENT_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "SlotOpError";
  }
}

export function makeEmptyPage(): PlainPage {
  const slots: PlainSlot[] = [];
  for (let i = 0; i < SLOTS_PER_PAGE; i += 1) {
    slots.push({
      position: i,
      packPullId: null,
      expectedCardId: null,
      note: null,
    });
  }
  return { title: null, backgroundId: null, slots };
}

export function makeTemplatePage(expectedCardIds: string[]): PlainPage {
  if (expectedCardIds.length > SLOTS_PER_PAGE) {
    throw new Error(`template page exceeds ${SLOTS_PER_PAGE} cards`);
  }
  const page = makeEmptyPage();
  for (let i = 0; i < expectedCardIds.length; i += 1) {
    page.slots[i].expectedCardId = expectedCardIds[i];
  }
  return page;
}

export function makeTemplatePages(expectedCardIds: string[]): PlainPage[] {
  if (expectedCardIds.length === 0) return [makeEmptyPage()];
  const pages: PlainPage[] = [];
  for (let i = 0; i < expectedCardIds.length; i += SLOTS_PER_PAGE) {
    pages.push(makeTemplatePage(expectedCardIds.slice(i, i + SLOTS_PER_PAGE)));
  }
  return pages;
}

function getSlot(pages: PlainPage[], coord: SlotCoord): PlainSlot {
  const page = pages[coord.pageIndex];
  if (!page) {
    throw new SlotOpError(
      "PAGE_OUT_OF_RANGE",
      `page ${coord.pageIndex} does not exist`,
    );
  }
  if (coord.slotPosition < 0 || coord.slotPosition >= SLOTS_PER_PAGE) {
    throw new SlotOpError(
      "SLOT_OUT_OF_RANGE",
      `slot ${coord.slotPosition} is out of range`,
    );
  }
  const slot = page.slots.find((s) => s.position === coord.slotPosition);
  if (!slot) {
    throw new SlotOpError(
      "SLOT_OUT_OF_RANGE",
      `slot ${coord.slotPosition} not initialised on page ${coord.pageIndex}`,
    );
  }
  return slot;
}

function checkExpectedPresent(slot: PlainSlot, expected: string | null): void {
  const current = slot.packPullId;
  if (expected === undefined) return;
  if (current !== expected) {
    throw new SlotOpError(
      "EXPECTED_PRESENT_MISMATCH",
      `slot expected ${expected ?? "empty"} but holds ${current ?? "empty"}`,
    );
  }
}

export interface PlaceArgs {
  pages: PlainPage[];
  coord: SlotCoord;
  packPullId: string;
  /** if set, server checks that the slot currently holds exactly this id (or null) before placing */
  expectedCurrent?: string | null;
}

export interface PlaceResult {
  pages: PlainPage[];
  /** card that was displaced from the slot (returns to inventory), or null if slot was empty */
  displacedPackPullId: string | null;
}

export function placeCard(args: PlaceArgs): PlaceResult {
  const pages = clonePages(args.pages);

  const allPullIds = collectPackPullIds(pages);
  if (allPullIds.has(args.packPullId)) {
    const found = findSlotOf(pages, args.packPullId);
    if (
      !found ||
      found.pageIndex !== args.coord.pageIndex ||
      found.slotPosition !== args.coord.slotPosition
    ) {
      throw new SlotOpError(
        "CARD_ALREADY_IN_BINDER",
        `pack pull ${args.packPullId} already occupies another slot`,
      );
    }
  }

  const slot = getSlot(pages, args.coord);
  if (args.expectedCurrent !== undefined) {
    checkExpectedPresent(slot, args.expectedCurrent);
  }

  const displaced = slot.packPullId;
  slot.packPullId = args.packPullId;
  return { pages, displacedPackPullId: displaced };
}

export interface RemoveArgs {
  pages: PlainPage[];
  coord: SlotCoord;
  expectedCurrent?: string;
}

export interface RemoveResult {
  pages: PlainPage[];
  removedPackPullId: string;
}

export function removeCard(args: RemoveArgs): RemoveResult {
  const pages = clonePages(args.pages);
  const slot = getSlot(pages, args.coord);
  if (!slot.packPullId) {
    throw new SlotOpError("SLOT_EMPTY", "slot has no card to remove");
  }
  if (args.expectedCurrent && slot.packPullId !== args.expectedCurrent) {
    throw new SlotOpError(
      "EXPECTED_PRESENT_MISMATCH",
      `slot holds ${slot.packPullId} but client expected ${args.expectedCurrent}`,
    );
  }
  const removed = slot.packPullId;
  slot.packPullId = null;
  slot.note = null;
  return { pages, removedPackPullId: removed };
}

export interface SwapArgs {
  pages: PlainPage[];
  from: SlotCoord;
  to: SlotCoord;
}

export function swapSlots(args: SwapArgs): PlainPage[] {
  const pages = clonePages(args.pages);
  const a = getSlot(pages, args.from);
  const b = getSlot(pages, args.to);
  const tmpPull = a.packPullId;
  const tmpNote = a.note;
  a.packPullId = b.packPullId;
  a.note = b.note;
  b.packPullId = tmpPull;
  b.note = tmpNote;
  return pages;
}

function clonePages(pages: PlainPage[]): PlainPage[] {
  return pages.map((p) => ({
    title: p.title,
    backgroundId: p.backgroundId,
    slots: p.slots.map((s) => ({ ...s })),
  }));
}

export function collectPackPullIds(pages: PlainPage[]): Set<string> {
  const ids = new Set<string>();
  for (const page of pages) {
    for (const slot of page.slots) {
      if (slot.packPullId) ids.add(slot.packPullId);
    }
  }
  return ids;
}

export function findSlotOf(
  pages: PlainPage[],
  packPullId: string,
): SlotCoord | null {
  for (let pi = 0; pi < pages.length; pi += 1) {
    for (const slot of pages[pi].slots) {
      if (slot.packPullId === packPullId) {
        return { pageIndex: pi, slotPosition: slot.position };
      }
    }
  }
  return null;
}
