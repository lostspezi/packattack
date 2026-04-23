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
   * Optional copy overrides shown when the user replays the tour after
   * completing it once. Typically used to suppress the reward promise
   * on the welcome/final steps — the reward is one-time per account, so
   * mentioning it again would mislead. Partial: any field not specified
   * falls back to the base `copy`.
   */
  copyOnReplay?: Record<string, Partial<TourCopy>>;
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

/**
 * Multi-placeholder interpolation for step routes and selectors. Any
 * `{name}` token in the pattern is replaced with `vars.name` (empty when
 * absent). `{lang}` is the canonical one; onboarding adds `{tutorialSlug}`.
 */
export function interpolatePattern(
  pattern: string,
  vars: Record<string, string>,
): string {
  return pattern.replace(/\{([a-zA-Z]+)\}/g, (_, key: string) => vars[key] ?? "");
}

// Backward-compatible shorthand for the common {lang}-only case.
export function interpolateRoute(pattern: string, lang: string): string {
  return interpolatePattern(pattern, { lang });
}

export function pickCopy(
  step: TourStep,
  lang: string,
  isReplay = false,
): TourCopy {
  const base =
    step.copy[lang] ?? step.copy.en ?? step.copy.de ?? Object.values(step.copy)[0];
  if (!isReplay || !step.copyOnReplay) return base;
  const override =
    step.copyOnReplay[lang] ??
    step.copyOnReplay.en ??
    step.copyOnReplay.de ??
    Object.values(step.copyOnReplay)[0];
  if (!override) return base;
  return { ...base, ...override };
}
