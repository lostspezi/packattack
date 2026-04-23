"use client";

import { useEffect, useState } from "react";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TourOverlayProps {
  target: HTMLElement | null;
  onBackdropClick?: () => void;
}

const PADDING = 6;
const BORDER_RADIUS = 10;

/**
 * Dim + spotlight. A single fixed-position box sized to the target element
 * with a massive outward box-shadow creates the surrounding overlay — no
 * SVG, no 4-rect mosaic, just one element. `pointer-events: auto` on the
 * shadow-caster catches stray clicks; the target itself remains reachable
 * because the spotlight box sits above it with `pointer-events: none`.
 */
export function TourOverlay({ target, onBackdropClick }: TourOverlayProps) {
  const [rect, setRect] = useState<TargetRect | null>(null);

  useEffect(() => {
    if (!target) return;

    const update = () => {
      const r = target.getBoundingClientRect();
      setRect({
        top: r.top - PADDING,
        left: r.left - PADDING,
        width: r.width + PADDING * 2,
        height: r.height + PADDING * 2,
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(target);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [target]);

  // When target clears (between steps), drop the stale rect so the dim
  // renders as a plain full-screen backdrop instead of a lingering hole.
  // This runs as a derived reset — evaluated during render, no setState-
  // in-effect.
  const rectForRender = target ? rect : null;

  // Full-screen dim for steps without a DOM target (welcome / complete).
  if (!target || !rectForRender) {
    return (
      <div
        className="fixed inset-0 z-[1000] bg-black/70"
        onClick={onBackdropClick}
        aria-hidden="true"
      />
    );
  }

  return (
    <>
      {/* Click-catcher behind the spotlight */}
      <div
        className="fixed inset-0 z-[1000]"
        onClick={onBackdropClick}
        aria-hidden="true"
      />
      {/* Spotlight frame — huge outward shadow creates the dimmed surround */}
      <div
        className="fixed z-[1001] pointer-events-none transition-[top,left,width,height] duration-200 ease-out"
        style={{
          top: rectForRender.top,
          left: rectForRender.left,
          width: rectForRender.width,
          height: rectForRender.height,
          borderRadius: BORDER_RADIUS,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.7)",
        }}
        aria-hidden="true"
      />
      {/* Subtle ring around the spotlight */}
      <div
        className="fixed z-[1002] pointer-events-none"
        style={{
          top: rectForRender.top,
          left: rectForRender.left,
          width: rectForRender.width,
          height: rectForRender.height,
          borderRadius: BORDER_RADIUS,
          boxShadow: "0 0 0 2px rgba(155, 255, 0, 0.6), 0 0 18px rgba(155, 255, 0, 0.25)",
        }}
        aria-hidden="true"
      />
    </>
  );
}
