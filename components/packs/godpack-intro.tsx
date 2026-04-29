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
 *              Der User wartet, weiß noch nicht was passiert. Kein Sound außer
 *              einem tiefen Drone.
 *  700-900ms   BOOM: Weißer Mega-Flash + Goldener Particle-Burst + Camera-
 *              Shake + erster lauter Hit-Sound.
 *  900-1500ms  Letter-by-Letter Bounce der GODPACK-Buchstaben mit ~90ms
 *              Stagger — jeder Buchstabe wird mit overshoot reingeschmissen.
 *  1500-2400ms Confetti-Wellen, „DU HAST ES GESCHAFFT!" + „5 LEGENDÄRE x …"
 *              Subline. Goldene Strahlen rotieren weiter.
 *  2400-3400ms Smooth Fade-out, Sound „chime", Übergang zum Ripping.
 */
const T = {
  total: 3400,
  flashAt: 700,
  burstAt: 720,
  rayStart: 750,
  letterStart: 900,
  letterStagger: 95,
  jackpotIn: 700,
  sublineIn: 1500,
  confetti1: 1500,
  confetti2: 2200,
  fadeOutStart: 2900,
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
      className="relative flex flex-col items-center justify-center min-h-[500px] w-full"
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

      {/* JACKPOT! — knallt rein mit overshoot */}
      <motion.div
        className="relative z-20 mb-1"
        initial={{ scale: 0.15, opacity: 0, y: -30 }}
        animate={{
          scale: [0.15, 1.45, 1.0, 1.0, 1.05, 0.92],
          opacity: [0, 1, 1, 1, 1, 0],
          y: [-30, 0, 0, 0, 0, -16],
        }}
        transition={{
          duration: (T.fadeOutStart - T.jackpotIn) / 1000 + 0.45,
          times: [0, 0.1, 0.2, 0.55, 0.85, 1],
          delay: T.jackpotIn / 1000,
          ease: [0.34, 1.85, 0.5, 1],
        }}
      >
        <div
          className="text-[44px] sm:text-[68px] md:text-[84px] font-black tracking-[-0.04em] italic"
          style={{
            background:
              "linear-gradient(180deg, #fff7c2 0%, #ffd700 35%, #ff8a00 80%, #b54a00 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter:
              "drop-shadow(0 0 28px rgba(255, 200, 80, 0.85)) drop-shadow(0 5px 0 rgba(120, 45, 0, 0.55))",
            fontFamily: "'Impact', 'Arial Black', 'Helvetica Neue', sans-serif",
            transform: "skew(-6deg)",
          }}
        >
          JACKPOT!
        </div>
      </motion.div>

      {/* GODPACK — letter-by-letter bounce-in */}
      <div className="relative z-20 flex items-baseline mb-3">
        {GODPACK_LETTERS.map((letter, i) => (
          <motion.span
            key={`${letter}-${i}`}
            initial={{ scale: 0, opacity: 0, y: 110, rotate: -22 }}
            animate={{
              scale: [0, 1.55, 0.9, 1.0, 1.0, 1.0, 0.95],
              opacity: [0, 1, 1, 1, 1, 1, 0],
              y: [110, -18, 4, 0, 0, 0, -10],
              rotate: [-22, 12, -4, 0, 0, 0, 0],
            }}
            transition={{
              duration: (T.fadeOutStart - T.letterStart) / 1000 + 0.5,
              times: [0, 0.07, 0.13, 0.22, 0.5, 0.85, 1],
              delay: (T.letterStart + i * T.letterStagger) / 1000,
              ease: [0.18, 1.6, 0.42, 1],
            }}
            className="text-[60px] sm:text-[96px] md:text-[128px] font-black inline-block"
            style={{
              color: "#fffbe1",
              WebkitTextStroke: "2.5px rgba(85, 35, 0, 0.7)",
              filter:
                "drop-shadow(0 0 22px rgba(255, 215, 95, 0.95)) drop-shadow(0 8px 0 rgba(180, 95, 15, 0.6)) drop-shadow(0 14px 22px rgba(0,0,0,0.5))",
              fontFamily: "'Impact', 'Arial Black', 'Helvetica Neue', sans-serif",
              letterSpacing: "-0.025em",
              padding: "0 1px",
            }}
          >
            {letter}
          </motion.span>
        ))}
      </div>

      {/* Joyful Subline + Game-Tag */}
      <motion.div
        className="relative z-20 flex flex-col items-center gap-2 mt-1"
        initial={{ opacity: 0, y: 22 }}
        animate={{
          opacity: [0, 1, 1, 0],
          y: [22, 0, 0, -14],
        }}
        transition={{
          duration: (T.fadeOutStart - T.sublineIn) / 1000 + 0.45,
          times: [0, 0.18, 0.85, 1],
          delay: T.sublineIn / 1000,
        }}
      >
        <motion.p
          className="text-[22px] sm:text-[30px] md:text-[34px] font-extrabold text-white"
          style={{
            textShadow:
              "0 0 18px rgba(255,200,90,0.85), 0 3px 0 rgba(120,55,0,0.5), 0 6px 14px rgba(0,0,0,0.45)",
            letterSpacing: "0.01em",
          }}
          animate={{
            scale: [1, 1.03, 1],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {isDe ? "DU HAST ES GESCHAFFT!" : "YOU MADE IT!"}
        </motion.p>
        <p
          className="text-[11px] sm:text-sm uppercase tracking-[5px] sm:tracking-[7px] font-bold text-amber-300/95"
          style={{ textShadow: "0 0 10px rgba(255,180,60,0.55)" }}
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
