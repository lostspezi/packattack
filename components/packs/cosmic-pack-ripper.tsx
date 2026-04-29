"use client";

import { useState, useRef, useCallback } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { Scissors } from "lucide-react";
import { GODPACK_THEME } from "@/lib/godpack-theme";
import type { ParticleCanvasHandle } from "./particle-canvas";

interface CosmicPackRipperProps {
  game: string;
  particleRef: React.RefObject<ParticleCanvasHandle | null>;
  onRipComplete: () => void;
  onPlaySound: (key: string, volume?: number) => void;
}

const PACK_W = 240;
const PACK_H = 350;
const TEAR_Y = 105;
const TEAR_ZONE = 60;
const COMPLETE_THRESHOLD = 0.9;

const COSMIC_BG = GODPACK_THEME.bgGradient;
const COSMIC_RIP_COLORS = GODPACK_THEME.burstColors;
const COSMIC_GLOW = GODPACK_THEME.glowGold;

function packBodyShadow(isBottom = false) {
  return isBottom
    ? "0 18px 50px rgba(0,0,0,0.7), 0 8px 20px rgba(120,40,180,0.3), 0 0 60px rgba(255,200,80,0.18), inset 0 1px 0 rgba(255,255,255,0.08)"
    : "0 -4px 24px rgba(0,0,0,0.4), 0 0 50px rgba(255,200,80,0.15), inset 0 -1px 0 rgba(255,255,255,0.08)";
}

/** Gold-Trim Border um den Pack — Premium-Akzent. */
function GoldTrim() {
  return (
    <div
      className="absolute pointer-events-none rounded-md"
      style={{
        top: 6,
        left: 6,
        right: 6,
        bottom: 6,
        border: "1.5px solid rgba(255, 215, 95, 0.35)",
        boxShadow: "inset 0 0 18px rgba(255, 200, 80, 0.18)",
      }}
    />
  );
}

/** Holographische Reflexion — wandert subtil über den Pack. */
function HologramSheen() {
  return (
    <motion.div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        background: GODPACK_THEME.hologramSheen,
        mixBlendMode: "screen",
      }}
      animate={{ x: ["-30%", "30%", "-30%"] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/** Tiefenschein — leicht gewölbter 3D-Effekt. */
function DepthOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          "radial-gradient(ellipse 70% 50% at 45% 35%, rgba(255,255,255,0.10) 0%, transparent 55%), " +
          "radial-gradient(ellipse 90% 90% at 50% 60%, transparent 35%, rgba(0,0,0,0.45) 100%)",
      }}
    />
  );
}

function SideEdges() {
  return (
    <>
      <div
        className="absolute top-0 left-0 w-[3px] h-full pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, rgba(255,215,95,0.18), rgba(255,215,95,0.04), transparent)",
        }}
      />
      <div
        className="absolute top-0 right-0 w-[3px] h-full pointer-events-none"
        style={{
          background:
            "linear-gradient(to left, rgba(255,215,95,0.18), rgba(255,215,95,0.04), transparent)",
        }}
      />
    </>
  );
}

/** Sterne im Hintergrund-Pattern. */
function CosmicStars() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 18 }).map((_, i) => {
        const left = ((i * 89 + 7) % 100);
        const top = ((i * 41 + 13) % 100);
        const size = (i % 3) + 1;
        return (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              background: i % 2 === 0 ? "rgba(255, 240, 180, 0.85)" : "rgba(255, 255, 255, 0.7)",
              boxShadow: `0 0 ${size * 3}px rgba(255, 230, 150, 0.6)`,
            }}
            animate={{ opacity: [0.3, 1, 0.4], scale: [0.8, 1.3, 0.9] }}
            transition={{ duration: 2 + (i % 4) * 0.4, repeat: Infinity, delay: i * 0.13 }}
          />
        );
      })}
    </div>
  );
}

/** Cosmic Pack-Face: GODPACK-Branding + Game-Tag + premium Pattern. */
function CosmicPackFace({ game, offsetY = 0 }: { game: string; offsetY?: number }) {
  return (
    <div
      className="absolute left-0 w-full pointer-events-none"
      style={{ top: offsetY, height: PACK_H }}
    >
      {/* Diagonale Lichtlinien */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            repeating-linear-gradient(135deg, transparent, transparent 22px, ${GODPACK_THEME.patternGold} 22px, ${GODPACK_THEME.patternGold} 23px),
            repeating-linear-gradient(45deg, transparent, transparent 30px, ${GODPACK_THEME.patternRed} 30px, ${GODPACK_THEME.patternRed} 31px)
          `,
        }}
      />

      <CosmicStars />

      {/* Eckige Klammern in Gold */}
      <svg className="absolute top-[14px] left-[10px] w-[34px] h-[34px]" viewBox="0 0 34 34" fill="none">
        <path d="M0 28 L0 7 L7 0 L28 0" stroke="rgba(255,215,95,0.45)" strokeWidth="1.4" />
      </svg>
      <svg className="absolute top-[14px] right-[10px] w-[34px] h-[34px]" viewBox="0 0 34 34" fill="none">
        <path d="M34 28 L34 7 L27 0 L6 0" stroke="rgba(255,215,95,0.45)" strokeWidth="1.4" />
      </svg>
      <svg className="absolute bottom-[14px] left-[10px] w-[34px] h-[34px]" viewBox="0 0 34 34" fill="none">
        <path d="M0 6 L0 27 L7 34 L28 34" stroke="rgba(255,215,95,0.45)" strokeWidth="1.4" />
      </svg>
      <svg className="absolute bottom-[14px] right-[10px] w-[34px] h-[34px]" viewBox="0 0 34 34" fill="none">
        <path d="M34 6 L34 27 L27 34 L6 34" stroke="rgba(255,215,95,0.45)" strokeWidth="1.4" />
      </svg>

      {/* Top-Tag „× GAME" */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
        style={{ top: 26, zIndex: 2 }}
      >
        <div
          className="flex items-center justify-center px-3 h-6 rounded-full"
          style={{
            border: "1px solid rgba(255,215,95,0.45)",
            background: "rgba(255, 215, 95, 0.08)",
          }}
        >
          <span
            className="text-[9px] font-bold uppercase tracking-[3px] leading-none block"
            style={{ color: "rgba(255, 230, 150, 0.85)" }}
          >
            × {game}
          </span>
        </div>
      </div>

      {/* Strahlen-Halo hinter Logo */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: 110,
          width: 200,
          height: 130,
          background:
            "radial-gradient(ellipse at center, rgba(255, 215, 95, 0.28) 0%, rgba(255, 100, 70, 0.14) 40%, transparent 75%)",
        }}
      />

      {/* GODPACK-Headline */}
      <div
        className="absolute left-0 right-0 flex justify-center"
        style={{ top: 130, zIndex: 3 }}
      >
        <span
          className="text-[34px] font-black tracking-tight"
          style={{
            color: "#fffbe1",
            WebkitTextStroke: "1.5px rgba(120, 60, 0, 0.7)",
            fontFamily: "'Impact', 'Arial Black', sans-serif",
            filter:
              "drop-shadow(0 0 10px rgba(255, 215, 95, 0.95)) drop-shadow(0 4px 0 rgba(180, 95, 15, 0.55))",
            letterSpacing: "-0.02em",
          }}
        >
          GODPACK
        </span>
      </div>

      {/* Untere Linie */}
      <div
        className="absolute left-[18px] right-[18px] h-[1px]"
        style={{
          top: 178,
          background:
            "linear-gradient(90deg, transparent, rgba(255,215,95,0.45), transparent)",
        }}
      />

      {/* "5 LEGENDÄRE KARTEN" */}
      <div
        className="absolute left-0 right-0 flex justify-center"
        style={{ top: 188, zIndex: 2 }}
      >
        <span
          className="text-[8px] font-bold uppercase tracking-[5px]"
          style={{ color: "rgba(255, 230, 150, 0.75)" }}
        >
          5 Legendäre Karten
        </span>
      </div>

      {/* Stern-Akzent unten */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2"
        style={{ bottom: 56, zIndex: 1 }}
      >
        <span style={{ color: "rgba(255, 215, 95, 0.4)" }}>★</span>
        <span
          className="text-[20px] font-black"
          style={{
            color: "transparent",
            WebkitTextStroke: "1px rgba(255,215,95,0.32)",
            letterSpacing: "8px",
            fontFamily: "'Impact', 'Arial Black', sans-serif",
          }}
        >
          GP
        </span>
        <span style={{ color: "rgba(255, 215, 95, 0.4)" }}>★</span>
      </div>

      {/* PACKATTACK-Tag */}
      <div
        className="absolute left-0 right-0 flex justify-center"
        style={{ bottom: 26, zIndex: 2 }}
      >
        <span
          className="text-[7px] uppercase tracking-[3px] font-bold"
          style={{ color: "rgba(255, 215, 95, 0.55)" }}
        >
          PACKATTACK · GODPACK
        </span>
      </div>
    </div>
  );
}

export function CosmicPackRipper({
  game,
  particleRef,
  onRipComplete,
  onPlaySound,
}: CosmicPackRipperProps) {
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const packRef = useRef<HTMLDivElement>(null);
  const rippingRef = useRef(false);
  const completedRef = useRef(false);
  const ripSoundPlayed = useRef(false);
  const lastEmitX = useRef(-1);

  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const springX = useSpring(tiltX, { stiffness: 120, damping: 18 });
  const springY = useSpring(tiltY, { stiffness: 120, damping: 18 });

  const gap = progress * 14;
  const topTiltDeg = progress * -5;

  const handleMouseMove = useCallback(
    (e: React.PointerEvent) => {
      if (rippingRef.current) return;
      const rect = packRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const x = (e.clientY - cy) / (rect.height / 2);
      const y = (e.clientX - cx) / (rect.width / 2);
      tiltX.set(x * -12);
      tiltY.set(y * 12);
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
    onPlaySound("godpackBoom", 0.85);
    onPlaySound("burst", 0.6);
    if (navigator.vibrate) navigator.vibrate([60, 40, 120, 30, 80]);
    const packRect = packRef.current?.getBoundingClientRect();
    if (packRect && particleRef.current) {
      // Großer Goldener Burst aus dem Riss
      particleRef.current.emit({
        x: packRect.left + PACK_W / 2,
        y: packRect.top + TEAR_Y,
        count: 80,
        colors: COSMIC_RIP_COLORS,
        speed: [180, 480],
        size: [4, 11],
        lifetime: [800, 1700],
        gravity: 60,
        spread: Math.PI * 1.3,
        shape: "circle",
      });
      // Aufwärts-Strahlen
      particleRef.current.emit({
        x: packRect.left + PACK_W / 2,
        y: packRect.top + TEAR_Y,
        count: 30,
        colors: ["#FFFFFF", "#FFEC8B"],
        speed: [220, 520],
        size: [2, 6],
        lifetime: [500, 1100],
        gravity: -40,
        spread: Math.PI * 0.4,
        shape: "circle",
      });
    }
    setTimeout(() => onRipComplete(), 1100);
  }, [onPlaySound, onRipComplete, particleRef]);

  const emitSparks = useCallback(
    (clientX: number) => {
      const packRect = packRef.current?.getBoundingClientRect();
      if (!packRect || !particleRef.current) return;
      const relX = clientX - packRect.left;
      if (Math.abs(relX - lastEmitX.current) < 14) return;
      lastEmitX.current = relX;
      particleRef.current.emit({
        x: packRect.left + relX,
        y: packRect.top + TEAR_Y,
        count: 4,
        colors: COSMIC_RIP_COLORS,
        speed: [60, 180],
        size: [2, 5],
        lifetime: [300, 800],
        gravity: 40,
        spread: Math.PI * 0.85,
        shape: "circle",
      });
    },
    [particleRef],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (completedRef.current) return;
      const rect = packRef.current?.getBoundingClientRect();
      if (!rect) return;
      const relY = e.clientY - rect.top;
      if (Math.abs(relY - TEAR_Y) > TEAR_ZONE) return;
      rippingRef.current = true;
      setShowHint(false);
      tiltX.set(0);
      tiltY.set(0);
      packRef.current?.setPointerCapture(e.pointerId);
      if (!ripSoundPlayed.current) {
        onPlaySound("rip", 0.5);
        onPlaySound("godpackSparkle", 0.4);
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

  // Halo hinter dem Pack — atmender goldener Glow
  const haloOpacity = completed ? 0 : 1;

  if (completed) {
    return (
      <div ref={containerRef} className="relative flex flex-col items-center py-8">
        <div className="relative" style={{ width: PACK_W }}>
          <motion.div
            className="absolute top-0 left-0 w-full overflow-hidden pack-crimp-top"
            style={{
              height: TEAR_Y,
              transformOrigin: "bottom center",
              background: COSMIC_BG,
              borderRadius: 8,
            }}
            initial={{ rotateX: 0, y: 0, opacity: 1 }}
            animate={{ rotateX: -75, y: -240, opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <CosmicPackFace game={game} offsetY={0} />
            <DepthOverlay />
            <HologramSheen />
            <GoldTrim />
          </motion.div>

          <motion.div
            className="absolute left-0 right-0 h-[8px] rounded-full"
            style={{
              top: TEAR_Y - 4,
              background: COSMIC_GLOW,
              boxShadow: `0 0 30px ${COSMIC_GLOW}, 0 0 60px ${COSMIC_GLOW}, 0 0 100px rgba(255, 200, 80, 0.5)`,
            }}
            initial={{ opacity: 1, scaleY: 1 }}
            animate={{ opacity: 0, scaleY: 6 }}
            transition={{ duration: 0.9 }}
          />

          <div
            className="absolute left-0 w-full overflow-hidden pack-crimp-bottom"
            style={{
              top: TEAR_Y,
              height: PACK_H - TEAR_Y,
              background: COSMIC_BG,
              boxShadow: packBodyShadow(true),
              borderRadius: 8,
            }}
          >
            <CosmicPackFace game={game} offsetY={-TEAR_Y} />
            <DepthOverlay />
            <HologramSheen />
            <GoldTrim />
            <SideEdges />
          </div>
        </div>
        <div style={{ height: PACK_H + 40 }} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center py-8"
      style={{ perspective: 900 }}
      onPointerLeave={handleMouseLeave}
    >
      {/* Großer goldener Halo hinter dem Pack — atmend */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          width: PACK_W * 2.6,
          height: PACK_H * 1.7,
          top: -40,
          left: "50%",
          transform: "translateX(-50%)",
          borderRadius: "50%",
          background: GODPACK_THEME.packHaloGradient,
          filter: "blur(28px)",
          opacity: haloOpacity,
        }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      />

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
        aria-label={`Cosmic Godpack — drag along the tear line to rip open`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            triggerComplete();
          }
        }}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Top-Hälfte */}
        <div
          className="absolute top-0 left-0 w-full overflow-hidden pack-crimp-top"
          style={{
            height: TEAR_Y,
            background: COSMIC_BG,
            transform: `rotateX(${topTiltDeg}deg)`,
            transformOrigin: "bottom center",
            transition: "transform 0.1s ease-out",
            boxShadow: packBodyShadow(false),
            borderRadius: 8,
          }}
        >
          <CosmicPackFace game={game} offsetY={0} />
          <DepthOverlay />
          <HologramSheen />
          <GoldTrim />
          <SideEdges />
        </div>

        {/* Tear-Line Overlay */}
        <div
          className="absolute left-0 w-full pointer-events-none"
          style={{ top: TEAR_Y - 1 + gap / 2, height: 2, zIndex: 10 }}
        >
          {progress < 0.01 && (
            <motion.div
              className="absolute -translate-y-1/2 flex items-center"
              style={{ top: "50%" }}
              animate={{ left: ["5%", "85%", "5%"] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Scissors
                className="w-4 h-4 rotate-0"
                style={{
                  color: COSMIC_GLOW,
                  filter: `drop-shadow(0 0 8px ${COSMIC_GLOW})`,
                }}
              />
            </motion.div>
          )}
          {progress < 0.01 && (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "repeating-linear-gradient(90deg, rgba(255,215,95,0.65) 0px, rgba(255,215,95,0.65) 8px, transparent 8px, transparent 14px)",
              }}
            />
          )}
          {progress > 0 && (
            <div
              className="absolute top-1/2 h-[5px] -translate-y-1/2 left-0 rounded-full"
              style={{
                width: `${progress * 100}%`,
                background: `linear-gradient(90deg, rgba(255,215,95,0.5), ${COSMIC_GLOW}, #fff)`,
                boxShadow: `0 0 14px ${COSMIC_GLOW}, 0 0 30px rgba(255,215,95,0.7)`,
              }}
            />
          )}
          {progress > 0.01 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full"
              style={{
                left: `${progress * 100}%`,
                width: 18,
                height: 18,
                background: COSMIC_GLOW,
                boxShadow: `0 0 18px ${COSMIC_GLOW}, 0 0 35px ${COSMIC_GLOW}, 0 0 60px rgba(255,200,80,0.6)`,
              }}
            />
          )}
        </div>

        {/* Bottom-Hälfte */}
        <div
          className="absolute left-0 w-full overflow-hidden pack-crimp-bottom"
          style={{
            top: TEAR_Y + gap,
            height: PACK_H - TEAR_Y,
            background: COSMIC_BG,
            boxShadow: packBodyShadow(true),
            borderRadius: 8,
          }}
        >
          <CosmicPackFace game={game} offsetY={-TEAR_Y} />
          <DepthOverlay />
          <HologramSheen />
          <GoldTrim />
          <SideEdges />
        </div>
      </motion.div>

      {/* Hint-Text unter dem Pack */}
      {showHint && (
        <motion.p
          className="mt-6 text-[10px] uppercase tracking-[5px] font-bold text-amber-300/85"
          style={{ textShadow: "0 0 10px rgba(255,200,80,0.5)" }}
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          ★ Reisse dein Godpack auf ★
        </motion.p>
      )}
    </div>
  );
}
