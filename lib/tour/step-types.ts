export type TourPlacement = "top" | "bottom" | "left" | "right" | "auto";

export type TourNextTrigger =
  | { type: "click-target" }
  | { type: "click-next" }
  | { type: "event"; event: string };

export interface TourCopy {
  title: string;
  body: string;
  nextLabel?: string;
}

export interface TourStep {
  id: string;
  /**
   * Route pattern using `{lang}` as the locale placeholder.
   * Example: `/{lang}/packs`
   */
  route: string;
  /**
   * CSS selector of the element to spotlight. Convention:
   * `[data-tour="<id>"]` applied to the target component.
   */
  selector: string;
  placement?: TourPlacement;
  nextTrigger: TourNextTrigger;
  /** Inline per-locale copy — swappable for DB translations later. */
  copy: Record<string, TourCopy>;
  /**
   * Optional soft timeout override for the selector wait.
   * Defaults to SELECTOR_POLL_TIMEOUT_MS.
   */
  waitTimeoutMs?: number;
  /**
   * Some steps only narrate ("welcome", "completed") without a real
   * DOM target. Set `targetOptional: true` so the engine renders the
   * tooltip centered on the viewport if the selector isn't found.
   */
  targetOptional?: boolean;
}

export const TOUR_EVENT_NAME = "packi-tour-event";

export interface TourEventDetail {
  event: string;
}

export function interpolateRoute(pattern: string, lang: string): string {
  return pattern.replace(/\{lang\}/g, lang);
}

export function pickCopy(step: TourStep, lang: string): TourCopy {
  return step.copy[lang] ?? step.copy.en ?? step.copy.de ?? Object.values(step.copy)[0];
}
