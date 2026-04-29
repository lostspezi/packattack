"use client";

import { useEffect, useRef, type RefObject } from "react";
import { motion } from "motion/react";
import { formatGameLabel } from "@/lib/format-game";
import type { ParticleCanvasHandle } from "./particle-canvas";

interface GodpackIntroProps {
  game: string;
  lang: string;
  particleRef: RefObject<ParticleCanvasHandle | null>;
  onPlaySound: (key: string, volume?: number) => void;
  onIntroComplete: () => void;
}

/**
 * Timing-Beats des Build-ups. Jeder Beat hat einen klaren emotionalen Zweck:
 *
 *  0-700ms     Tension: schwarzer Backdrop, ein winziger Punkt pulsiert.
 *              Der User wartet, weiß noch nicht was passiert. Tiefer Drone.
 *  700-900ms   BOOM: Weißer Mega-Flash + Goldener Particle-Burst + Camera-
 *              Shake + lauter Hit-Sound.
 *  900-1700ms  Letter-by-Letter Bounce der GODPACK-Buchstaben mit ~110ms
 *              Stagger. Jeder Buchstabe knallt mit overshoot rein.
 *  1700-3700ms HOLD: GODPACK steht groß und strahlend in der Mitte, der
 *              Schriftzug shimmert, „DU HAST ES GESCHAFFT!" + Game-Tag
 *              kommen darunter rein, Confetti-Wellen, Goldstrahlen rotieren.
 *              Dieser Beat ist absichtlich lang — der User soll seinen
 *              Triumph sehen, lesen, fühlen.
 *  3700-4600ms Smooth Fade-out, Sound „chime", Übergang zum Ripping.
 */
const T = {
  total: 6200,
  flashAt: 700,
  burstAt: 720,
  rayStart: 750,
  letterStart: 900,
  letterStagger: 130,
  sublineIn: 2100,
  confetti1: 1800,
  confetti2: 2900,
  confetti3: 4000,
  confetti4: 4900,
  fadeOutStart: 5500,
} as const;

const GODPACK_LETTERS = ["G", "O", "D", "P", "A", "C", "K"];

const CONFETTI_RAINBOW = [
  "#FFD700", // gold
  "#FFEC8B", // light gold
  "#FFA500", // orange
  "#FF6B6B", // coral
  "#FF6BCB", // pink
  "#9B59FF", // violet
  "#4ECDC4", // mint
  "#FFFFFF", // white
];

export function GodpackIntro({
  game,
  lang,
  particleRef,
  onPlaySound,
  onIntroComplete,
}: GodpackIntroProps) {
  const isDe = lang === "de";
  const completedRef = useRef(false);
  const gameLabel = formatGameLabel(game).toUpperCase();

  useEffect(() => {
    const timers: number[] = [];
    const schedule = (at: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, at));
    };

    // Sound-Layer — gestapelt für maximalen Impact. Wir schießen sowohl die
    // dedizierten Godpack-Slots ALS AUCH die existing Keys, damit die Sequenz
    // auch dann nach was klingt, wenn die Godpack-Files noch nicht in
    // /public/sounds/ liegen. Sobald die richtigen Files installiert sind,
    // dominieren sie den Mix automatisch — die existing Keys bleiben als
    // weicher Layer drunter.
    const cue = (at: number, primary: string, secondary: string, vol: number) => {
      schedule(at, () => onPlaySound(primary, vol));
      schedule(at, () => onPlaySound(secondary, vol * 0.55));
    };

    cue(0, "godpackBuildup", "epic", 0.55);
    cue(T.flashAt, "godpackBoom", "burst", 1.0);
    schedule(T.flashAt + 90, () => onPlaySound("legendary", 0.85));
    cue(T.confetti1, "godpackFanfare", "rain", 0.75);
    cue(T.confetti2 + 200, "godpackSparkle", "shimmer", 0.7);
    schedule(T.confetti3, () => onPlaySound("chime", 0.6));
    schedule(T.fadeOutStart - 100, () => onPlaySound("chime", 0.85));

    // Particle-Choreografie
    const cx = () => window.innerWidth / 2;
    const cy = () => window.innerHeight / 2;

    schedule(T.burstAt, () => {
      const canvas = particleRef.current;
      if (!canvas) return;
      // Goldene Mega-Explosion
      canvas.emit({
        x: cx(),
        y: cy(),
        count: 90,
        colors: ["#FFD700", "#FFA500", "#FFEC8B", "#FFFFFF"],
        speed: [380, 820],
        size: [4, 12],
        lifetime: [900, 1700],
        gravity: 80,
        spread: Math.PI * 2,
        shape: "circle",
      });
      // Innere weiße Spitze
      canvas.emit({
        x: cx(),
        y: cy(),
        count: 30,
        colors: ["#FFFFFF", "#fff7c2"],
        speed: [120, 320],
        size: [2, 6],
        lifetime: [400, 900],
        gravity: 0,
        spread: Math.PI * 2,
        shape: "circle",
      });
    });

    schedule(T.confetti1, () => {
      particleRef.current?.emitConfetti(CONFETTI_RAINBOW, 70);
    });
    schedule(T.confetti2, () => {
      particleRef.current?.emitConfetti(CONFETTI_RAINBOW, 50);
    });
    schedule(T.confetti3, () => {
      particleRef.current?.emitConfetti(CONFETTI_RAINBOW, 35);
    });
    schedule(T.confetti4, () => {
      particleRef.current?.emitConfetti(CONFETTI_RAINBOW, 30);
    });
    // Side-bursts für Breite
    schedule(T.confetti1 + 250, () => {
      const canvas = particleRef.current;
      if (!canvas) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.emit({
        x: w * 0.18,
        y: h * 0.45,
        count: 25,
        colors: CONFETTI_RAINBOW,
        speed: [200, 500],
        size: [3, 8],
        lifetime: [800, 1600],
        gravity: 180,
        spread: Math.PI / 1.5,
        shape: "square",
      });
      canvas.emit({
        x: w * 0.82,
        y: h * 0.45,
        count: 25,
        colors: CONFETTI_RAINBOW,
        speed: [200, 500],
        size: [3, 8],
        lifetime: [800, 1600],
        gravity: 180,
        spread: Math.PI / 1.5,
        shape: "square",
      });
    });

    schedule(T.total, () => {
      if (completedRef.current) return;
      completedRef.current = true;
      onIntroComplete();
    });

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [onPlaySound, onIntroComplete, particleRef]);

  return (
    <motion.div
      className="relative flex flex-col items-center justify-center w-full min-h-screen overflow-hidden"
      animate={{
        x: [0, -6, 7, -4, 5, -2, 0],
        y: [0, 4, -5, 2, -3, 1, 0],
      }}
      transition={{
        duration: 0.55,
        delay: T.flashAt / 1000,
        ease: "easeInOut",
        times: [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1],
      }}
    >
      {/* Anti-climax Backdrop — pulsiert leicht in Phase A */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 1, 1] }}
        transition={{
          duration: T.total / 1000,
          times: [0, 0.1, 0.5, 0.85, 1],
        }}
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(95, 35, 165, 0.55) 0%, rgba(35, 12, 80, 0.85) 35%, rgba(0,0,0,0.95) 75%)",
        }}
      />

      {/* Tension-Punkt vor dem BOOM */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          width: 60,
          height: 60,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,210,90,0.6) 50%, transparent 80%)",
          filter: "blur(2px)",
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: [0, 0.4, 0.6, 0.8, 1.4, 18, 0],
          opacity: [0, 0.6, 0.7, 0.85, 1, 1, 0],
        }}
        transition={{
          duration: (T.flashAt + 250) / 1000,
          times: [0, 0.25, 0.55, 0.8, 0.93, 1, 1],
          ease: [0.7, 0, 0.4, 1],
        }}
      />

      {/* Mega-Flash — kurzer Weiß-Blitz beim BOOM */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ mixBlendMode: "screen" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 0.4, 0] }}
        transition={{
          duration: 0.8,
          times: [0, 0.05, 0.18, 0.5, 1],
          delay: (T.flashAt - 30) / 1000,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(255,255,255,1) 0%, rgba(255,235,150,0.85) 25%, rgba(255,180,40,0.4) 50%, transparent 70%)",
          }}
        />
      </motion.div>

      {/* Rotierende Goldstrahlen — kicken beim BOOM rein */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute"
        style={{ width: 900, height: 900 }}
        initial={{ rotate: 0, opacity: 0, scale: 0.3 }}
        animate={{
          rotate: 360,
          opacity: [0, 0, 1, 0.85, 0.6, 0],
          scale: [0.3, 0.3, 1.1, 1.0, 1.0, 1.05],
        }}
        transition={{
          rotate: { duration: 14, ease: "linear", repeat: Infinity },
          opacity: {
            duration: T.total / 1000,
            times: [
              0,
              T.rayStart / T.total - 0.01,
              T.rayStart / T.total + 0.04,
              0.55,
              T.fadeOutStart / T.total,
              1,
            ],
          },
          scale: {
            duration: T.total / 1000,
            times: [
              0,
              T.rayStart / T.total - 0.01,
              T.rayStart / T.total + 0.06,
              0.5,
              T.fadeOutStart / T.total,
              1,
            ],
            ease: "easeOut",
          },
        }}
      >
        <svg viewBox="0 0 900 900" className="w-full h-full">
          {Array.from({ length: 18 }).map((_, i) => {
            const angle = (i * 360) / 18;
            return (
              <polygon
                key={i}
                points="450,450 442,30 458,30"
                fill="rgba(255, 215, 95, 0.42)"
                transform={`rotate(${angle} 450 450)`}
              />
            );
          })}
        </svg>
      </motion.div>

      {/* Goldener Glow-Halo — pulsiert weiter nach dem BOOM */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          width: 640,
          height: 640,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,225,110,0.55) 0%, rgba(255,165,30,0.28) 30%, transparent 65%)",
          filter: "blur(22px)",
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: [0, 0, 1.5, 1.1, 1.25, 1.1],
          opacity: [0, 0, 1, 0.7, 0.85, 0],
        }}
        transition={{
          duration: T.total / 1000,
          times: [
            0,
            T.burstAt / T.total - 0.01,
            T.burstAt / T.total + 0.07,
            0.55,
            T.fadeOutStart / T.total,
            1,
          ],
          ease: "easeOut",
        }}
      />

      {/* GODPACK — Letter-by-Letter mit overshoot, dann lange Hold-Phase
          mit subtilem Idle-Glow (atmen + leichte Skalierung). Der Buchstabe
          fade-out passiert erst gegen Ende der gesamten Sequenz. */}
      <div className="relative z-20 flex items-baseline mb-4">
        {GODPACK_LETTERS.map((letter, i) => {
          const reveal = (T.letterStart + i * T.letterStagger) / 1000;
          const sequenceDuration = (T.fadeOutStart - T.letterStart) / 1000 + 0.5;
          return (
            <motion.span
              key={`${letter}-${i}`}
              initial={{ scale: 0, opacity: 0, y: 130, rotate: -25 }}
              animate={{
                scale: [0, 1.65, 0.88, 1.0, 1.04, 1.0, 1.04, 1.0, 1.0],
                opacity: [0, 1, 1, 1, 1, 1, 1, 1, 0],
                y: [130, -22, 6, 0, 0, 0, 0, 0, -12],
                rotate: [-25, 14, -5, 0, 0, 0, 0, 0, 0],
              }}
              transition={{
                duration: sequenceDuration,
                times: [0, 0.05, 0.1, 0.16, 0.4, 0.6, 0.8, 0.92, 1],
                delay: reveal,
                ease: [0.18, 1.65, 0.42, 1],
              }}
              className="text-[64px] sm:text-[112px] md:text-[152px] font-black inline-block"
              style={{
                color: "#fffbe1",
                WebkitTextStroke: "3px rgba(85, 35, 0, 0.75)",
                filter:
                  "drop-shadow(0 0 28px rgba(255, 215, 95, 1)) drop-shadow(0 10px 0 rgba(180, 95, 15, 0.65)) drop-shadow(0 18px 28px rgba(0,0,0,0.55))",
                fontFamily: "'Impact', 'Arial Black', 'Helvetica Neue', sans-serif",
                letterSpacing: "-0.025em",
                padding: "0 2px",
              }}
            >
              {letter}
            </motion.span>
          );
        })}
      </div>

      {/* Shimmer-Streak über GODPACK — wandert während der Hold-Phase
          mehrfach von links nach rechts und gibt dem Schriftzug Leben. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute z-20"
        style={{
          width: "min(90vw, 1100px)",
          height: 200,
          top: "calc(50% - 40px)",
          mixBlendMode: "screen",
          background:
            "linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.85) 49%, rgba(255,240,180,0.7) 51%, transparent 62%)",
          maskImage:
            "linear-gradient(105deg, transparent 38%, black 49%, black 51%, transparent 62%)",
          WebkitMaskImage:
            "linear-gradient(105deg, transparent 38%, black 49%, black 51%, transparent 62%)",
        }}
        initial={{ x: "-110%", opacity: 0 }}
        animate={{
          x: ["-110%", "120%", "-110%", "120%"],
          opacity: [0, 1, 0, 1, 0],
        }}
        transition={{
          duration: 2.4,
          times: [0, 0.25, 0.5, 0.75, 1],
          delay: 1.7,
          repeat: 1,
          repeatDelay: 0.2,
        }}
      />

      {/* Subline + Game-Tag — kommt nach dem GODPACK-Reveal, bleibt während
          der gesamten Hold-Phase sichtbar. */}
      <motion.div
        className="relative z-20 flex flex-col items-center gap-2 mt-3"
        initial={{ opacity: 0, y: 28 }}
        animate={{
          opacity: [0, 1, 1, 0],
          y: [28, 0, 0, -16],
        }}
        transition={{
          duration: (T.fadeOutStart - T.sublineIn) / 1000 + 0.45,
          times: [0, 0.16, 0.88, 1],
          delay: T.sublineIn / 1000,
        }}
      >
        <motion.p
          className="text-[24px] sm:text-[34px] md:text-[40px] font-extrabold text-white"
          style={{
            textShadow:
              "0 0 22px rgba(255,200,90,0.95), 0 3px 0 rgba(120,55,0,0.55), 0 6px 14px rgba(0,0,0,0.5)",
            letterSpacing: "0.01em",
          }}
          animate={{
            scale: [1, 1.04, 1],
          }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {isDe ? "DU HAST ES GESCHAFFT!" : "YOU MADE IT!"}
        </motion.p>
        <p
          className="text-[12px] sm:text-sm uppercase tracking-[6px] sm:tracking-[8px] font-bold text-amber-300/95"
          style={{ textShadow: "0 0 12px rgba(255,180,60,0.65)" }}
        >
          5 KARTEN × {gameLabel}
        </p>
      </motion.div>

      {/* Floating Stars (statisch im Hintergrund, drehen sich subtil) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.3, 0.7, 0.7, 0.3] }}
        transition={{
          duration: T.total / 1000,
          times: [0, 0.2, 0.4, 0.85, 1],
        }}
      >
        {Array.from({ length: 24 }).map((_, i) => {
          const left = (i * 137 + 17) % 100;
          const top = (i * 61 + 11) % 100;
          const size = (i % 3) + 2;
          return (
            <motion.span
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: size,
                height: size,
                boxShadow: `0 0 ${size * 3}px rgba(255, 240, 180, 0.95)`,
              }}
              animate={{
                opacity: [0.3, 1, 0.4, 0.9],
                scale: [0.8, 1.4, 0.9, 1.2],
              }}
              transition={{
                duration: 2 + (i % 4) * 0.3,
                repeat: Infinity,
                delay: i * 0.07,
                ease: "easeInOut",
              }}
            />
          );
        })}
      </motion.div>

      {/* Final Spotlight – setzt Pack ins Licht für Übergang */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0.65, 0.4, 0] }}
        transition={{
          duration: T.total / 1000,
          times: [0, 0.4, 0.6, 0.88, 1],
        }}
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(255, 230, 150, 0.35) 0%, transparent 50%)",
          mixBlendMode: "screen",
        }}
      />
    </motion.div>
  );
}
