"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { TourOverlay } from "@/components/tour/tour-overlay";
import { TourTooltip } from "@/components/tour/tour-tooltip";
import {
  interpolateRoute,
  pickCopy,
  TOUR_EVENT_NAME,
  type TourEventDetail,
  type TourStep,
} from "@/lib/tour/step-types";
import { waitForElement } from "@/lib/tour/selector-poll";
import {
  mergeCompletedSteps,
  patchTour,
  readLocalProgress,
  writeLocalProgress,
} from "@/lib/tour/progress";
import { useMeContext } from "@/components/layout/me-provider";

interface TourContextValue {
  isActive: boolean;
  currentStep: TourStep | null;
  stepIndex: number;
  totalSteps: number;
  start: () => void;
  skip: () => void;
  advance: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

interface TourProviderProps {
  steps: TourStep[];
  children: ReactNode;
}

export function TourProvider({ steps, children }: TourProviderProps) {
  const { me, setTour } = useMeContext();

  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const advanceLockRef = useRef(false);

  const currentStep = isActive ? (steps[stepIndex] ?? null) : null;

  const start = useCallback(() => {
    setStepIndex(0);
    setIsActive(true);
    advanceLockRef.current = false;
    void patchTour({
      skippedAt: null,
      completed: false,
      completedSteps: [],
      sessionCountSincePrompt: 0,
    }).then((next) => {
      if (next) setTour(next);
    });
  }, [setTour]);

  const finish = useCallback(async () => {
    setIsActive(false);
    advanceLockRef.current = false;
    const next = await patchTour({ completed: true, skippedAt: null });
    if (next) setTour(next);
  }, [setTour]);

  const skip = useCallback(async () => {
    setIsActive(false);
    advanceLockRef.current = false;
    const next = await patchTour({
      skippedAt: new Date().toISOString(),
      sessionCountSincePrompt: 0,
      lastPromptAt: new Date().toISOString(),
    });
    if (next) setTour(next);
  }, [setTour]);

  const advance = useCallback(async () => {
    if (advanceLockRef.current) return;
    advanceLockRef.current = true;
    const step = steps[stepIndex];
    if (!step) {
      advanceLockRef.current = false;
      return;
    }

    const priorLocal = readLocalProgress()?.completedSteps ?? [];
    const merged = mergeCompletedSteps(priorLocal, [step.id]);
    writeLocalProgress({
      completedSteps: merged,
      lastStep: step.id,
      updatedAt: Date.now(),
    });
    const next = await patchTour({ addCompletedStep: step.id });
    if (next) setTour(next);

    const nextIdx = stepIndex + 1;
    if (nextIdx >= steps.length) {
      await finish();
      return;
    }
    setStepIndex(nextIdx);
    advanceLockRef.current = false;
  }, [steps, stepIndex, finish, setTour]);

  // Escape to skip — lives at provider level so it works regardless of runner.
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isActive, skip]);

  // Placeholder for Phase 7: auto-start on cold-load when the user has
  // never seen the tour. Reserved — not wired yet.
  useEffect(() => {
    if (!me) return;
    if (me.tour.completed) return;
  }, [me]);

  const value = useMemo<TourContextValue>(
    () => ({
      isActive,
      currentStep,
      stepIndex,
      totalSteps: steps.length,
      start,
      skip,
      advance,
    }),
    [isActive, currentStep, stepIndex, steps.length, start, skip, advance],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {isActive && currentStep && (
        <TourStepRunner
          key={`${stepIndex}-${currentStep.id}`}
          step={currentStep}
          stepIndex={stepIndex}
          totalSteps={steps.length}
          onAdvance={() => void advance()}
          onSkip={() => void skip()}
        />
      )}
    </TourContext.Provider>
  );
}

interface TourStepRunnerProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  onAdvance: () => void;
  onSkip: () => void;
}

/**
 * Renders a single tour step. Keyed by step so React remounts it on each
 * transition — that gives us fresh `target` / `waiting` state without any
 * setState-in-effect shenanigans.
 */
function TourStepRunner({
  step,
  stepIndex,
  totalSteps,
  onAdvance,
  onSkip,
}: TourStepRunnerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ lang?: string }>();
  const lang = params?.lang ?? "de";
  const copy = pickCopy(step, lang);

  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [resolved, setResolved] = useState(false);

  // Navigate if needed + resolve target.
  useEffect(() => {
    const expectedRoute = interpolateRoute(step.route, lang);
    if (
      pathname !== expectedRoute &&
      !pathname.startsWith(`${expectedRoute}/`)
    ) {
      router.push(expectedRoute);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    void waitForElement(step.selector, {
      timeoutMs: step.waitTimeoutMs,
      signal: controller.signal,
    }).then((el) => {
      if (cancelled) return;
      setTarget(el);
      setResolved(true);
      if (!el && !step.targetOptional) {
        console.warn("[tour] target missing", {
          stepId: step.id,
          selector: step.selector,
        });
        onAdvance();
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [step, lang, pathname, router, onAdvance]);

  // Wire up next-triggers (click-target, event).
  useEffect(() => {
    const { nextTrigger } = step;

    if (nextTrigger.type === "click-target" && target) {
      const onClick = () => onAdvance();
      target.addEventListener("click", onClick, { once: true });
      return () => target.removeEventListener("click", onClick);
    }

    if (nextTrigger.type === "event") {
      const expected = nextTrigger.event;
      const handler = (e: Event) => {
        const detail = (e as CustomEvent<TourEventDetail>).detail;
        if (detail?.event === expected) onAdvance();
      };
      window.addEventListener(TOUR_EVENT_NAME, handler);
      return () => window.removeEventListener(TOUR_EVENT_NAME, handler);
    }

    return undefined;
  }, [step, target, onAdvance]);

  // Render immediately for targetOptional steps — otherwise a user sees
  // nothing during the (potentially 6s) selector wait and thinks the tour
  // froze. Non-optional steps still wait: their tooltip is anchored to a
  // real DOM target, so rendering before resolution would flash at (0,0).
  if (!resolved && !step.targetOptional) return null;

  // Show the Weiter-button for click-next AND event triggers. Event-typed
  // steps need an explicit fallback because the expected custom event
  // (e.g. "pack-opened") might not fire in this session — the user still
  // needs a way to proceed.
  const showNextButton = step.nextTrigger.type !== "click-target";

  return (
    <>
      <TourOverlay
        target={step.targetOptional && !target ? null : target}
        onBackdropClick={onSkip}
      />
      <TourTooltip
        target={step.targetOptional && !target ? null : target}
        placement={step.placement}
        title={copy.title}
        body={copy.body}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        nextLabel={copy.nextLabel}
        showNextButton={showNextButton}
        onNext={onAdvance}
        onSkip={onSkip}
      />
    </>
  );
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour must be used within <TourProvider>");
  }
  return ctx;
}
