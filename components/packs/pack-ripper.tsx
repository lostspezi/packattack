"use client";

import { useState, useRef, useCallback } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import type { EffectTier } from "./effect-tiers";
import { TIER_CONFIGS } from "./effect-tiers";
import type { ParticleCanvasHandle } from "./particle-canvas";

interface PackRipperProps {
  boxName: string;
  boxImage: string | null;
  maxTier: EffectTier;
  particleRef: React.RefObject<ParticleCanvasHandle | null>;
  onRipComplete: () => void;
  onPlaySound: (key: "rip" | "burst", volume?: number) => void;
}

const AUTO_COMPLETE_THRESHOLD = 0.7;
const SWIPE_RANGE = 200;

export function PackRipper({ boxName, boxImage, maxTier, particleRef, onRipComplete, onPlaySound }: PackRipperProps) {
  const [completed, setCompleted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const ripSoundPlayed = useRef(false);
  const dragY = useMotionValue(0);
  const progress = useTransform(dragY, [0, -SWIPE_RANGE], [0, 1]);
  const topY = useTransform(progress, [0, 0.7, 1], [0, -40, -200]);
  const topRotate = useTransform(progress, [0, 0.7, 1], [0, -5, -25]);
  const topOpacity = useTransform(progress, [0.7, 1], [1, 0]);
  const glowOpacity = useTransform(progress, [0, 0.5, 0.7], [0, 0.5, 1]);
  const glowScale = useTransform(progress, [0, 0.7], [0.5, 1.5]);

  const handlePanStart = useCallback(() => {
    if (!ripSoundPlayed.current) {
      onPlaySound("rip", 0.4);
      ripSoundPlayed.current = true;
    }
  }, [onPlaySound]);

  const triggerComplete = useCallback(() => {
    setCompleted(true);
    onPlaySound("burst", 0.7);
    if (navigator.vibrate) navigator.vibrate([50, 30, 100]);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && particleRef.current) {
      const tierColors = TIER_CONFIGS[maxTier].colors;
      particleRef.current.emit({
        x: rect.width / 2, y: rect.height * 0.35,
        count: 25, colors: tierColors, speed: [100, 250], size: [3, 7],
        lifetime: [600, 1200], gravity: 80, spread: Math.PI, shape: "circle",
      });
    }
    setTimeout(() => onRipComplete(), 800);
  }, [maxTier, onPlaySound, onRipComplete, particleRef]);

  const handlePan = useCallback(
    (_: PointerEvent, info: PanInfo) => {
      const clamped = Math.min(0, Math.max(-SWIPE_RANGE, info.offset.y));
      dragY.set(clamped);
      const prog = Math.abs(clamped) / SWIPE_RANGE;
      if (prog >= AUTO_COMPLETE_THRESHOLD && !completed) triggerComplete();
    },
    [completed, dragY, triggerComplete],
  );

  const handlePanEnd = useCallback(() => {
    const prog = Math.abs(dragY.get()) / SWIPE_RANGE;
    if (prog < AUTO_COMPLETE_THRESHOLD) {
      dragY.set(0);
      ripSoundPlayed.current = false;
    }
  }, [dragY]);

  if (completed) {
    return (
      <div ref={containerRef} className="relative flex flex-col items-center gap-0 py-8">
        <motion.div
          className="w-[200px] h-[80px] rounded-t-2xl border-2 border-pa-green/50 border-b-0"
          style={{ background: "linear-gradient(145deg, #2a1f4e, #1a0f3e)" }}
          initial={{ y: -40, rotateX: -5, opacity: 1 }}
          animate={{ y: -250, rotateX: -35, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
        <motion.div
          className="w-[220px] h-3 rounded-full"
          style={{ background: TIER_CONFIGS[maxTier].colors[0] }}
          initial={{ opacity: 1, scaleX: 1.5 }}
          animate={{ opacity: 0, scaleX: 3 }}
          transition={{ duration: 0.8 }}
        />
        <div
          className="w-[200px] h-[200px] rounded-b-2xl border-2 border-pa-green/50 border-t-0 flex items-center justify-center"
          style={{ background: "linear-gradient(145deg, #2a1f4e, #1a0f3e)", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}
        >
          <motion.div
            className="w-[70px] h-[98px] rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex flex-col items-center py-8">
      <motion.div className="relative cursor-grab active:cursor-grabbing touch-none" onPanStart={handlePanStart} onPan={handlePan} onPanEnd={handlePanEnd}>
        <motion.div
          className="w-[200px] h-[80px] rounded-t-2xl border-2 border-pa-green/50 border-b-0 relative overflow-hidden"
          style={{ background: "linear-gradient(145deg, #2a1f4e, #1a0f3e)", y: topY, rotateX: topRotate, opacity: topOpacity }}
        >
          <div className="absolute inset-0 animate-holo-shimmer pointer-events-none" />
        </motion.div>
        <motion.div
          className="w-[220px] h-2 rounded-full mx-auto"
          style={{ background: "#9BFF00", boxShadow: "0 0 30px #9BFF00, 0 0 60px rgba(155,255,0,0.5)", opacity: glowOpacity, scaleX: glowScale }}
        />
        <div
          className="w-[200px] h-[200px] rounded-b-2xl border-2 border-pa-green/50 border-t-0 flex items-center justify-center"
          style={{ background: "linear-gradient(145deg, #2a1f4e, #1a0f3e)", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}
        >
          {boxImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={boxImage} alt={boxName} className="w-[100px] h-auto rounded-lg opacity-60" />
          ) : (
            <span className="text-2xl font-black text-pa-green/40">PA</span>
          )}
        </div>
      </motion.div>
      <motion.p
        className="mt-6 text-[11px] text-pa-green/60 uppercase tracking-[2px]"
        animate={{ opacity: [0.4, 1] }}
        transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
      >
        &#8593; Swipe up to rip open
      </motion.p>
    </div>
  );
}
