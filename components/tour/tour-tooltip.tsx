"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { TourPlacement } from "@/lib/tour/step-types";

interface TourTooltipProps {
  target: HTMLElement | null;
  placement?: TourPlacement;
  title: string;
  body: string;
  stepIndex: number;
  totalSteps: number;
  nextLabel?: string;
  showNextButton: boolean;
  canSkip: boolean;
  onNext?: () => void;
  onSkip: () => void;
}

const GAP = 14;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_MAX_HEIGHT = 280;
const SIDE_PADDING = 12;

type Position = { top: number; left: number };

function computePosition(
  rect: DOMRect | null,
  placement: TourPlacement,
): Position {
  if (typeof window === "undefined") return { top: 0, left: 0 };
  const viewport = {
    w: window.innerWidth,
    h: window.innerHeight,
  };

  if (!rect) {
    return {
      top: Math.max(SIDE_PADDING, (viewport.h - TOOLTIP_MAX_HEIGHT) / 2),
      left: Math.max(SIDE_PADDING, (viewport.w - TOOLTIP_WIDTH) / 2),
    };
  }

  const below = rect.bottom + GAP;
  const above = rect.top - TOOLTIP_MAX_HEIGHT - GAP;
  const right = rect.right + GAP;
  const left = rect.left - TOOLTIP_WIDTH - GAP;

  let resolved: TourPlacement = placement;
  if (resolved === "auto") {
    if (viewport.h - rect.bottom > TOOLTIP_MAX_HEIGHT + GAP) resolved = "bottom";
    else if (rect.top > TOOLTIP_MAX_HEIGHT + GAP) resolved = "top";
    else if (viewport.w - rect.right > TOOLTIP_WIDTH + GAP) resolved = "right";
    else resolved = "left";
  }

  let top = 0;
  let x = 0;
  switch (resolved) {
    case "top":
      top = above;
      x = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
    case "left":
      top = rect.top + rect.height / 2 - TOOLTIP_MAX_HEIGHT / 2;
      x = left;
      break;
    case "right":
      top = rect.top + rect.height / 2 - TOOLTIP_MAX_HEIGHT / 2;
      x = right;
      break;
    case "bottom":
    default:
      top = below;
      x = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
  }

  // Clamp into viewport
  x = Math.max(
    SIDE_PADDING,
    Math.min(x, viewport.w - TOOLTIP_WIDTH - SIDE_PADDING),
  );
  top = Math.max(
    SIDE_PADDING,
    Math.min(top, viewport.h - TOOLTIP_MAX_HEIGHT - SIDE_PADDING),
  );
  return { top, left: x };
}

export function TourTooltip({
  target,
  placement = "auto",
  title,
  body,
  stepIndex,
  totalSteps,
  nextLabel,
  showNextButton,
  canSkip,
  onNext,
  onSkip,
}: TourTooltipProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!target) return;
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("scroll", bump, true);
    window.addEventListener("resize", bump);
    const ro = new ResizeObserver(bump);
    ro.observe(target);
    return () => {
      window.removeEventListener("scroll", bump, true);
      window.removeEventListener("resize", bump);
      ro.disconnect();
    };
  }, [target]);

  const position = useMemo(() => {
    const rect = target?.getBoundingClientRect() ?? null;
    return computePosition(rect, placement);
    // `tick` is intentionally in the dep list to recompute on scroll / resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, placement, tick]);

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={title}
      className="fixed z-[1003] bg-surface-elevated border border-border rounded-2xl shadow-2xl p-4"
      style={{
        top: position.top,
        left: position.left,
        width: TOOLTIP_WIDTH,
        maxHeight: TOOLTIP_MAX_HEIGHT,
      }}
    >
      <div className="flex items-start gap-2 mb-2">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pa-green/15 text-pa-green">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-text-primary font-semibold text-sm leading-tight">
            {title}
          </h3>
          <p className="text-text-muted text-[11px] mt-0.5">
            Schritt {stepIndex + 1} von {totalSteps}
          </p>
        </div>
        {canSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-text-muted hover:text-text-secondary p-1 rounded-md shrink-0"
            aria-label="Tour beenden"
            title="Tour beenden"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap">
        {body}
      </p>

      <div
        className={[
          "flex items-center mt-3",
          canSkip ? "justify-between" : "justify-end",
        ].join(" ")}
      >
        {canSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-text-muted text-xs hover:text-text-secondary"
          >
            Später
          </button>
        )}
        {showNextButton && (
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center rounded-[10px] bg-pa-green text-black font-medium text-sm px-3 py-1.5 hover:brightness-110"
          >
            {nextLabel ?? "Weiter"}
          </button>
        )}
      </div>
    </div>
  );
}
