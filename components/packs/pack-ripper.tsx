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

const PACK_W = 210;
const PACK_H = 310;
const TEAR_Y = 95; // where the tear sits — between crimp area and main artwork
const TEAR_ZONE = 55;
const COMPLETE_THRESHOLD = 0.9;
const CRIMP_H = 14; // height of crimped edge

// Shared foil wrapper background
const FOIL_BG = "linear-gradient(160deg, #1a0e35 0%, #2a1850 15%, #1d0f3a 30%, #24043A 50%, #1a0e35 70%, #2a1850 85%, #1d0f3a 100%)";

// Shared pack body styles for the 3D puffy look
function packBodyShadow(isBottom = false) {
  return isBottom
    ? "0 12px 40px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)"
    : "0 -4px 20px rgba(0,0,0,0.3), inset 0 -1px 0 rgba(255,255,255,0.05)";
}

/** The 3D depth overlay — radial highlight in center, dark edges = puffy look */
function DepthOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: "radial-gradient(ellipse 70% 60% at 40% 40%, rgba(255,255,255,0.06) 0%, transparent 60%), radial-gradient(ellipse 80% 80% at 50% 50%, transparent 50%, rgba(0,0,0,0.25) 100%)",
      }}
    />
  );
}

/** Foil shimmer overlay */
function FoilShimmer() {
  return <div className="absolute inset-0 animate-foil-shimmer pointer-events-none" />;
}

/** Side edge highlights — simulates sealed foil edges */
function SideEdges() {
  return (
    <>
      <div
        className="absolute top-0 left-0 w-[3px] h-full pointer-events-none"
        style={{ background: "linear-gradient(to right, rgba(255,255,255,0.08), transparent)" }}
      />
      <div
        className="absolute top-0 right-0 w-[3px] h-full pointer-events-none"
        style={{ background: "linear-gradient(to left, rgba(255,255,255,0.08), transparent)" }}
      />
    </>
  );
}

/** Card-back artwork centered in the pack with foil frame */
function PackArtwork({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute pointer-events-none ${className}`} style={{ top: CRIMP_H + 16, left: 14, right: 14, bottom: CRIMP_H + 16 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/card-back.jpg"
        alt=""
        draggable={false}
        className="w-full h-full object-cover rounded-lg"
        style={{ border: "2px solid rgba(155,255,0,0.15)" }}
      />
    </div>
  );
}

/** Branding text at top and bottom of pack */
function PackBranding({ section }: { section: "top" | "bottom" }) {
  if (section === "top") {
    return (
      <div className="absolute top-[16px] left-0 right-0 flex justify-center pointer-events-none" style={{ zIndex: 5 }}>
        <span
          className="text-[8px] font-bold uppercase tracking-[3px] text-pa-green/40"
          style={{ textShadow: "0 0 8px rgba(155,255,0,0.2)" }}
        >
          5 Cards
        </span>
      </div>
    );
  }
  return (
    <div className="absolute bottom-[14px] left-0 right-0 flex justify-center pointer-events-none" style={{ zIndex: 5 }}>
      <span
        className="text-[10px] font-black uppercase tracking-[4px] text-pa-green/50"
        style={{ textShadow: "0 0 10px rgba(155,255,0,0.3)" }}
      >
        Pack Attack
      </span>
    </div>
  );
}

export function PackRipper({
  boxName,
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

  const tierColors = TIER_CONFIGS[maxTier].colors;
  const glowColor = tierColors[0];

  const gap = progress * 12;
  const topTiltDeg = progress * -4;

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
      const ox = packRect.left - containerRect.left;
      const oy = packRect.top - containerRect.top + TEAR_Y;
      particleRef.current.emit({
        x: ox + PACK_W / 2, y: oy,
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
      packRef.current?.setPointerCapture(e.pointerId);
      if (!ripSoundPlayed.current) {
        onPlaySound("rip", 0.4);
        ripSoundPlayed.current = true;
      }
      const prog = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
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
      const prog = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setProgress(prog);
      emitSparks(e.clientX);
      if (prog >= COMPLETE_THRESHOLD) triggerComplete();
    },
    [emitSparks, triggerComplete],
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
          {/* Top half flies away */}
          <motion.div
            className="absolute top-0 left-0 w-full overflow-hidden pack-crimp-top"
            style={{ height: TEAR_Y, transformOrigin: "bottom center", background: FOIL_BG }}
            initial={{ rotateX: 0, y: 0, opacity: 1 }}
            animate={{ rotateX: -60, y: -200, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <DepthOverlay />
            <FoilShimmer />
          </motion.div>

          {/* Glow burst */}
          <motion.div
            className="absolute left-0 right-0 h-[6px] rounded-full"
            style={{ top: TEAR_Y - 3, background: glowColor, boxShadow: `0 0 25px ${glowColor}, 0 0 50px ${glowColor}` }}
            initial={{ opacity: 1, scaleY: 1 }}
            animate={{ opacity: 0, scaleY: 5 }}
            transition={{ duration: 0.8 }}
          />

          {/* Bottom half stays */}
          <div
            className="absolute left-0 w-full overflow-hidden pack-crimp-bottom"
            style={{ top: TEAR_Y, height: PACK_H - TEAR_Y, background: FOIL_BG, boxShadow: packBodyShadow(true) }}
          >
            <PackArtwork className="!top-[8px]" />
            <PackBranding section="bottom" />
            <DepthOverlay />
            <FoilShimmer />
            <SideEdges />
          </div>
        </div>
        <div style={{ height: PACK_H + 40 }} />
      </div>
    );
  }

  // ─── Active ripping ───
  return (
    <div ref={containerRef} className="relative flex flex-col items-center py-8">
      <div
        ref={packRef}
        className="relative select-none touch-none cursor-crosshair"
        style={{ width: PACK_W, height: PACK_H + gap, perspective: 800 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="button"
        tabIndex={0}
        aria-label="Drag along the tear line to rip open the pack"
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
          {/* Pack artwork positioned so it aligns across both halves */}
          <div className="absolute pointer-events-none" style={{ top: CRIMP_H + 16, left: 14, right: 14, height: PACK_H - (CRIMP_H + 16) * 2 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/card-back.jpg"
              alt=""
              draggable={false}
              className="w-full object-cover rounded-lg absolute top-0 left-0"
              style={{ height: "100%", border: "2px solid rgba(155,255,0,0.15)" }}
            />
          </div>
          <PackBranding section="top" />
          <DepthOverlay />
          <FoilShimmer />
          <SideEdges />
        </div>

        {/* ── Tear line overlay ── */}
        <div
          className="absolute left-0 w-full pointer-events-none"
          style={{ top: TEAR_Y - 1 + gap / 2, height: 2, zIndex: 10 }}
        >
          {/* Animated arrow hint */}
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

          {/* Dashed tear line */}
          {progress < 0.01 && (
            <div
              className="absolute inset-0"
              style={{
                background: "repeating-linear-gradient(90deg, rgba(155,255,0,0.5) 0px, rgba(155,255,0,0.5) 8px, transparent 8px, transparent 14px)",
              }}
            />
          )}

          {/* Rip glow */}
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

          {/* Rip cursor dot */}
          {progress > 0.01 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full"
              style={{
                left: `${progress * 100}%`,
                width: 14, height: 14,
                background: glowColor,
                boxShadow: `0 0 12px ${glowColor}, 0 0 24px ${glowColor}, 0 0 40px ${glowColor}80`,
              }}
            />
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
          {/* Pack artwork — offset to align with top half */}
          <div className="absolute pointer-events-none" style={{ top: -(TEAR_Y - CRIMP_H - 16), left: 14, right: 14, height: PACK_H - (CRIMP_H + 16) * 2 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/card-back.jpg"
              alt={boxName}
              draggable={false}
              className="w-full object-cover rounded-lg absolute top-0 left-0"
              style={{ height: "100%", border: "2px solid rgba(155,255,0,0.15)" }}
            />
          </div>
          <PackBranding section="bottom" />
          <DepthOverlay />
          <FoilShimmer />
          <SideEdges />
        </div>
      </div>
    </div>
  );
}
