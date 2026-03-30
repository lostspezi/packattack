# Pack Opening Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the flat, animation-free pack opening into a cinematic 3D experience with rip-to-open gesture, per-card 3D flip reveals, and coin-value-based particle/glow effects across 4 tiers.

**Architecture:** New animation components (`pack-3d`, `pack-ripper`, `card-flipper`, `particle-canvas`) compose inside the existing `pack-opening.tsx` orchestrator. A shared `effect-tiers.ts` config maps coin values to visual tiers. A custom Canvas 2D particle engine handles all particle effects without external dependencies.

**Tech Stack:** `motion` (motion.dev) for 3D transforms/gestures/spring physics, Canvas 2D API for particles, Web Audio API for sounds, CSS keyframes for screen-shake/holo effects.

**Spec:** `docs/superpowers/specs/2026-03-30-pack-opening-animation-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `components/packs/effect-tiers.ts` | Tier config: thresholds, colors, particle configs, sound mappings |
| `components/packs/particle-engine.ts` | Pure class: Canvas 2D particle physics engine (no React) |
| `components/packs/particle-canvas.tsx` | React wrapper: manages canvas element + ParticleEngine lifecycle |
| `components/packs/use-pack-sounds.ts` | Hook: preloads and plays sound effects |
| `components/packs/pack-3d.tsx` | 3D pack with mouse-tracking parallax tilt + idle float animation |
| `components/packs/pack-ripper.tsx` | Swipe-to-rip interaction with progress tracking + rip completion |
| `components/packs/card-flipper.tsx` | Single card 3D flip with tier-based effects (glow, slowdown, shake) |

### Modified Files
| File | Changes |
|------|---------|
| `package.json` | Add `motion` dependency |
| `app/globals.css` | Add keyframes: `screenShake`, `holoShimmer`, `confettiDrop`, `packFloat` |
| `components/packs/pack-opening.tsx` | Refactor to orchestrate animation phases (idle → rip → reveal → review) |
| `app/[lang]/(dashboard)/(pages)/packs/[id]/page.tsx` | Add "Quick Open" button alongside animated open |

### Sound Assets (to be sourced/created)
| File | Purpose |
|------|---------|
| `public/sounds/pack-rip.mp3` | Paper tearing sound |
| `public/sounds/pack-burst.mp3` | Explosion on rip complete |
| `public/sounds/card-flip.mp3` | Basic card flip |
| `public/sounds/card-shimmer.mp3` | Tier 2 (Good) reveal |
| `public/sounds/card-epic.mp3` | Tier 3 (Epic) reveal |
| `public/sounds/card-legendary.mp3` | Tier 4 (Legendary) fanfare |

---

## Pre-requisite: Branch & Dependency Setup

### Task 0: Create branch and install motion

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b feature/pack-opening-animation
```

- [ ] **Step 2: Install motion**

```bash
npm install motion
```

- [ ] **Step 3: Verify build**

```bash
npm run typecheck && npm run lint
```

Expected: Both pass with no new errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add motion library for pack opening animation"
```

---

## Task 1: Effect Tiers Configuration

**Files:**
- Create: `components/packs/effect-tiers.ts`

- [ ] **Step 1: Create the tier config file**

```typescript
// components/packs/effect-tiers.ts

export type EffectTier = 1 | 2 | 3 | 4;

export interface TierConfig {
  tier: EffectTier;
  label: string;
  colors: string[];
  glowColor: string;
  glowIntensity: number; // box-shadow spread in px
  particleCount: number;
  flipDuration: number; // seconds
  flipPauseDeg: number | null; // degree to pause at (null = no pause)
  flipPauseMs: number; // ms to pause
  screenShake: boolean;
  confetti: boolean;
  soundKey: "flip" | "shimmer" | "epic" | "legendary";
  volume: number;
}

const DEFAULT_THRESHOLDS = [50, 200, 500] as const;

export function getEffectTier(
  coinValue: number,
  thresholds: readonly [number, number, number] = DEFAULT_THRESHOLDS,
): EffectTier {
  if (coinValue >= thresholds[2]) return 4;
  if (coinValue >= thresholds[1]) return 3;
  if (coinValue >= thresholds[0]) return 2;
  return 1;
}

export function getMaxTierFromCards(
  cards: { coinValue: number }[],
  thresholds?: readonly [number, number, number],
): EffectTier {
  let max: EffectTier = 1;
  for (const c of cards) {
    const t = getEffectTier(c.coinValue, thresholds);
    if (t > max) max = t;
  }
  return max;
}

export const TIER_CONFIGS: Record<EffectTier, TierConfig> = {
  1: {
    tier: 1,
    label: "Normal",
    colors: ["#C8C8D0"],
    glowColor: "transparent",
    glowIntensity: 0,
    particleCount: 0,
    flipDuration: 0.6,
    flipPauseDeg: null,
    flipPauseMs: 0,
    screenShake: false,
    confetti: false,
    soundKey: "flip",
    volume: 0.3,
  },
  2: {
    tier: 2,
    label: "Good",
    colors: ["#9BFF00", "#7ACC00", "#B8FF4D"],
    glowColor: "rgba(155,255,0,0.3)",
    glowIntensity: 15,
    particleCount: 8,
    flipDuration: 0.6,
    flipPauseDeg: null,
    flipPauseMs: 0,
    screenShake: false,
    confetti: false,
    soundKey: "shimmer",
    volume: 0.5,
  },
  3: {
    tier: 3,
    label: "Epic",
    colors: ["#FFD700", "#FFA500", "#FFEC8B"],
    glowColor: "rgba(255,215,0,0.3)",
    glowIntensity: 25,
    particleCount: 18,
    flipDuration: 0.8,
    flipPauseDeg: 45,
    flipPauseMs: 200,
    screenShake: false,
    confetti: false,
    soundKey: "epic",
    volume: 0.7,
  },
  4: {
    tier: 4,
    label: "Legendary",
    colors: ["#ff6b6b", "#FFD700", "#9BFF00", "#6bc5ff", "#c06bff"],
    glowColor: "rgba(255,107,107,0.3)",
    glowIntensity: 35,
    particleCount: 35,
    flipDuration: 1.0,
    flipPauseDeg: 90,
    flipPauseMs: 300,
    screenShake: true,
    confetti: true,
    soundKey: "legendary",
    volume: 1.0,
  },
};

/** Map max tier to rip explosion color palette */
export function getRipColors(maxTier: EffectTier): string[] {
  return TIER_CONFIGS[maxTier].colors;
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/packs/effect-tiers.ts
git commit -m "feat(packs): add effect tier configuration for pack opening animation"
```

---

## Task 2: Particle Engine

**Files:**
- Create: `components/packs/particle-engine.ts`

- [ ] **Step 1: Create the particle engine class**

```typescript
// components/packs/particle-engine.ts

export interface ParticleConfig {
  x: number;
  y: number;
  count: number;
  colors: string[];
  speed: [number, number];
  size: [number, number];
  lifetime: [number, number];
  gravity: number;
  spread: number; // radians, full circle = Math.PI * 2
  shape: "circle" | "square";
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  shape: "circle" | "square";
}

export class ParticleEngine {
  private particles: Particle[] = [];
  private animFrameId: number | null = null;
  private lastTime = 0;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  detach() {
    this.stop();
    this.canvas = null;
    this.ctx = null;
  }

  emit(config: ParticleConfig) {
    for (let i = 0; i < config.count; i++) {
      const angle = Math.random() * config.spread - config.spread / 2 - Math.PI / 2;
      const speed = config.speed[0] + Math.random() * (config.speed[1] - config.speed[0]);
      const size = config.size[0] + Math.random() * (config.size[1] - config.size[0]);
      const lifetime = config.lifetime[0] + Math.random() * (config.lifetime[1] - config.lifetime[0]);

      this.particles.push({
        x: config.x,
        y: config.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        color: config.colors[Math.floor(Math.random() * config.colors.length)],
        life: lifetime,
        maxLife: lifetime,
        shape: config.shape,
      });
    }

    if (!this.animFrameId) {
      this.lastTime = performance.now();
      this.loop();
    }
  }

  /** Emit confetti particles falling from the top */
  emitConfetti(width: number, colors: string[], count = 40) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * width,
        y: -10 - Math.random() * 50,
        vx: (Math.random() - 0.5) * 60,
        vy: 80 + Math.random() * 120,
        size: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 2500 + Math.random() * 1000,
        maxLife: 3500,
        shape: "square",
      });
    }

    if (!this.animFrameId) {
      this.lastTime = performance.now();
      this.loop();
    }
  }

  private loop = () => {
    const now = performance.now();
    const dt = (now - this.lastTime) / 1000; // seconds
    this.lastTime = now;

    this.update(dt);
    this.render();

    if (this.particles.length > 0) {
      this.animFrameId = requestAnimationFrame(this.loop);
    } else {
      this.animFrameId = null;
    }
  };

  private update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt; // gravity
      p.life -= dt * 1000;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    ctx.clearRect(0, 0, width, height);

    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      if (p.shape === "circle") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  stop() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.particles = [];
  }

  get isActive() {
    return this.particles.length > 0;
  }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/packs/particle-engine.ts
git commit -m "feat(packs): add Canvas 2D particle engine for pack effects"
```

---

## Task 3: Particle Canvas React Wrapper

**Files:**
- Create: `components/packs/particle-canvas.tsx`

- [ ] **Step 1: Create the React wrapper component**

```typescript
// components/packs/particle-canvas.tsx
"use client";

import { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";
import { ParticleEngine, type ParticleConfig } from "./particle-engine";

export interface ParticleCanvasHandle {
  emit: (config: ParticleConfig) => void;
  emitConfetti: (colors: string[], count?: number) => void;
  stop: () => void;
}

export const ParticleCanvas = forwardRef<ParticleCanvasHandle>(
  function ParticleCanvas(_, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<ParticleEngine | null>(null);

    useEffect(() => {
      const engine = new ParticleEngine();
      engineRef.current = engine;

      const canvas = canvasRef.current;
      if (!canvas) return;

      engine.attach(canvas);

      function resize() {
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(dpr, dpr);
      }

      resize();
      window.addEventListener("resize", resize);

      return () => {
        engine.detach();
        window.removeEventListener("resize", resize);
      };
    }, []);

    const emit = useCallback((config: ParticleConfig) => {
      engineRef.current?.emit(config);
    }, []);

    const emitConfetti = useCallback((colors: string[], count?: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      engineRef.current?.emitConfetti(rect.width, colors, count);
    }, []);

    const stop = useCallback(() => {
      engineRef.current?.stop();
    }, []);

    useImperativeHandle(ref, () => ({ emit, emitConfetti, stop }), [emit, emitConfetti, stop]);

    return (
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-50"
        style={{ width: "100%", height: "100%" }}
      />
    );
  },
);
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/packs/particle-canvas.tsx
git commit -m "feat(packs): add ParticleCanvas React wrapper"
```

---

## Task 4: Sound Hook

**Files:**
- Create: `components/packs/use-pack-sounds.ts`

- [ ] **Step 1: Create the sound hook**

```typescript
// components/packs/use-pack-sounds.ts
"use client";

import { useRef, useEffect, useCallback } from "react";

const SOUND_MAP = {
  rip: "/sounds/pack-rip.mp3",
  burst: "/sounds/pack-burst.mp3",
  flip: "/sounds/card-flip.mp3",
  shimmer: "/sounds/card-shimmer.mp3",
  epic: "/sounds/card-epic.mp3",
  legendary: "/sounds/card-legendary.mp3",
} as const;

export type SoundKey = keyof typeof SOUND_MAP;

/**
 * Preloads pack-opening sound effects and provides a play function.
 * Silently does nothing if sound files are missing (graceful degradation).
 */
export function usePackSounds() {
  const audioCache = useRef<Map<SoundKey, HTMLAudioElement>>(new Map());

  useEffect(() => {
    // Preload all sounds
    for (const [key, src] of Object.entries(SOUND_MAP)) {
      const audio = new Audio(src);
      audio.preload = "auto";
      audioCache.current.set(key as SoundKey, audio);
    }

    return () => {
      audioCache.current.forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
      audioCache.current.clear();
    };
  }, []);

  const play = useCallback((key: SoundKey, volume = 0.5) => {
    const audio = audioCache.current.get(key);
    if (!audio) return;

    // Clone to allow overlapping playback
    const clone = audio.cloneNode() as HTMLAudioElement;
    clone.volume = Math.min(1, Math.max(0, volume));
    clone.play().catch(() => {
      // Autoplay blocked — silently ignore
    });
  }, []);

  return { play };
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/packs/use-pack-sounds.ts
git commit -m "feat(packs): add usePackSounds hook for sound effects"
```

---

## Task 5: CSS Keyframes

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add pack animation keyframes**

Add the following keyframes to `app/globals.css`, right after the existing `@keyframes float` block (after line 74):

```css
/* ================================================================
 * PACK OPENING — Animation keyframes
 * ================================================================ */

@keyframes packFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

@keyframes screenShake {
  0%, 100% { transform: translate(0, 0); }
  10% { transform: translate(-3px, -2px); }
  20% { transform: translate(4px, 1px); }
  30% { transform: translate(-2px, 3px); }
  40% { transform: translate(3px, -1px); }
  50% { transform: translate(-4px, 2px); }
  60% { transform: translate(2px, -3px); }
  70% { transform: translate(-1px, 4px); }
  80% { transform: translate(3px, -2px); }
  90% { transform: translate(-2px, 1px); }
}

@keyframes holoShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes rainbowBorder {
  0% { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(360deg); }
}

.animate-pack-float {
  animation: packFloat 3s ease-in-out infinite;
}

.animate-screen-shake {
  animation: screenShake 150ms ease-in-out;
}

.animate-holo-shimmer {
  background: linear-gradient(
    110deg,
    transparent 20%,
    rgba(155, 255, 0, 0.06) 35%,
    rgba(255, 215, 0, 0.06) 50%,
    rgba(155, 255, 0, 0.04) 65%,
    transparent 80%
  );
  background-size: 200% 100%;
  animation: holoShimmer 3s ease-in-out infinite;
}

.animate-rainbow-border {
  animation: rainbowBorder 3s linear infinite;
}
```

- [ ] **Step 2: Verify lint**

```bash
npm run lint:fix
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(packs): add CSS keyframes for pack opening effects"
```

---

## Task 6: Pack 3D Component

**Files:**
- Create: `components/packs/pack-3d.tsx`

- [ ] **Step 1: Create the 3D pack component**

```typescript
// components/packs/pack-3d.tsx
"use client";

import { useRef, useCallback } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

interface Pack3DProps {
  boxName: string;
  boxImage: string | null;
  onReady: () => void; // called when user interacts (ready to rip)
}

export function Pack3D({ boxName, boxImage, onReady }: Pack3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  const springX = useSpring(rotateX, { stiffness: 150, damping: 20 });
  const springY = useSpring(rotateY, { stiffness: 150, damping: 20 });

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const x = (e.clientY - centerY) / (rect.height / 2); // -1 to 1
      const y = (e.clientX - centerX) / (rect.width / 2);  // -1 to 1
      rotateX.set(x * -12); // tilt max 12deg
      rotateY.set(y * 12);
    },
    [rotateX, rotateY],
  );

  const handlePointerLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center gap-6"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ perspective: 800 }}
    >
      <motion.div
        className="relative w-[200px] h-[280px] rounded-2xl border-2 border-pa-green/50 cursor-pointer animate-pack-float"
        style={{
          rotateX: springX,
          rotateY: springY,
          background: "linear-gradient(145deg, #2a1f4e 0%, #1a0f3e 60%, #0d0720 100%)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(155,255,0,0.12)",
          transformStyle: "preserve-3d",
        }}
        whileTap={{ scale: 0.97 }}
        onClick={onReady}
      >
        {/* Holographic shimmer overlay */}
        <div className="absolute inset-0 rounded-2xl animate-holo-shimmer pointer-events-none" />

        {/* Edge light */}
        <div
          className="absolute top-0 right-0 w-[30%] h-full rounded-r-2xl pointer-events-none"
          style={{ background: "linear-gradient(to left, rgba(255,255,255,0.05), transparent)" }}
        />

        {/* Tear line */}
        <div
          className="absolute left-[-2px] right-[-2px] h-[2px]"
          style={{
            top: "28%",
            background: "repeating-linear-gradient(90deg, rgba(155,255,0,0.4) 0px, rgba(155,255,0,0.4) 6px, transparent 6px, transparent 12px)",
          }}
        />

        {/* Brand / Image */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {boxImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={boxImage}
              alt={boxName}
              className="w-[120px] h-auto rounded-lg opacity-80"
            />
          ) : (
            <>
              <span className="text-3xl font-black text-pa-green" style={{ textShadow: "0 0 20px rgba(155,255,0,0.5)" }}>
                PA
              </span>
              <span className="text-[9px] text-pa-green/50 uppercase tracking-[3px]">
                Pack Attack
              </span>
            </>
          )}
        </div>
      </motion.div>

      {/* Swipe indicator */}
      <div className="flex flex-col items-center gap-2">
        <motion.span
          className="text-2xl text-pa-green"
          animate={{ y: [-8, 8] }}
          transition={{ duration: 1.2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        >
          &#8593;
        </motion.span>
        <span className="text-[11px] text-pa-green/60 uppercase tracking-[2px]">
          Swipe to Open
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint:fix
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/packs/pack-3d.tsx
git commit -m "feat(packs): add Pack3D component with mouse-tracking parallax tilt"
```

---

## Task 7: Pack Ripper Component

**Files:**
- Create: `components/packs/pack-ripper.tsx`

- [ ] **Step 1: Create the ripper component**

```typescript
// components/packs/pack-ripper.tsx
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
const SWIPE_RANGE = 200; // px for full rip

export function PackRipper({
  boxName,
  boxImage,
  maxTier,
  particleRef,
  onRipComplete,
  onPlaySound,
}: PackRipperProps) {
  const [completed, setCompleted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const ripSoundPlayed = useRef(false);

  const dragY = useMotionValue(0);
  const progress = useTransform(dragY, [0, -SWIPE_RANGE], [0, 1]);

  // Derived transforms
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

  const handlePan = useCallback(
    (_: PointerEvent, info: PanInfo) => {
      // Only allow upward swipe
      const clamped = Math.min(0, Math.max(-SWIPE_RANGE, info.offset.y));
      dragY.set(clamped);

      // Auto-complete check
      const prog = Math.abs(clamped) / SWIPE_RANGE;
      if (prog >= AUTO_COMPLETE_THRESHOLD && !completed) {
        triggerComplete();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [completed],
  );

  const handlePanEnd = useCallback(() => {
    const prog = Math.abs(dragY.get()) / SWIPE_RANGE;
    if (prog < AUTO_COMPLETE_THRESHOLD) {
      // Snap back
      dragY.set(0);
      ripSoundPlayed.current = false;
    }
  }, [dragY]);

  const triggerComplete = useCallback(() => {
    setCompleted(true);
    onPlaySound("burst", 0.7);

    // Vibrate on mobile
    if (navigator.vibrate) {
      navigator.vibrate([50, 30, 100]);
    }

    // Emit particles at the tear line
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && particleRef.current) {
      const tierColors = TIER_CONFIGS[maxTier].colors;
      particleRef.current.emit({
        x: rect.width / 2,
        y: rect.height * 0.35,
        count: 25,
        colors: tierColors,
        speed: [100, 250],
        size: [3, 7],
        lifetime: [600, 1200],
        gravity: 80,
        spread: Math.PI,
        shape: "circle",
      });
    }

    // Delay before transitioning to card reveal
    setTimeout(() => {
      onRipComplete();
    }, 800);
  }, [maxTier, onPlaySound, onRipComplete, particleRef]);

  if (completed) {
    return (
      <div ref={containerRef} className="relative flex flex-col items-center gap-0 py-8">
        {/* Top half - flying away */}
        <motion.div
          className="w-[200px] h-[80px] rounded-t-2xl border-2 border-pa-green/50 border-b-0"
          style={{ background: "linear-gradient(145deg, #2a1f4e, #1a0f3e)" }}
          initial={{ y: -40, rotateX: -5, opacity: 1 }}
          animate={{ y: -250, rotateX: -35, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />

        {/* Glow burst */}
        <motion.div
          className="w-[220px] h-3 rounded-full"
          style={{ background: TIER_CONFIGS[maxTier].colors[0] }}
          initial={{ opacity: 1, scaleX: 1.5 }}
          animate={{ opacity: 0, scaleX: 3 }}
          transition={{ duration: 0.8 }}
        />

        {/* Bottom half - stays */}
        <div
          className="w-[200px] h-[200px] rounded-b-2xl border-2 border-pa-green/50 border-t-0 flex items-center justify-center"
          style={{
            background: "linear-gradient(145deg, #2a1f4e, #1a0f3e)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
          }}
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
      <motion.div
        className="relative cursor-grab active:cursor-grabbing touch-none"
        onPanStart={handlePanStart}
        onPan={handlePan}
        onPanEnd={handlePanEnd}
      >
        {/* Top half (draggable visual) */}
        <motion.div
          className="w-[200px] h-[80px] rounded-t-2xl border-2 border-pa-green/50 border-b-0 relative overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #2a1f4e, #1a0f3e)",
            y: topY,
            rotateX: topRotate,
            opacity: topOpacity,
          }}
        >
          <div className="absolute inset-0 animate-holo-shimmer pointer-events-none" />
        </motion.div>

        {/* Tear line glow */}
        <motion.div
          className="w-[220px] h-2 rounded-full mx-auto"
          style={{
            background: "#9BFF00",
            boxShadow: "0 0 30px #9BFF00, 0 0 60px rgba(155,255,0,0.5)",
            opacity: glowOpacity,
            scaleX: glowScale,
          }}
        />

        {/* Bottom half (static) */}
        <div
          className="w-[200px] h-[200px] rounded-b-2xl border-2 border-pa-green/50 border-t-0 flex items-center justify-center"
          style={{
            background: "linear-gradient(145deg, #2a1f4e, #1a0f3e)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
          }}
        >
          {/* Brand / Image */}
          {boxImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={boxImage} alt={boxName} className="w-[100px] h-auto rounded-lg opacity-60" />
          ) : (
            <span className="text-2xl font-black text-pa-green/40">PA</span>
          )}
        </div>
      </motion.div>

      {/* Instruction */}
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
```

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint:fix
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/packs/pack-ripper.tsx
git commit -m "feat(packs): add PackRipper component with swipe-to-rip gesture"
```

---

## Task 8: Card Flipper Component

**Files:**
- Create: `components/packs/card-flipper.tsx`

- [ ] **Step 1: Create the card flipper component**

```typescript
// components/packs/card-flipper.tsx
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ShoppingCart, Coins, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type EffectTier, TIER_CONFIGS, getEffectTier } from "./effect-tiers";
import type { ParticleCanvasHandle } from "./particle-canvas";

interface CardFlipperProps {
  card: {
    cardId: string;
    name: string;
    rarity: string;
    coinValue: number;
    conversionValue: number;
    image: string | null;
  };
  index: number;
  total: number;
  packIndex: number;
  packCount: number;
  lang: string;
  particleRef: React.RefObject<ParticleCanvasHandle | null>;
  onChoice: (choice: "claim" | "convert" | null) => void;
  onNext: () => void;
  onPlaySound: (key: string, volume?: number) => void;
  choice: "claim" | "convert" | null;
}

export function CardFlipper({
  card,
  index,
  total,
  packIndex,
  packCount,
  lang,
  particleRef,
  onChoice,
  onNext,
  onPlaySound,
  choice,
}: CardFlipperProps) {
  const isDe = lang === "de";
  const prefersReducedMotion = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const [shaking, setShaking] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const isLast = index >= total - 1;

  const tier = getEffectTier(card.coinValue);
  const config = TIER_CONFIGS[tier];

  const handleFlip = useCallback(() => {
    if (flipped) return;
    setFlipped(true);

    // Play tier sound
    onPlaySound(config.soundKey, config.volume);

    // Emit particles after flip
    const delay = config.flipPauseMs + (config.flipDuration * 500);
    setTimeout(() => {
      if (config.particleCount > 0 && cardRef.current && particleRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const containerRect = cardRef.current.closest(".relative")?.getBoundingClientRect();
        if (containerRect) {
          particleRef.current.emit({
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top + rect.height / 2,
            count: config.particleCount,
            colors: config.colors,
            speed: [60, 180],
            size: [2, 6],
            lifetime: [400, 1000],
            gravity: 60,
            spread: Math.PI * 2,
            shape: "circle",
          });
        }
      }

      // Screen shake for legendary
      if (config.screenShake) {
        setShaking(true);
        setTimeout(() => setShaking(false), 150);
      }

      // Confetti for legendary
      if (config.confetti && particleRef.current) {
        particleRef.current.emitConfetti(config.colors, 40);
      }
    }, delay);
  }, [flipped, config, onPlaySound, particleRef]);

  // Reset state when card changes
  useEffect(() => {
    setFlipped(false);
    setShaking(false);
  }, [card.cardId, index]);

  // Reduced motion: skip animation, show card directly
  if (prefersReducedMotion) {
    return (
      <div className="max-w-md mx-auto space-y-4 py-4">
        <ProgressBar index={index} total={total} packIndex={packIndex} packCount={packCount} isDe={isDe} />
        <div className="bg-surface border border-border rounded-[14px] p-6 text-center space-y-4">
          <CardFront card={card} tier={tier} isDe={isDe} />
          <ActionButtons card={card} choice={choice} onChoice={onChoice} onNext={onNext} isLast={isLast} isDe={isDe} />
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-md mx-auto space-y-4 py-4 ${shaking ? "animate-screen-shake" : ""}`}>
      <ProgressBar index={index} total={total} packIndex={packIndex} packCount={packCount} isDe={isDe} />

      <div className="relative">
        {/* 3D Flip Container */}
        <div
          ref={cardRef}
          className="bg-surface border border-border rounded-[14px] p-6 text-center space-y-4 cursor-pointer"
          onClick={handleFlip}
          style={{
            perspective: 1000,
          }}
        >
          <div
            style={{
              transformStyle: "preserve-3d",
              transition: `transform ${config.flipDuration}s cubic-bezier(0.4, 0, 0.2, 1)`,
              transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            {/* Card Back */}
            <div
              style={{
                backfaceVisibility: "hidden",
                display: flipped ? "none" : "block",
              }}
            >
              <div className="w-48 h-64 mx-auto bg-gradient-to-br from-pa-green/10 to-pa-lila/20 rounded-xl flex items-center justify-center border border-pa-green/20">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-4xl">?</span>
                  <span className="text-sm text-pa-green font-medium">
                    {isDe ? "Tippe zum Aufdecken" : "Tap to reveal"}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Front */}
            <div
              style={{
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                display: flipped ? "block" : "none",
              }}
            >
              <CardFront card={card} tier={tier} isDe={isDe} />
            </div>
          </div>
        </div>

        {/* Glow effect for tier 2+ */}
        {flipped && config.glowIntensity > 0 && (
          <motion.div
            className="absolute inset-0 rounded-[14px] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              boxShadow: `0 0 ${config.glowIntensity}px ${config.glowColor}, 0 0 ${config.glowIntensity * 2}px ${config.glowColor}`,
            }}
          />
        )}
      </div>

      {/* Action buttons appear after flip */}
      {flipped && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <ActionButtons card={card} choice={choice} onChoice={onChoice} onNext={onNext} isLast={isLast} isDe={isDe} />
        </motion.div>
      )}
    </div>
  );
}

// --- Sub-components ---

function ProgressBar({ index, total, packIndex, packCount, isDe }: {
  index: number; total: number; packIndex: number; packCount: number; isDe: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          {isDe ? "Karte" : "Card"} {index + 1}/{total}
        </p>
        {packCount > 1 && (
          <p className="text-xs text-text-muted">
            Pack {packIndex + 1}/{packCount}
          </p>
        )}
      </div>
      <div className="h-1 bg-white/6 rounded-full overflow-hidden">
        <div
          className="h-full bg-pa-green rounded-full transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>
    </>
  );
}

function CardFront({ card, tier, isDe }: {
  card: { name: string; rarity: string; coinValue: number; conversionValue: number; image: string | null };
  tier: EffectTier;
  isDe: boolean;
}) {
  const config = TIER_CONFIGS[tier];
  return (
    <div className="space-y-4">
      {card.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.image} alt={card.name} className="w-48 mx-auto rounded-xl" />
      ) : (
        <div className="w-48 h-64 mx-auto bg-white/4 rounded-xl flex items-center justify-center">
          <span className="text-text-muted">?</span>
        </div>
      )}

      {/* Holographic shimmer for tier 4 */}
      {tier === 4 && <div className="absolute inset-0 rounded-[14px] animate-holo-shimmer pointer-events-none" />}

      {/* Rainbow border for tier 4 */}
      {tier === 4 && (
        <div
          className="absolute inset-[-2px] rounded-[16px] pointer-events-none animate-rainbow-border"
          style={{
            background: "linear-gradient(135deg, #ff6b6b, #FFD700, #9BFF00, #6bc5ff, #c06bff)",
            zIndex: -1,
          }}
        />
      )}

      <div className="space-y-1">
        <h3 className="text-lg font-bold text-text-primary">{card.name}</h3>
        <Badge variant="info">{card.rarity}</Badge>
        {tier >= 2 && (
          <span
            className="ml-2 text-xs font-bold uppercase tracking-wider"
            style={{ color: config.colors[0] }}
          >
            {config.label}
          </span>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 text-sm">
        <span className="text-text-muted">
          {isDe ? "Wert" : "Value"}:{" "}
          <strong className="text-text-primary">{card.coinValue} Coins</strong>
        </span>
        <span className="text-text-muted">
          {isDe ? "Umwandlung" : "Convert"}:{" "}
          <strong className="text-text-primary">{card.conversionValue} Coins</strong>
        </span>
      </div>
    </div>
  );
}

function ActionButtons({ card, choice, onChoice, onNext, isLast, isDe }: {
  card: { conversionValue: number };
  choice: "claim" | "convert" | null;
  onChoice: (c: "claim" | "convert" | null) => void;
  onNext: () => void;
  isLast: boolean;
  isDe: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          variant={choice === "claim" ? "primary" : "secondary"}
          size="md"
          className="flex-1"
          onClick={() => onChoice(choice === "claim" ? null : "claim")}
        >
          <ShoppingCart className="w-4 h-4 mr-1.5" />
          {isDe ? "Warenkorb" : "Cart"}
        </Button>
        <Button
          variant={choice === "convert" ? "primary" : "secondary"}
          size="md"
          className="flex-1"
          onClick={() => onChoice(choice === "convert" ? null : "convert")}
        >
          <Coins className="w-4 h-4 mr-1.5" />
          {card.conversionValue} Coins
        </Button>
      </div>
      <Button variant="ghost" size="sm" className="w-full" onClick={onNext}>
        <ArrowRight className="w-3.5 h-3.5 mr-1" />
        {isLast
          ? isDe ? "Zur Ubersicht" : "Go to overview"
          : choice
            ? isDe ? "Nachste Karte" : "Next card"
            : isDe ? "Uberspringen — spater entscheiden" : "Skip — decide later"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint:fix
```

Expected: PASS. If there are lint warnings about `exhaustive-deps` in the `handleFlip` callback, add the suggested dependencies or suppress with inline comment.

- [ ] **Step 3: Commit**

```bash
git add components/packs/card-flipper.tsx
git commit -m "feat(packs): add CardFlipper component with 3D flip and tier effects"
```

---

## Task 9: Refactor PackOpening Orchestrator

**Files:**
- Modify: `components/packs/pack-opening.tsx`

This is the core integration task. The existing `pack-opening.tsx` needs a new `"animation"` phase before `"reveal"` and `"review"`, and the `"reveal"` phase needs to use the new `CardFlipper` instead of the flat tap-to-reveal.

- [ ] **Step 1: Rewrite pack-opening.tsx**

Replace the entire content of `components/packs/pack-opening.tsx` with the refactored version that orchestrates all animation phases. Key changes:

1. Add `"idle" | "ripping" | "reveal" | "review"` phases (was just `"reveal" | "review"`)
2. Import and use `Pack3D`, `PackRipper`, `CardFlipper`, `ParticleCanvas`, `usePackSounds`
3. Import `getMaxTierFromCards` from `effect-tiers`
4. Keep the entire review phase unchanged
5. Keep recovery mode unchanged (skips directly to review)
6. Keep the `handleConfirm` function unchanged

The new phase flow:
- `"idle"` → shows Pack3D (3D pack with mouse tracking). Click starts ripping.
- `"ripping"` → shows PackRipper (swipe to rip). On complete → reveal.
- `"reveal"` → shows CardFlipper one card at a time. After last card → review.
- `"review"` → unchanged existing review UI.

```typescript
"use client";

import React, { useState, useRef, useCallback } from "react";
import { ShoppingCart, Coins, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Pack3D } from "./pack-3d";
import { PackRipper } from "./pack-ripper";
import { CardFlipper } from "./card-flipper";
import { ParticleCanvas, type ParticleCanvasHandle } from "./particle-canvas";
import { usePackSounds, type SoundKey } from "./use-pack-sounds";
import { getMaxTierFromCards } from "./effect-tiers";

interface DrawnCard {
  cardId: string;
  name: string;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  image: string | null;
  packIndex: number;
  cardIndex: number;
  status?: string;
}

interface OpenResult {
  packGroupId: string;
  packCount: number;
  totalCost: number;
  newBalance: number;
  isRecovery?: boolean;
  cards: DrawnCard[];
}

interface BoxInfo {
  _id: string;
  name: { de: string; en: string };
  image?: string | null;
}

interface PackOpeningProps {
  result: OpenResult;
  box: BoxInfo;
  lang: string;
  onDone: () => void;
  onCoinsChange: (coins: number) => void;
  quickOpen?: boolean;
}

type CardChoice = "claim" | "convert" | null;
type Phase = "idle" | "ripping" | "reveal" | "review";

export function PackOpening({ result, box, lang, onDone, onCoinsChange, quickOpen = false }: PackOpeningProps) {
  const isDe = lang === "de";
  const { toast } = useToast();
  const { play } = usePackSounds();
  const particleRef = useRef<ParticleCanvasHandle>(null);

  const isRecovery = result.isRecovery ?? false;

  // Pre-populate choices from recovery data
  const initialChoices = (() => {
    const map = new Map<number, CardChoice>();
    if (isRecovery) {
      result.cards.forEach((c, i) => {
        if (c.status === "reserved") map.set(i, "claim");
        if (c.status === "converted") map.set(i, "convert");
      });
    }
    return map;
  })();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [choices, setChoices] = useState<Map<number, CardChoice>>(initialChoices);
  const [phase, setPhase] = useState<Phase>(
    isRecovery ? "review" : quickOpen ? "review" : "idle",
  );
  const [submitting, setSubmitting] = useState(false);

  const cards = result.cards;
  const currentCard = cards[currentIndex];
  const isLast = currentIndex >= cards.length - 1;
  const boxName = isDe ? (box.name.de || box.name.en) : (box.name.en || box.name.de);
  const maxTier = getMaxTierFromCards(cards);

  // Cards already decided before recovery
  const recoveredIndices = new Set(
    isRecovery
      ? cards.map((c, i) => (c.status === "reserved" || c.status === "converted") ? i : -1).filter((i) => i >= 0)
      : [],
  );

  function setChoice(idx: number, choice: CardChoice) {
    setChoices((prev) => new Map(prev).set(idx, choice));
  }

  function advanceCard() {
    if (isLast) {
      setPhase("review");
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  const handlePlaySound = useCallback(
    (key: string, volume?: number) => {
      play(key as SoundKey, volume);
    },
    [play],
  );

  // Summary calculations
  const allDecided = cards.every(
    (_, i) =>
      recoveredIndices.has(i) ||
      choices.get(i) === "claim" ||
      choices.get(i) === "convert",
  );
  const claimedCount = [...choices.values()].filter((c) => c === "claim").length;
  const convertedCount = [...choices.values()].filter((c) => c === "convert").length;
  const coinsBack = cards.reduce(
    (sum, c, i) => (choices.get(i) === "convert" ? sum + c.conversionValue : sum),
    0,
  );

  async function handleConfirm() {
    setSubmitting(true);
    try {
      for (let i = 0; i < cards.length; i++) {
        if (recoveredIndices.has(i)) continue;

        const card = cards[i];
        const decision = choices.get(i);
        if (!decision) continue;

        const res = await fetch("/api/pulls/decide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packGroupId: result.packGroupId,
            cardId: card.cardId,
            cardIndex: i,
            packIndex: card.packIndex,
            rarity: card.rarity,
            coinValue: card.coinValue,
            conversionValue: card.conversionValue,
            decision,
            boxId: box._id,
          }),
        });
        const data = (await res.json()) as { newBalance?: number; error?: string };
        if (!res.ok) {
          toast({ type: "error", title: data.error ?? `Failed on card ${i + 1}` });
          setSubmitting(false);
          return;
        }
        if (data.newBalance !== undefined) onCoinsChange(data.newBalance);
      }

      toast({
        type: "success",
        title: isDe
          ? "Pack-Opening abgeschlossen! Karten im Warenkorb."
          : "Pack opening complete! Cards in cart.",
      });
      onDone();
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  // ─── IDLE PHASE: 3D Pack with mouse tracking ───
  if (phase === "idle") {
    return (
      <div className="relative max-w-md mx-auto py-8">
        <ParticleCanvas ref={particleRef} />
        <Pack3D
          boxName={boxName}
          boxImage={box.image ?? null}
          onReady={() => setPhase("ripping")}
        />
      </div>
    );
  }

  // ─── RIPPING PHASE: Swipe to rip open ───
  if (phase === "ripping") {
    return (
      <div className="relative max-w-md mx-auto py-8">
        <ParticleCanvas ref={particleRef} />
        <PackRipper
          boxName={boxName}
          boxImage={box.image ?? null}
          maxTier={maxTier}
          particleRef={particleRef}
          onRipComplete={() => setPhase("reveal")}
          onPlaySound={handlePlaySound}
        />
      </div>
    );
  }

  // ─── REVEAL PHASE: Card-by-card 3D flip ───
  if (phase === "reveal" && currentCard) {
    return (
      <div className="relative max-w-md mx-auto">
        <ParticleCanvas ref={particleRef} />
        <CardFlipper
          card={currentCard}
          index={currentIndex}
          total={cards.length}
          packIndex={currentCard.packIndex}
          packCount={result.packCount}
          lang={lang}
          particleRef={particleRef}
          choice={choices.get(currentIndex) ?? null}
          onChoice={(c) => setChoice(currentIndex, c)}
          onNext={advanceCard}
          onPlaySound={handlePlaySound}
        />
      </div>
    );
  }

  // ─── REVIEW PHASE: Overview of all cards (unchanged) ───
  return (
    <div className="max-w-lg mx-auto space-y-5 py-8">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-text-primary">
          {isDe ? "Deine Karten — Entscheide dich!" : "Your Cards — Make Your Choice!"}
        </h2>
        <p className="text-sm text-text-secondary">
          {boxName} · {cards.length} {isDe ? "Karten" : "cards"}
        </p>
      </div>

      {/* Recovery banner */}
      {isRecovery && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/8 px-4 py-3">
          <RotateCcw className="h-4 w-4 shrink-0 text-blue-400" />
          <p className="text-sm text-blue-300">
            {isDe
              ? recoveredIndices.size > 0
                ? `Pack-Opening fortgesetzt. Du hast bereits ${recoveredIndices.size} von ${cards.length} Karten entschieden — die restlichen ${cards.length - recoveredIndices.size} warten auf dich.`
                : `Dein letztes Pack-Opening wurde unterbrochen. Deine ${cards.length} Karten sind sicher — entscheide jetzt, was du damit machen möchtest.`
              : recoveredIndices.size > 0
                ? `Pack opening resumed. You've already decided ${recoveredIndices.size} of ${cards.length} cards — ${cards.length - recoveredIndices.size} remaining.`
                : `Your last pack opening was interrupted. Your ${cards.length} cards are safe — decide what to do with them now.`}
          </p>
        </div>
      )}

      {/* Card list with decision toggles */}
      <div className="space-y-2">
        {cards.map((c, i) => {
          const choice = choices.get(i);
          const isRecovered = recoveredIndices.has(i);

          return (
            <div
              key={i}
              className={[
                "flex items-center gap-3 rounded-xl border p-3",
                isRecovered
                  ? "border-white/8 bg-white/3 opacity-70"
                  : "border-border bg-surface",
              ].join(" ")}
            >
              {c.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image} alt="" className="w-12 rounded shrink-0" loading="lazy" />
              ) : (
                <div className="w-12 aspect-[63/88] bg-white/4 rounded shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{c.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="info">{c.rarity}</Badge>
                  <span className="text-[11px] text-text-muted">{c.coinValue} Coins</span>
                </div>
              </div>

              {isRecovered ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                    choice === "claim"
                      ? "bg-green-500/15 text-green-400"
                      : "bg-blue-500/15 text-blue-400"
                  }`}>
                    {choice === "claim" ? (
                      <><ShoppingCart className="h-3.5 w-3.5" /> {isDe ? "Warenkorb" : "Cart"}</>
                    ) : (
                      <><Coins className="h-3.5 w-3.5" /> {c.conversionValue}</>
                    )}
                    <span className="text-[10px] opacity-50">&#10003;</span>
                  </span>
                </div>
              ) : (
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setChoice(i, "claim")}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      choice === "claim"
                        ? "bg-green-500/15 text-green-400 border-green-500/30"
                        : "bg-white/4 text-text-muted border-border hover:bg-white/6"
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5 inline mr-1" />
                    {isDe ? "Warenkorb" : "Cart"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setChoice(i, "convert")}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      choice === "convert"
                        ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                        : "bg-white/4 text-text-muted border-border hover:bg-white/6"
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5 inline mr-1" />
                    {c.conversionValue}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      <div className="bg-white/4 border border-border rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex gap-4 text-sm">
            <span className="text-green-400">
              {claimedCount} {isDe ? "Warenkorb" : "Cart"}
            </span>
            <span className="text-blue-400">
              {convertedCount} {isDe ? "Umwandlungen" : "Converts"}
            </span>
            {coinsBack > 0 && (
              <span className="text-pa-green">+{coinsBack} Coins</span>
            )}
          </div>
          {!allDecided && (
            <span className="text-xs text-yellow-400">
              {isDe
                ? `Noch ${cards.length - claimedCount - convertedCount - recoveredIndices.size} offen`
                : `${cards.length - claimedCount - convertedCount - recoveredIndices.size} remaining`}
            </span>
          )}
        </div>
      </div>

      {/* Confirm button */}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={!allDecided}
        loading={submitting}
        onClick={() => void handleConfirm()}
      >
        {allDecided
          ? isDe ? "Bestätigen" : "Confirm"
          : isDe ? "Bitte alle Karten entscheiden" : "Please decide all cards"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint:fix
```

Fix any errors that appear. Common issues:
- `BoxInfo` now includes optional `image` field — the parent page already passes a full box object
- Ensure all imports resolve correctly

- [ ] **Step 3: Commit**

```bash
git add components/packs/pack-opening.tsx
git commit -m "feat(packs): refactor PackOpening with animation phases (idle, rip, reveal, review)"
```

---

## Task 10: Add Quick Open Button to Pack Detail Page

**Files:**
- Modify: `app/[lang]/(dashboard)/(pages)/packs/[id]/page.tsx`

- [ ] **Step 1: Add quickOpen state and button**

In the pack detail page, add a `quickOpen` state and pass it to `PackOpening`. Also add a second button for "Quick Open".

Find the `handleOpen` function and the area where `openResult` is set. The `PackOpening` component is rendered at line ~228. Add the `quickOpen` prop:

Find this block in the file:
```tsx
  if (openResult) {
    return (
      <PackOpening
        result={openResult}
        box={box}
        lang={lang}
```

Replace with:
```tsx
  if (openResult) {
    return (
      <PackOpening
        result={openResult}
        box={box}
        lang={lang}
        quickOpen={quickOpenRef.current}
```

Then add state near the other state declarations (around line 97):
```typescript
const quickOpenRef = useRef(false);
```

Add the import for `useRef` (already imported as `React` includes it, but ensure it's explicitly imported):
```typescript
import React, { useState, useEffect, useRef } from "react";
```

Find the "Open Pack" button in the JSX and add a Quick Open button next to it. Look for the button that calls `handleOpen()` and wrap it:

Replace the single open button with two buttons:
```tsx
<div className="flex gap-2">
  <Button
    variant="primary"
    size="lg"
    className="flex-1"
    disabled={!canAfford || opening}
    loading={opening}
    onClick={() => {
      quickOpenRef.current = false;
      void handleOpen();
    }}
  >
    <Package className="w-4 h-4 mr-1.5" />
    {isDe ? "Pack Offnen" : "Open Pack"}
  </Button>
  <Button
    variant="secondary"
    size="lg"
    disabled={!canAfford || opening}
    onClick={() => {
      quickOpenRef.current = true;
      void handleOpen();
    }}
  >
    {isDe ? "Schnell" : "Quick"}
  </Button>
</div>
```

- [ ] **Step 2: Verify typecheck + lint**

```bash
npm run typecheck && npm run lint:fix
```

- [ ] **Step 3: Commit**

```bash
git add "app/[lang]/(dashboard)/(pages)/packs/[id]/page.tsx"
git commit -m "feat(packs): add Quick Open button for skipping animation"
```

---

## Task 11: Add Placeholder Sound Files

**Files:**
- Create: `public/sounds/pack-rip.mp3`
- Create: `public/sounds/pack-burst.mp3`
- Create: `public/sounds/card-flip.mp3`
- Create: `public/sounds/card-shimmer.mp3`
- Create: `public/sounds/card-epic.mp3`
- Create: `public/sounds/card-legendary.mp3`

- [ ] **Step 1: Create silent placeholder MP3 files**

The sound hook gracefully handles missing files, so for now create tiny placeholder files. These will be replaced with actual sound effects later.

```bash
# Create minimal valid MP3 files (silent, ~200 bytes each)
# The simplest approach: copy an existing sound file and note they need replacement
ls public/sounds/
```

If existing sounds exist (like `chest-open.mp3`), note this task for manual completion. The sound hook will silently fail if files are missing, so the app works without them.

- [ ] **Step 2: Commit (if files were created)**

```bash
# Only if files exist:
git add public/sounds/pack-rip.mp3 public/sounds/pack-burst.mp3 public/sounds/card-flip.mp3 public/sounds/card-shimmer.mp3 public/sounds/card-epic.mp3 public/sounds/card-legendary.mp3
git commit -m "chore(packs): add placeholder sound files for pack opening"
```

---

## Task 12: End-to-End Verification

- [ ] **Step 1: Run full typecheck**

```bash
npm run typecheck
```

Expected: PASS with 0 errors.

- [ ] **Step 2: Run lint with fix**

```bash
npm run lint:fix
```

Expected: PASS with 0 errors, 0 warnings.

- [ ] **Step 3: Start dev server and test manually**

```bash
npm run dev
```

Test checklist:
1. Navigate to a pack detail page
2. Click "Open Pack" → should see 3D pack with mouse-tracking
3. Click pack → transitions to rip phase
4. Swipe up → pack rips open with particle explosion
5. Tap cards one by one → 3D flip with tier-appropriate effects
6. Make claim/convert choices → navigate to review
7. Confirm decisions → completes successfully
8. Test "Quick" button → should skip to review phase
9. Test on mobile viewport (Chrome DevTools responsive mode)
10. Test with `prefers-reduced-motion` enabled

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
npm run typecheck && npm run lint:fix
git add -A
git commit -m "fix(packs): address review issues from end-to-end testing"
```
