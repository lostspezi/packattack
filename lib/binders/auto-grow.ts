import { makeEmptyPage, type PlainPage, SLOTS_PER_PAGE } from "./slot-ops";

export const MAX_PAGES = 200;

export function isPageFull(page: PlainPage): boolean {
  let filled = 0;
  for (const slot of page.slots) {
    if (slot.packPullId) filled += 1;
  }
  return filled >= SLOTS_PER_PAGE;
}

/**
 * Returns a new pages array with one empty page appended if the last page is
 * full. Caps at MAX_PAGES. Templates skip this — caller should only invoke on
 * type === "free".
 */
export function autoGrowIfNeeded(pages: PlainPage[]): PlainPage[] {
  if (pages.length === 0) return [makeEmptyPage()];
  if (pages.length >= MAX_PAGES) return pages;
  const last = pages[pages.length - 1];
  if (isPageFull(last)) {
    return [...pages, makeEmptyPage()];
  }
  return pages;
}
