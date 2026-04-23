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
  interpolatePattern,
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
import { useToast } from "@/components/ui/toast";
import type { TourState } from "@/lib/packi/tour-validation";

interface TourContextValue {
  isActive: boolean;
  currentStep: TourStep | null;
  stepIndex: number;
  totalSteps: number;
  start: () => Promise<void>;
  skip: () => void;
  advance: () => void;
  tutorialSlug: string | null;
}

interface TourCompleteResponse {
  reward: number;
  coins: number;
  tour: TourState;
}

const TourContext = createContext<TourContextValue | null>(null);

interface TourProviderProps {
  steps: TourStep[];
  children: ReactNode;
}

export function TourProvider({ steps, children }: TourProviderProps) {
  const { me, setTour } = useMeContext();
  const { toast } = useToast();

  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tutorialSlug, setTutorialSlug] = useState<string | null>(null);

  const advanceLockRef = useRef(false);
  // Flipped the first time the tour is started in this mount — whether by
  // auto-start or a manual Packi-panel click. Gates the auto-start effect
  // so a brief completed=false / isActive=false window during finish()
  // (between setIsActive(false) and the POST-response setTour) can't
  // re-trigger the tour.
  const tourRunStartedRef = useRef(false);

  const currentStep = isActive ? (steps[stepIndex] ?? null) : null;

  const start = useCallback(async () => {
    // Any start — manual or auto — is a tour run. Mark it before any
    // async work so the auto-start effect never sees a window where the
    // ref is still false after this entrypoint fires.
    tourRunStartedRef.current = true;

    // Resolve the tutorial-box slug before the tour enters its first routed
    // step. Without it, pack-buy can't navigate anywhere sensible.
    try {
      const res = await fetch("/api/tutorial-box");
      if (!res.ok) {
        toast({
          type: "error",
          title: "Keine Tutorial-Box konfiguriert",
          message:
            "Ein Admin muss erst eine Box als Tutorial markieren, damit die Tour starten kann.",
        });
        return;
      }
      const data = (await res.json()) as { slug: string };
      setTutorialSlug(data.slug);
    } catch {
      toast({ type: "error", title: "Tour konnte nicht gestartet werden" });
      return;
    }

    setStepIndex(0);
    setIsActive(true);
    advanceLockRef.current = false;
    const next = await patchTour({
      skippedAt: null,
      completed: false,
      completedSteps: [],
      sessionCountSincePrompt: 0,
    });
    if (next) setTour(next);
  }, [setTour, toast]);

  const finish = useCallback(async () => {
    setIsActive(false);
    advanceLockRef.current = false;
    try {
      const res = await fetch("/api/me/tour/complete", { method: "POST" });
      if (res.ok) {
        const body = (await res.json()) as TourCompleteResponse;
        setTour(body.tour);
        if (body.reward > 0) {
          toast({
            type: "success",
            title: `+${body.reward} Coins`,
            message: "Deine Belohnung für die Tour ist gutgeschrieben. 🎴",
          });
        }
        window.dispatchEvent(new CustomEvent("coin-balance-refresh"));
      }
    } catch {
      // Network error at the very end — don't surface, the patch-based
      // completion fallback below still marks the tour done.
    }
    const next = await patchTour({ completed: true, skippedAt: null });
    if (next) setTour(next);
  }, [setTour, toast]);

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
    console.debug("[tour] advance", {
      from: step.id,
      nextIndex: stepIndex + 1,
    });

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

  // Auto-start for genuinely new users only:
  //   - MeProvider has hydrated
  //   - The reward was never granted (first-time gate — set once by the
  //     server atomically at first completion and never cleared)
  //   - The tour isn't currently active
  //   - The user hasn't already skipped in this session
  //   - No tour run has been started yet on this mount
  //
  // Deferred via setTimeout so the setState work inside start() doesn't
  // run synchronously in the effect body.
  useEffect(() => {
    if (tourRunStartedRef.current) return;
    if (!me) return;
    if (isActive) return;
    if (me.tour.rewardGrantedAt) return;
    if (me.tour.completed) return;
    if (me.tour.skippedAt) return;
    tourRunStartedRef.current = true;
    const handle = setTimeout(() => void start(), 0);
    return () => clearTimeout(handle);
  }, [me, isActive, start]);

  const value = useMemo<TourContextValue>(
    () => ({
      isActive,
      currentStep,
      stepIndex,
      totalSteps: steps.length,
      start,
      skip,
      advance,
      tutorialSlug,
    }),
    [
      isActive,
      currentStep,
      stepIndex,
      steps.length,
      start,
      skip,
      advance,
      tutorialSlug,
    ],
  );

  // Replay = user has completed the tour and claimed the reward at least
  // once. Used to pick alternate copy that doesn't re-promise the bonus.
  const isReplay = Boolean(me?.tour.rewardGrantedAt);

  return (
    <TourContext.Provider value={value}>
      {children}
      {isActive && currentStep && (
        <TourStepRunner
          key={`${stepIndex}-${currentStep.id}`}
          step={currentStep}
          stepIndex={stepIndex}
          totalSteps={steps.length}
          tutorialSlug={tutorialSlug}
          isReplay={isReplay}
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
  tutorialSlug: string | null;
  isReplay: boolean;
  onAdvance: () => void;
  onSkip: () => void;
}

/**
 * Renders a single tour step. Keyed by step so React remounts it on each
 * transition — that gives us fresh `target` / `resolved` state without any
 * setState-in-effect shenanigans.
 */
function TourStepRunner({
  step,
  stepIndex,
  totalSteps,
  tutorialSlug,
  isReplay,
  onAdvance,
  onSkip,
}: TourStepRunnerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ lang?: string }>();
  const lang = params?.lang ?? "de";
  const copy = pickCopy(step, lang, isReplay);
  const interpolationVars = useMemo(
    () => ({ lang, tutorialSlug: tutorialSlug ?? "" }),
    [lang, tutorialSlug],
  );

  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [resolved, setResolved] = useState(false);

  // Navigate if needed + resolve target.
  useEffect(() => {
    const expectedRoute = interpolatePattern(step.route, interpolationVars);
    if (
      pathname !== expectedRoute &&
      !pathname.startsWith(`${expectedRoute}/`)
    ) {
      console.debug("[tour] navigating", {
        stepId: step.id,
        from: pathname,
        to: expectedRoute,
      });
      router.push(expectedRoute);
      return;
    }

    console.debug("[tour] step-effect run", {
      stepId: step.id,
      selector: step.selector,
      pathname,
    });

    const controller = new AbortController();
    let cancelled = false;
    void waitForElement(step.selector, {
      timeoutMs: step.waitTimeoutMs,
      signal: controller.signal,
    }).then((el) => {
      if (cancelled) return;
      console.debug("[tour] target resolved", {
        stepId: step.id,
        found: !!el,
      });
      setTarget(el);
      setResolved(true);
      if (!el && !step.targetOptional) {
        console.warn("[tour] target missing (non-optional, skipping)", {
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
  }, [step, interpolationVars, pathname, router, onAdvance]);

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
  // nothing during the (potentially long) selector wait and thinks the tour
  // froze. Non-optional steps still wait: their tooltip is anchored to a
  // real DOM target, so rendering before resolution would flash at (0,0).
  if (!resolved && !step.targetOptional) return null;

  // Normally click-target steps hide the Weiter-button so the spotlight
  // invites the user to click the highlighted element. But if the target
  // search finished without finding anything (targetOptional + timeout),
  // there's nothing to click — fall back to Weiter so the user isn't
  // trapped. While still polling we keep Weiter hidden so users don't
  // shortcut past a real purchase that's about to be reachable.
  const showNextButton =
    step.nextTrigger.type !== "click-target" || (resolved && !target);

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
