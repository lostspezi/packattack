"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import type { EffectTier } from "./effect-tiers";
import { TIER_CONFIGS } from "./effect-tiers";
import type { ParticleCanvasHandle } from "./particle-canvas";

interface PackRipperProps {
  boxName: string;
  cardCount: number;
  maxTier: EffectTier;
  particleRef: React.RefObject<ParticleCanvasHandle | null>;
  onRipComplete: () => void;
  onPlaySound: (key: "rip" | "burst", volume?: number) => void;
}

const PACK_W = 210;
const PACK_H = 310;
const TEAR_Y = 95;
const TEAR_ZONE = 55;
const COMPLETE_THRESHOLD = 0.9;

const FOIL_BG = "linear-gradient(160deg, #1a0e35 0%, #2a1850 15%, #1d0f3a 30%, #24043A 50%, #1a0e35 70%, #2a1850 85%, #1d0f3a 100%)";

function packBodyShadow(isBottom = false) {
  return isBottom
    ? "0 12px 40px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)"
    : "0 -4px 20px rgba(0,0,0,0.3), inset 0 -1px 0 rgba(255,255,255,0.05)";
}

/** 3D puffy depth — light center, dark edges */
function DepthOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{
      background:
        "radial-gradient(ellipse 70% 50% at 45% 40%, rgba(255,255,255,0.07) 0%, transparent 50%), " +
        "radial-gradient(ellipse 90% 90% at 50% 50%, transparent 40%, rgba(0,0,0,0.3) 100%)",
    }} />
  );
}

/** Sealed foil side edges */
function SideEdges() {
  return (
    <>
      <div className="absolute top-0 left-0 w-[3px] h-full pointer-events-none"
        style={{ background: "linear-gradient(to right, rgba(255,255,255,0.08), transparent)" }} />
      <div className="absolute top-0 right-0 w-[3px] h-full pointer-events-none"
        style={{ background: "linear-gradient(to left, rgba(255,255,255,0.08), transparent)" }} />
    </>
  );
}

/** Subtle static foil highlight — no animation */
function FoilHighlight() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{
      zIndex: 3,
      background: "linear-gradient(125deg, transparent 30%, rgba(155,255,0,0.04) 42%, rgba(255,255,255,0.06) 48%, rgba(255,215,0,0.03) 54%, transparent 66%)",
    }} />
  );
}

/** The full pack face design — logo + branding + patterns */
function PackFaceDesign({ cardCount, offsetY = 0 }: { cardCount: number; offsetY?: number }) {
  return (
    <div className="absolute left-0 w-full pointer-events-none" style={{ top: offsetY, height: PACK_H }}>
      {/* Subtle diagonal lines */}
      <div className="absolute inset-0" style={{
        background: `
          repeating-linear-gradient(135deg, transparent, transparent 20px, rgba(155,255,0,0.02) 20px, rgba(155,255,0,0.02) 21px),
          repeating-linear-gradient(45deg, transparent, transparent 28px, rgba(155,255,0,0.015) 28px, rgba(155,255,0,0.015) 29px)
        `,
      }} />

      {/* Corner brackets */}
      <svg className="absolute top-[14px] left-[10px] w-[30px] h-[30px]" viewBox="0 0 30 30" fill="none">
        <path d="M0 25 L0 6 L6 0 L25 0" stroke="rgba(155,255,0,0.12)" strokeWidth="1" />
      </svg>
      <svg className="absolute top-[14px] right-[10px] w-[30px] h-[30px]" viewBox="0 0 30 30" fill="none">
        <path d="M30 25 L30 6 L24 0 L5 0" stroke="rgba(155,255,0,0.12)" strokeWidth="1" />
      </svg>
      <svg className="absolute bottom-[14px] left-[10px] w-[30px] h-[30px]" viewBox="0 0 30 30" fill="none">
        <path d="M0 5 L0 24 L6 30 L25 30" stroke="rgba(155,255,0,0.12)" strokeWidth="1" />
      </svg>
      <svg className="absolute bottom-[14px] right-[10px] w-[30px] h-[30px]" viewBox="0 0 30 30" fill="none">
        <path d="M30 5 L30 24 L24 30 L5 30" stroke="rgba(155,255,0,0.12)" strokeWidth="1" />
      </svg>

      {/* Soft glow behind logo */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{
        top: 100, width: 160, height: 80,
        background: "radial-gradient(ellipse at center, rgba(155,255,0,0.06) 0%, transparent 70%)",
      }} />

      {/* Card count badge */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center" style={{ top: 24, zIndex: 2 }}>
        <div className="px-3 py-0.5 rounded-full" style={{ border: "1px solid rgba(155,255,0,0.15)", background: "rgba(155,255,0,0.04)" }}>
          <span className="text-[8px] font-bold uppercase tracking-[2px]" style={{ color: "rgba(155,255,0,0.4)" }}>
            {cardCount} Cards
          </span>
        </div>
      </div>

      {/* Line above logo */}
      <div className="absolute left-[20px] right-[20px] h-[1px]" style={{ top: 105, background: "linear-gradient(90deg, transparent, rgba(155,255,0,0.1), transparent)" }} />

      {/* Logo */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 120, width: 160, zIndex: 2 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo.svg" alt="Pack Attack" draggable={false} className="w-full h-auto" style={{ filter: "drop-shadow(0 0 8px rgba(155,255,0,0.3))" }} />
      </div>

      {/* Subtitle */}
      <div className="absolute left-0 right-0 flex justify-center" style={{ top: 155, zIndex: 2 }}>
        <span className="text-[7px] font-bold uppercase tracking-[3px]" style={{ color: "rgba(155,255,0,0.3)" }}>
          Booster Pack
        </span>
      </div>

      {/* Line below subtitle */}
      <div className="absolute left-[20px] right-[20px] h-[1px]" style={{ top: 172, background: "linear-gradient(90deg, transparent, rgba(155,255,0,0.1), transparent)" }} />

      {/* GG watermark */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 44, zIndex: 1 }}>
        <span className="text-[32px] font-black" style={{ color: "transparent", WebkitTextStroke: "1px rgba(155,255,0,0.04)", letterSpacing: "6px" }}>
          GG
        </span>
      </div>

      {/* Bottom URL */}
      <div className="absolute left-0 right-0 flex justify-center" style={{ bottom: 24, zIndex: 2 }}>
        <span className="text-[6px] uppercase tracking-[2px]" style={{ color: "rgba(155,255,0,0.18)" }}>
          packattack.gg
        </span>
      </div>

      {/* Inner border */}
      <div className="absolute rounded-lg pointer-events-none" style={{ top: 12, left: 8, right: 8, bottom: 12, border: "1px solid rgba(155,255,0,0.05)" }} />
    </div>
  );
}

export function PackRipper({
  boxName,
  cardCount,
  maxTier,
  particleRef,
  onRipComplete,
  onPlaySound,
}: PackRipperProps) {
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const packRef = useRef<HTMLDivElement>(null);
  const rippingRef = useRef(false);
  const completedRef = useRef(false);
  const ripSoundPlayed = useRef(false);
  const lastEmitX = useRef(-1);
  const animFrameRef = useRef<number>(0);

  // 3D mouse-tracking tilt
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const springX = useSpring(tiltX, { stiffness: 120, damping: 18 });
  const springY = useSpring(tiltY, { stiffness: 120, damping: 18 });

  const tierColors = TIER_CONFIGS[maxTier].colors;
  const glowColor = tierColors[0];
  const gap = progress * 12;
  const topTiltDeg = progress * -4;

  // Mouse tracking for 3D tilt
  const handleMouseMove = useCallback(
    (e: React.PointerEvent) => {
      if (rippingRef.current) return; // don't tilt while ripping
      const rect = packRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const x = (e.clientY - cy) / (rect.height / 2);
      const y = (e.clientX - cx) / (rect.width / 2);
      tiltX.set(x * -10);
      tiltY.set(y * 10);
    },
    [tiltX, tiltY],
  );

  const handleMouseLeave = useCallback(() => {
    tiltX.set(0);
    tiltY.set(0);
  }, [tiltX, tiltY]);

  const triggerComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    rippingRef.current = false;
    setCompleted(true);
    setProgress(1);
    onPlaySound("burst", 0.7);
    if (navigator.vibrate) navigator.vibrate([50, 30, 100]);
    const packRect = packRef.current?.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (packRect && containerRect && particleRef.current) {
      particleRef.current.emit({
        x: packRect.left - containerRect.left + PACK_W / 2,
        y: packRect.top - containerRect.top + TEAR_Y,
        count: 40, colors: tierColors,
        speed: [100, 300], size: [3, 8],
        lifetime: [600, 1400], gravity: 70,
        spread: Math.PI, shape: "circle",
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
      if (Math.abs(relX - lastEmitX.current) < 12) return;
      lastEmitX.current = relX;
      particleRef.current.emit({
        x: packRect.left - containerRect.left + relX,
        y: packRect.top - containerRect.top + TEAR_Y,
        count: 3, colors: tierColors,
        speed: [40, 130], size: [1, 4],
        lifetime: [200, 600], gravity: 50,
        spread: Math.PI * 0.8, shape: "circle",
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
      if (Math.abs(relY - TEAR_Y) > TEAR_ZONE) return;
      rippingRef.current = true;
      // Reset tilt when starting to rip
      tiltX.set(0);
      tiltY.set(0);
      packRef.current?.setPointerCapture(e.pointerId);
      if (!ripSoundPlayed.current) {
        onPlaySound("rip", 0.4);
        ripSoundPlayed.current = true;
      }
      const prog = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setProgress(prog);
      emitSparks(e.clientX);
    },
    [onPlaySound, emitSparks, tiltX, tiltY],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!rippingRef.current || completedRef.current) {
        handleMouseMove(e);
        return;
      }
      const rect = packRef.current?.getBoundingClientRect();
      if (!rect) return;
      const prog = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setProgress(prog);
      emitSparks(e.clientX);
      if (prog >= COMPLETE_THRESHOLD) triggerComplete();
    },
    [emitSparks, triggerComplete, handleMouseMove],
  );

  const handlePointerUp = useCallback(() => {
    if (completedRef.current) return;
    rippingRef.current = false;
    setProgress(0);
    ripSoundPlayed.current = false;
    lastEmitX.current = -1;
  }, []);

  useEffect(() => {
    const ref = animFrameRef;
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, []);

  // ─── Completed: top rips away ───
  if (completed) {
    return (
      <div ref={containerRef} className="relative flex flex-col items-center py-8">
        <div className="relative" style={{ width: PACK_W }}>
          <motion.div
            className="absolute top-0 left-0 w-full overflow-hidden pack-crimp-top"
            style={{ height: TEAR_Y, transformOrigin: "bottom center", background: FOIL_BG }}
            initial={{ rotateX: 0, y: 0, opacity: 1 }}
            animate={{ rotateX: -60, y: -200, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <PackFaceDesign cardCount={cardCount} offsetY={0} />
            <DepthOverlay />
            <FoilHighlight />
          </motion.div>

          <motion.div
            className="absolute left-0 right-0 h-[6px] rounded-full"
            style={{ top: TEAR_Y - 3, background: glowColor, boxShadow: `0 0 25px ${glowColor}, 0 0 50px ${glowColor}` }}
            initial={{ opacity: 1, scaleY: 1 }}
            animate={{ opacity: 0, scaleY: 5 }}
            transition={{ duration: 0.8 }}
          />

          <div
            className="absolute left-0 w-full overflow-hidden pack-crimp-bottom"
            style={{ top: TEAR_Y, height: PACK_H - TEAR_Y, background: FOIL_BG, boxShadow: packBodyShadow(true) }}
          >
            <PackFaceDesign cardCount={cardCount} offsetY={-TEAR_Y} />
            <DepthOverlay />
            <FoilHighlight />
            <SideEdges />
          </div>
        </div>
        <div style={{ height: PACK_H + 40 }} />
      </div>
    );
  }

  // ─── Active ripping ───
  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center py-8"
      style={{ perspective: 800 }}
      onPointerLeave={handleMouseLeave}
    >
      <motion.div
        ref={packRef}
        className="relative select-none touch-none cursor-crosshair"
        style={{
          width: PACK_W,
          height: PACK_H + gap,
          rotateX: springX,
          rotateY: springY,
          transformStyle: "preserve-3d",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="button"
        tabIndex={0}
        aria-label={`${boxName} — drag along the tear line to rip open`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); triggerComplete(); }
        }}
      >
        {/* ── Top half ── */}
        <div
          className="absolute top-0 left-0 w-full overflow-hidden pack-crimp-top"
          style={{
            height: TEAR_Y,
            background: FOIL_BG,
            transform: `rotateX(${topTiltDeg}deg)`,
            transformOrigin: "bottom center",
            transition: "transform 0.1s ease-out",
            boxShadow: packBodyShadow(false),
          }}
        >
          <PackFaceDesign cardCount={cardCount} offsetY={0} />
          <DepthOverlay />
          <FoilHighlight />
          <SideEdges />
        </div>

        {/* ── Tear line overlay ── */}
        <div className="absolute left-0 w-full pointer-events-none" style={{ top: TEAR_Y - 1 + gap / 2, height: 2, zIndex: 10 }}>
          {progress < 0.01 && (
            <motion.div
              className="absolute -translate-y-1/2 flex items-center"
              style={{ top: "50%" }}
              animate={{ left: ["5%", "85%", "5%"] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="text-pa-green text-sm font-bold drop-shadow-[0_0_8px_rgba(155,255,0,0.9)]">&#9654;</span>
            </motion.div>
          )}
          {progress < 0.01 && (
            <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(90deg, rgba(155,255,0,0.5) 0px, rgba(155,255,0,0.5) 8px, transparent 8px, transparent 14px)" }} />
          )}
          {progress > 0 && (
            <div className="absolute top-1/2 h-[4px] -translate-y-1/2 left-0 rounded-full" style={{
              width: `${progress * 100}%`,
              background: `linear-gradient(90deg, ${glowColor}80, ${glowColor})`,
              boxShadow: `0 0 10px ${glowColor}, 0 0 25px ${glowColor}80`,
            }} />
          )}
          {progress > 0.01 && (
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full" style={{
              left: `${progress * 100}%`,
              width: 14, height: 14,
              background: glowColor,
              boxShadow: `0 0 12px ${glowColor}, 0 0 24px ${glowColor}, 0 0 40px ${glowColor}80`,
            }} />
          )}
        </div>

        {/* ── Bottom half ── */}
        <div
          className="absolute left-0 w-full overflow-hidden pack-crimp-bottom"
          style={{
            top: TEAR_Y + gap,
            height: PACK_H - TEAR_Y,
            background: FOIL_BG,
            boxShadow: packBodyShadow(true),
          }}
        >
          <PackFaceDesign cardCount={cardCount} offsetY={-TEAR_Y} />
          <DepthOverlay />
          <FoilHighlight />
          <SideEdges />
        </div>
      </motion.div>
    </div>
  );
}
