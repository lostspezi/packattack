"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "motion/react";
import type { EffectTier } from "./effect-tiers";
import { TIER_CONFIGS } from "./effect-tiers";
import type { ParticleCanvasHandle } from "./particle-canvas";

interface PackRipperProps {
  boxName: string;
  maxTier: EffectTier;
  particleRef: React.RefObject<ParticleCanvasHandle | null>;
  onRipComplete: () => void;
  onPlaySound: (key: "rip" | "burst", volume?: number) => void;
}

const PACK_W = 200;
const PACK_H = 280;
const TEAR_Y = 80; // px from top of pack where the tear sits
const TEAR_ZONE = 50; // px tolerance above/below tear line for starting
const COMPLETE_THRESHOLD = 0.9;

export function PackRipper({
  boxName,
  maxTier,
  particleRef,
  onRipComplete,
  onPlaySound,
}: PackRipperProps) {
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState(0); // 0-1 horizontal rip progress
  const containerRef = useRef<HTMLDivElement>(null);
  const packRef = useRef<HTMLDivElement>(null);
  const rippingRef = useRef(false);
  const completedRef = useRef(false);
  const ripSoundPlayed = useRef(false);
  const lastEmitX = useRef(-1);
  const animFrameRef = useRef<number>(0);

  const tierColors = TIER_CONFIGS[maxTier].colors;
  const glowColor = tierColors[0];

  // Gap between top and bottom grows with progress
  const gap = progress * 10;
  // Top piece tilts slightly as rip progresses
  const topTiltDeg = progress * -3;

  const triggerComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    rippingRef.current = false;
    setCompleted(true);
    setProgress(1);
    onPlaySound("burst", 0.7);
    if (navigator.vibrate) navigator.vibrate([50, 30, 100]);

    // Big particle burst along the full tear line
    const packRect = packRef.current?.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (packRect && containerRect && particleRef.current) {
      const ox = packRect.left - containerRect.left;
      const oy = packRect.top - containerRect.top + TEAR_Y;
      particleRef.current.emit({
        x: ox + PACK_W / 2,
        y: oy,
        count: 35,
        colors: tierColors,
        speed: [100, 280],
        size: [3, 8],
        lifetime: [600, 1400],
        gravity: 70,
        spread: Math.PI,
        shape: "circle",
      });
    }
    setTimeout(() => onRipComplete(), 900);
  }, [onPlaySound, onRipComplete, particleRef, tierColors]);

  const emitSparks = useCallback(
    (clientX: number) => {
      const packRect = packRef.current?.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!packRect || !containerRect || !particleRef.current) return;

      const relX = clientX - packRect.left;
      // Only emit every ~12px of movement
      if (Math.abs(relX - lastEmitX.current) < 12) return;
      lastEmitX.current = relX;

      const ox = packRect.left - containerRect.left + relX;
      const oy = packRect.top - containerRect.top + TEAR_Y;
      particleRef.current.emit({
        x: ox,
        y: oy,
        count: 3,
        colors: tierColors,
        speed: [40, 130],
        size: [1, 4],
        lifetime: [200, 600],
        gravity: 50,
        spread: Math.PI * 0.8,
        shape: "circle",
      });
    },
    [particleRef, tierColors],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (completedRef.current) return;
      const rect = packRef.current?.getBoundingClientRect();
      if (!rect) return;

      const relY = e.clientY - rect.top;
      // Only start if pointer is near the tear line
      if (Math.abs(relY - TEAR_Y) > TEAR_ZONE) return;

      rippingRef.current = true;
      packRef.current?.setPointerCapture(e.pointerId);

      if (!ripSoundPlayed.current) {
        onPlaySound("rip", 0.4);
        ripSoundPlayed.current = true;
      }

      const relX = e.clientX - rect.left;
      const prog = Math.max(0, Math.min(1, relX / rect.width));
      setProgress(prog);
      emitSparks(e.clientX);
    },
    [onPlaySound, emitSparks],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!rippingRef.current || completedRef.current) return;
      const rect = packRef.current?.getBoundingClientRect();
      if (!rect) return;

      const relX = e.clientX - rect.left;
      const prog = Math.max(0, Math.min(1, relX / rect.width));
      setProgress(prog);
      emitSparks(e.clientX);

      if (prog >= COMPLETE_THRESHOLD) {
        triggerComplete();
      }
    },
    [emitSparks, triggerComplete],
  );

  const handlePointerUp = useCallback(() => {
    if (completedRef.current) return;
    rippingRef.current = false;
    // Snap back if not complete
    setProgress(0);
    ripSoundPlayed.current = false;
    lastEmitX.current = -1;
  }, []);

  // Cleanup animation frame on unmount
  useEffect(() => {
    const ref = animFrameRef;
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, []);

  // ─── Completed state: top flips away ───
  if (completed) {
    return (
      <div ref={containerRef} className="relative flex flex-col items-center py-8">
        <div className="relative" style={{ width: PACK_W }}>
          {/* Top half — flies away */}
          <motion.div
            className="absolute top-0 left-0 w-full overflow-hidden rounded-t-2xl border-2 border-pa-green/50 border-b-0"
            style={{ height: TEAR_Y, transformOrigin: "bottom center" }}
            initial={{ rotateX: 0, y: 0, opacity: 1 }}
            animate={{ rotateX: -60, y: -180, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/card-back.jpg"
              alt=""
              draggable={false}
              className="absolute w-full object-cover top-0 left-0 pointer-events-none"
              style={{ height: PACK_H }}
            />
          </motion.div>

          {/* Glow burst at tear line */}
          <motion.div
            className="absolute left-[-10px] right-[-10px] h-[6px] rounded-full"
            style={{ top: TEAR_Y - 3, background: glowColor, boxShadow: `0 0 20px ${glowColor}, 0 0 40px ${glowColor}` }}
            initial={{ opacity: 1, scaleY: 1 }}
            animate={{ opacity: 0, scaleY: 4 }}
            transition={{ duration: 0.8 }}
          />

          {/* Bottom half — stays */}
          <div
            className="absolute left-0 w-full overflow-hidden rounded-b-2xl border-2 border-pa-green/50 border-t-0"
            style={{ top: TEAR_Y, height: PACK_H - TEAR_Y, boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/card-back.jpg"
              alt=""
              draggable={false}
              className="absolute w-full object-cover left-0 pointer-events-none"
              style={{ height: PACK_H, top: -TEAR_Y }}
            />
          </div>
        </div>
        {/* Spacer to maintain layout height */}
        <div style={{ height: PACK_H + 40 }} />
      </div>
    );
  }

  // ─── Active ripping state ───
  return (
    <div ref={containerRef} className="relative flex flex-col items-center py-8">
      <div
        ref={packRef}
        className="relative select-none touch-none cursor-crosshair"
        style={{ width: PACK_W, height: PACK_H + gap, perspective: 600 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="button"
        tabIndex={0}
        aria-label="Drag along the tear line to rip open the pack"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            triggerComplete();
          }
        }}
      >
        {/* Top half */}
        <div
          className="absolute top-0 left-0 w-full overflow-hidden rounded-t-2xl border-2 border-pa-green/50 border-b-0"
          style={{
            height: TEAR_Y,
            transform: `rotateX(${topTiltDeg}deg)`,
            transformOrigin: "bottom center",
            transition: "transform 0.1s ease-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/card-back.jpg"
            alt=""
            draggable={false}
            className="absolute w-full object-cover top-0 left-0 pointer-events-none"
            style={{ height: PACK_H }}
          />
          <div className="absolute inset-0 animate-holo-shimmer pointer-events-none" />
        </div>

        {/* Tear line overlay — inside the pack */}
        <div
          className="absolute left-0 w-full pointer-events-none"
          style={{ top: TEAR_Y - 1 + gap / 2, height: 2, zIndex: 10 }}
        >
          {/* Animated arrow hint — visible only before ripping starts */}
          {progress < 0.01 && (
            <motion.div
              className="absolute -translate-y-1/2 flex items-center gap-1"
              style={{ top: "50%" }}
              animate={{ left: ["5%", "85%", "5%"] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="text-pa-green text-xs font-bold drop-shadow-[0_0_6px_rgba(155,255,0,0.8)]">&#9654;</span>
            </motion.div>
          )}

          {/* Background tear line (dashed, visible where not yet ripped) */}
          {progress < 0.01 && (
            <div
              className="absolute inset-0"
              style={{
                background: "repeating-linear-gradient(90deg, rgba(155,255,0,0.5) 0px, rgba(155,255,0,0.5) 8px, transparent 8px, transparent 14px)",
              }}
            />
          )}

          {/* Rip glow — visible portion (left to progress) */}
          {progress > 0 && (
            <div
              className="absolute top-1/2 h-[4px] -translate-y-1/2 left-0 rounded-full"
              style={{
                width: `${progress * 100}%`,
                background: `linear-gradient(90deg, ${glowColor}80, ${glowColor})`,
                boxShadow: `0 0 10px ${glowColor}, 0 0 25px ${glowColor}80`,
              }}
            />
          )}

          {/* Rip cursor — bright dot at rip point */}
          {progress > 0.01 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full"
              style={{
                left: `${progress * 100}%`,
                width: 14,
                height: 14,
                background: glowColor,
                boxShadow: `0 0 12px ${glowColor}, 0 0 24px ${glowColor}, 0 0 40px ${glowColor}80`,
              }}
            />
          )}
        </div>

        {/* Bottom half */}
        <div
          className="absolute left-0 w-full overflow-hidden rounded-b-2xl border-2 border-pa-green/50 border-t-0"
          style={{
            top: TEAR_Y + gap,
            height: PACK_H - TEAR_Y,
            boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/card-back.jpg"
            alt={boxName}
            draggable={false}
            className="absolute w-full object-cover left-0 pointer-events-none"
            style={{ height: PACK_H, top: -TEAR_Y }}
          />
        </div>
      </div>

    </div>
  );
}
