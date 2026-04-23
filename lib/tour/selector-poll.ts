export const SELECTOR_POLL_TIMEOUT_MS = 3000;
export const SELECTOR_POLL_INTERVAL_MS = 80;

export interface WaitForElementOptions {
  timeoutMs?: number;
  intervalMs?: number;
  signal?: AbortSignal;
}

/**
 * Polls the DOM for an element matching `selector` until it appears or the
 * timeout elapses. Resolves with the element, or `null` on timeout / abort.
 *
 * Polling (not MutationObserver) is deliberate: the tour engine already
 * tears down and re-mounts on every step, so we don't need the observer's
 * change-stream semantics — just a "is it visible yet" check. Polling is
 * also simpler to cancel via AbortSignal.
 */
export function waitForElement(
  selector: string,
  options: WaitForElementOptions = {},
): Promise<HTMLElement | null> {
  const {
    timeoutMs = SELECTOR_POLL_TIMEOUT_MS,
    intervalMs = SELECTOR_POLL_INTERVAL_MS,
    signal,
  } = options;

  if (typeof document === "undefined") return Promise.resolve(null);

  const immediate = document.querySelector<HTMLElement>(selector);
  if (immediate) return Promise.resolve(immediate);
  if (signal?.aborted) return Promise.resolve(null);

  return new Promise((resolve) => {
    let done = false;
    const deadline = Date.now() + timeoutMs;

    const poll = () => {
      if (done) return;
      if (signal?.aborted) {
        finish(null);
        return;
      }
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        finish(el);
        return;
      }
      if (Date.now() >= deadline) {
        finish(null);
        return;
      }
      setTimeout(poll, intervalMs);
    };

    const finish = (result: HTMLElement | null) => {
      if (done) return;
      done = true;
      signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };

    const onAbort = () => finish(null);
    signal?.addEventListener("abort", onAbort, { once: true });

    setTimeout(poll, intervalMs);
  });
}
