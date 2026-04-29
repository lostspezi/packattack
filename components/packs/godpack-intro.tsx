"use client";

import { useEffect, useRef, type RefObject } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { ParticleCanvasHandle } from "./particle-canvas";

interface GodpackIntroProps {
  game: string;
  lang: string;
  particleRef: RefObject<ParticleCanvasHandle | null>;
  onPlaySound: (key: string, volume?: number) => void;
  onIntroComplete: () => void;
}

const INTRO_DURATION_MS = 2600;
const TITLE_SHOW_AT_MS = 500;
const TITLE_HIDE_AT_MS = 1900;

/**
 * Pre-Reveal Build-up für Godpacks. Cosmic Galaxy-Stil: dunkler Nebula-
 * Hintergrund, Sternenfeld, ein leuchtender Schein in der Mitte und ein
 * kurzer Titel ("DU WURDEST AUSERWÄHLT × FRANCHISE"). Nach knapp 2.6s
 * passes der Build-up an das Pack-Ripping weiter — der ganze Moment
 * lebt vom Anticipation-Beat, deswegen kein Klick-Trigger.
 */
export function GodpackIntro({
  game,
  lang,
  particleRef,
  onPlaySound,
  onIntroComplete,
}: GodpackIntroProps) {
  const isDe = lang === "de";
  const completedRef = useRef(false);

  useEffect(() => {
    onPlaySound("epic", 0.7);

    // Sterne über den Particle-Canvas streuen — nutzt den existierenden
    // ParticleCanvas-Handle, falls verfügbar. Wenn die Komponente keinen
    // entsprechenden Helper hat, schadet der null-Aufruf nichts.
    const canvas = particleRef.current;
    if (canvas && typeof (canvas as unknown as { burst?: (x: number, y: number, opts?: unknown) => void }).burst === "function") {
      const burst = (canvas as unknown as { burst: (x: number, y: number, opts?: unknown) => void }).burst;
      const w = window.innerWidth;
      const h = window.innerHeight;
      for (let i = 0; i < 6; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h * 0.7;
        burst(x, y, { count: 8, color: "#fff8d6", spread: 80 });
      }
    }

    const timer = window.setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      onIntroComplete();
    }, INTRO_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [onPlaySound, onIntroComplete, particleRef]);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[400px]">
      {/* Cosmic Backdrop — radial Nebula */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(180, 80, 255, 0.35) 0%, rgba(60, 20, 120, 0.5) 30%, rgba(8, 4, 22, 0.85) 65%, rgba(0,0,0,0.95) 100%)",
        }}
      />

      {/* Pulsierender Stern-Halo */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          width: 480,
          height: 480,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255, 230, 130, 0.45) 0%, rgba(255, 180, 60, 0.18) 30%, transparent 70%)",
          filter: "blur(12px)",
        }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [0.6, 1.05, 0.95, 1.0], opacity: [0, 0.9, 0.7, 0.85] }}
        transition={{ duration: INTRO_DURATION_MS / 1000, ease: "easeOut" }}
      />

      {/* Goldene Sternenstrahlen */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          width: 600,
          height: 600,
        }}
        initial={{ rotate: 0, opacity: 0 }}
        animate={{ rotate: 360, opacity: [0, 0.6, 0.4, 0.7] }}
        transition={{
          rotate: { duration: 6, ease: "linear", repeat: Infinity },
          opacity: { duration: INTRO_DURATION_MS / 1000 },
        }}
      >
        <svg viewBox="0 0 600 600" className="w-full h-full">
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 360) / 12;
            return (
              <line
                key={i}
                x1="300"
                y1="300"
                x2="300"
                y2="20"
                stroke="rgba(255, 220, 120, 0.35)"
                strokeWidth={2}
                transform={`rotate(${angle} 300 300)`}
              />
            );
          })}
        </svg>
      </motion.div>

      {/* Titel-Sequenz */}
      <AnimatePresence>
        <TitleSequence isDe={isDe} game={game} key="title" />
      </AnimatePresence>
    </div>
  );
}

function TitleSequence({ isDe, game }: { isDe: boolean; game: string }) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-3 text-center">
      <motion.span
        className="text-[10px] sm:text-xs uppercase tracking-[6px] text-amber-200/80"
        initial={{ opacity: 0, y: 14 }}
        animate={{
          opacity: [0, 1, 1, 0],
          y: [14, 0, 0, -10],
        }}
        transition={{
          duration: (TITLE_HIDE_AT_MS - TITLE_SHOW_AT_MS) / 1000 + 0.3,
          times: [0, 0.18, 0.85, 1],
          delay: TITLE_SHOW_AT_MS / 1000,
        }}
      >
        PACKATTACK
      </motion.span>
      <motion.h2
        className="text-3xl sm:text-5xl font-black tracking-wide text-white drop-shadow-[0_0_18px_rgba(255,210,110,0.55)]"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: [0, 1, 1, 0],
          scale: [0.8, 1.04, 1, 0.96],
        }}
        transition={{
          duration: (TITLE_HIDE_AT_MS - TITLE_SHOW_AT_MS) / 1000 + 0.3,
          times: [0, 0.2, 0.8, 1],
          delay: TITLE_SHOW_AT_MS / 1000,
          ease: "easeOut",
        }}
      >
        {isDe ? "DU WURDEST AUSERWÄHLT" : "YOU WERE CHOSEN"}
      </motion.h2>
      <motion.span
        className="text-sm sm:text-base font-semibold uppercase tracking-[3px] text-amber-300"
        initial={{ opacity: 0, y: 8 }}
        animate={{
          opacity: [0, 1, 1, 0],
          y: [8, 0, 0, -6],
        }}
        transition={{
          duration: (TITLE_HIDE_AT_MS - TITLE_SHOW_AT_MS) / 1000 + 0.3,
          times: [0, 0.25, 0.85, 1],
          delay: (TITLE_SHOW_AT_MS + 200) / 1000,
        }}
      >
        × {game.toUpperCase()} GODPACK
      </motion.span>
    </div>
  );
}
