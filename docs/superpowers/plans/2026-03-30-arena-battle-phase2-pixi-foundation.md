# Arena Battle Phase 2: PixiJS Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up PixiJS 8 in the Next.js 16 app with SSR-safe dynamic import, create the arena scene tree with stadium background layers, build the BattleBridge that translates SSE events into scene actions, and integrate a custom tween utility for animations — replacing the temporary DOM-based clash UI with a canvas foundation.

**Architecture:** A single `<ArenaCanvas>` React component wraps the PixiJS entry point behind `dynamic({ ssr: false })`. The PixiJS `Application` is initialized in `arena-pixi.tsx`, which builds the layered scene tree (background → arena floor → battle center → player hand → effects → overlay). A `BattleBridge` class receives SSE event data from React state and dispatches scene updates. A lightweight ticker-based tween system handles all animations. All positions use relative units (0–1 range) scaled to canvas size for responsiveness.

**Tech Stack:** PixiJS 8.17.x, Next.js 16, React 19, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-30-arena-battle-cardgame-design.md` (sections: Arena Layout, PixiJS Scene Tree, Client-Side Architecture)

**Depends on:** Phase 1 (card selection mechanic) — must be complete.

---

## File Structure

### New Files
- `lib/arena-constants.ts` — Layout constants, hex colors, zone positions, sizes
- `components/arena/tween.ts` — Ticker-based tween engine with easing functions
- `components/arena/arena-pixi.tsx` — PixiJS Application init, scene tree, resize, cleanup (default export)
- `components/arena/arena-canvas.tsx` — SSR boundary: `dynamic(() => import("./arena-pixi"), { ssr: false })`
- `components/arena/battle-bridge.ts` — SSE event → scene action translator
- `components/arena/layers/background.ts` — Sky gradient + animated spotlight beams
- `components/arena/layers/arena-floor.ts` — Playing field + glowing railing separator
- `__tests__/lib/arena-constants.test.ts` — Constants validation
- `__tests__/components/arena/tween.test.ts` — Tween math tests

### Modified Files
- `package.json` — Add `pixi.js` dependency
- `components/battles/battle-view.tsx` — Render `<ArenaCanvas>` instead of `<BattleClash>` during clash phase

---

## Task 1: Install PixiJS 8 and Add Arena Constants

**Files:**
- Modify: `package.json`
- Create: `lib/arena-constants.ts`
- Test: `__tests__/lib/arena-constants.test.ts`

- [ ] **Step 1: Install PixiJS**

```bash
npm install pixi.js@^8.17
```

- [ ] **Step 2: Verify installation**

```bash
node -e "const p = require('pixi.js/package.json'); console.log(p.version)"
```

Expected: `8.17.x` (any 8.17+ version)

- [ ] **Step 3: Create arena constants**

Create `lib/arena-constants.ts`:

```typescript
// lib/arena-constants.ts
// All positions are in relative units (0–1) unless noted.
// Multiply by canvas width/height to get pixel values.

// --- Colors (hex for PixiJS) ---
export const ARENA_COLORS = {
  bg: 0x12111a,
  surface: 0x1a1924,
  surfaceElevated: 0x222131,
  paGreen: 0x9bff00,
  paGreenHover: 0x85dd00,
  paLila: 0x24043a,
  textPrimary: 0xc8c8d0,
  textSecondary: 0x8a8a96,
  textMuted: 0x6b6b78,
  // Player colors
  player1: 0x9bff00, // green (PA brand)
  player2: 0xff6b6b, // red
  player3: 0x64b5f6, // blue
  player4: 0xffd54f, // gold
  // Effect tier colors
  effectLow: 0xc8c8d0,
  effectMedium: 0x9bff00,
  effectHigh: 0xc864ff,
  effectExtreme: 0xffd54f,
  // Arena
  railingGreen: 0x9bff00,
  floorGlow: 0x9bff00,
  spotlightBeam: 0xffffff,
} as const;

// --- Player color lookup ---
export const PLAYER_COLORS = [
  ARENA_COLORS.player1,
  ARENA_COLORS.player2,
  ARENA_COLORS.player3,
  ARENA_COLORS.player4,
] as const;

// --- Zone layout (Y positions, relative 0–1) ---
export const ARENA_ZONES = {
  skyTop: 0,
  skyBottom: 0.18,
  standsTop: 0.04,
  standsBottom: 0.22,
  railingY: 0.24,
  floorTop: 0.26,
  floorBottom: 0.68,
  playerSlotsY: 0.55,
  battleCenterY: 0.42,
  handTop: 0.72,
  handBottom: 0.95,
  timerBarY: 0.96,
} as const;

// --- Sizes (relative) ---
export const ARENA_SIZES = {
  cardWidth: 0.08,
  cardHeight: 0.18,
  handCardWidth: 0.09,
  handCardHeight: 0.20,
  playerAvatarSize: 0.06,
  vsLabelSize: 0.04,
  spotlightWidth: 0.004,
  railingHeight: 0.005,
} as const;

// --- Player slot X positions by player count ---
export const PLAYER_POSITIONS: Record<number, number[]> = {
  2: [0.3, 0.7],
  3: [0.2, 0.5, 0.8],
  4: [0.15, 0.38, 0.62, 0.85],
};

// --- Animation timing (ms) ---
export const ARENA_TIMING = {
  spotlightCycleMs: 4000,
  spotlightFadeDuration: 0.3,
  railingPulseCycleMs: 3000,
  cardFlipMs: 400,
  cardLiftMs: 200,
  scorePopMs: 500,
  roundAnnounceZoomMs: 800,
  roundAnnounceFadeMs: 400,
  confettiDurationMs: 3000,
} as const;

// --- Canvas ---
export const ARENA_ASPECT_RATIO = 16 / 9;
export const ARENA_MIN_WIDTH = 640;
export const ARENA_MAX_WIDTH = 1920;
```

- [ ] **Step 4: Write constants validation test**

Create `__tests__/lib/arena-constants.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  ARENA_COLORS,
  ARENA_ZONES,
  ARENA_SIZES,
  PLAYER_POSITIONS,
  PLAYER_COLORS,
  ARENA_ASPECT_RATIO,
} from "@/lib/arena-constants";

describe("arena-constants", () => {
  it("has all player color entries", () => {
    expect(PLAYER_COLORS).toHaveLength(4);
  });

  it("has player positions for 2, 3, and 4 players", () => {
    expect(PLAYER_POSITIONS[2]).toHaveLength(2);
    expect(PLAYER_POSITIONS[3]).toHaveLength(3);
    expect(PLAYER_POSITIONS[4]).toHaveLength(4);
  });

  it("all player positions are between 0 and 1", () => {
    for (const positions of Object.values(PLAYER_POSITIONS)) {
      for (const pos of positions) {
        expect(pos).toBeGreaterThanOrEqual(0);
        expect(pos).toBeLessThanOrEqual(1);
      }
    }
  });

  it("zones are ordered top to bottom", () => {
    expect(ARENA_ZONES.skyTop).toBeLessThan(ARENA_ZONES.railingY);
    expect(ARENA_ZONES.railingY).toBeLessThan(ARENA_ZONES.floorTop);
    expect(ARENA_ZONES.floorTop).toBeLessThan(ARENA_ZONES.handTop);
  });

  it("aspect ratio is 16:9", () => {
    expect(ARENA_ASPECT_RATIO).toBeCloseTo(16 / 9);
  });

  it("colors are valid hex numbers", () => {
    for (const color of Object.values(ARENA_COLORS)) {
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThanOrEqual(0xffffff);
    }
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run __tests__/lib/arena-constants.test.ts --reporter=verbose
```

Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/arena-constants.ts __tests__/lib/arena-constants.test.ts
git commit -m "feat(arena): install PixiJS 8 and add arena layout constants"
```

---

## Task 2: Create Tween Utility

A lightweight ticker-based tween engine. No external dependency — just easing functions + a `TweenManager` that runs on the PixiJS ticker.

**Files:**
- Create: `components/arena/tween.ts`
- Test: `__tests__/components/arena/tween.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/components/arena/tween.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { easeOutCubic, easeInOutQuad, easeOutElastic, lerp, TweenManager } from "@/components/arena/tween";

describe("easing functions", () => {
  it("easeOutCubic starts at 0 and ends at 1", () => {
    expect(easeOutCubic(0)).toBeCloseTo(0);
    expect(easeOutCubic(1)).toBeCloseTo(1);
  });

  it("easeInOutQuad starts at 0 and ends at 1", () => {
    expect(easeInOutQuad(0)).toBeCloseTo(0);
    expect(easeInOutQuad(1)).toBeCloseTo(1);
  });

  it("easeOutElastic starts at 0 and ends at 1", () => {
    expect(easeOutElastic(0)).toBeCloseTo(0);
    expect(easeOutElastic(1)).toBeCloseTo(1);
  });

  it("easeOutCubic is monotonically increasing", () => {
    let prev = 0;
    for (let t = 0.1; t <= 1; t += 0.1) {
      const val = easeOutCubic(t);
      expect(val).toBeGreaterThanOrEqual(prev);
      prev = val;
    }
  });
});

describe("lerp", () => {
  it("returns start at t=0", () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it("returns end at t=1", () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it("returns midpoint at t=0.5", () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });
});

describe("TweenManager", () => {
  it("starts with no active tweens", () => {
    const tm = new TweenManager();
    expect(tm.activeCount).toBe(0);
  });

  it("adds a tween and tracks it", () => {
    const tm = new TweenManager();
    const target = { x: 0, y: 0 };
    tm.to(target, { x: 100 }, 1000);
    expect(tm.activeCount).toBe(1);
  });

  it("updates target values over time", () => {
    const tm = new TweenManager();
    const target = { x: 0 };
    tm.to(target, { x: 100 }, 1000);
    tm.update(500); // half duration
    expect(target.x).toBeGreaterThan(0);
    expect(target.x).toBeLessThan(100);
  });

  it("completes tween at full duration", () => {
    const tm = new TweenManager();
    const target = { x: 0 };
    tm.to(target, { x: 100 }, 1000);
    tm.update(1000);
    expect(target.x).toBeCloseTo(100);
    expect(tm.activeCount).toBe(0);
  });

  it("calls onComplete when tween finishes", () => {
    const tm = new TweenManager();
    const target = { x: 0 };
    let completed = false;
    tm.to(target, { x: 100 }, 500, { onComplete: () => { completed = true; } });
    tm.update(500);
    expect(completed).toBe(true);
  });

  it("killAll stops all tweens", () => {
    const tm = new TweenManager();
    tm.to({ x: 0 }, { x: 1 }, 1000);
    tm.to({ y: 0 }, { y: 1 }, 1000);
    expect(tm.activeCount).toBe(2);
    tm.killAll();
    expect(tm.activeCount).toBe(0);
  });

  it("killTarget stops tweens for specific target", () => {
    const tm = new TweenManager();
    const a = { x: 0 };
    const b = { y: 0 };
    tm.to(a, { x: 1 }, 1000);
    tm.to(b, { y: 1 }, 1000);
    tm.killTarget(a);
    expect(tm.activeCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run __tests__/components/arena/tween.test.ts --reporter=verbose
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement tween utility**

Create `components/arena/tween.ts`:

```typescript
// components/arena/tween.ts
// Lightweight ticker-based tween engine for PixiJS 8 animations.

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

export function easeLinear(t: number): number {
  return t;
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

type EasingFn = (t: number) => number;

interface ActiveTween {
  target: Record<string, number>;
  props: Array<{ key: string; from: number; to: number }>;
  duration: number;
  elapsed: number;
  easing: EasingFn;
  onComplete?: () => void;
  onUpdate?: () => void;
}

export class TweenManager {
  private tweens: ActiveTween[] = [];

  get activeCount(): number {
    return this.tweens.length;
  }

  /** Tween target's numeric properties to the given values over duration ms. */
  to(
    target: Record<string, number>,
    to: Record<string, number>,
    duration: number,
    opts?: { easing?: EasingFn; onComplete?: () => void; onUpdate?: () => void },
  ): void {
    const props = Object.keys(to).map((key) => ({
      key,
      from: target[key] ?? 0,
      to: to[key],
    }));
    this.tweens.push({
      target,
      props,
      duration: Math.max(1, duration),
      elapsed: 0,
      easing: opts?.easing ?? easeOutCubic,
      onComplete: opts?.onComplete,
      onUpdate: opts?.onUpdate,
    });
  }

  /** Call every frame with deltaMs (e.g., from ticker.deltaMS). */
  update(deltaMs: number): void {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.elapsed += deltaMs;
      const progress = Math.min(tw.elapsed / tw.duration, 1);
      const eased = tw.easing(progress);

      for (const prop of tw.props) {
        tw.target[prop.key] = lerp(prop.from, prop.to, eased);
      }

      tw.onUpdate?.();

      if (progress >= 1) {
        this.tweens.splice(i, 1);
        tw.onComplete?.();
      }
    }
  }

  /** Kill all tweens for a specific target object. */
  killTarget(target: Record<string, number>): void {
    this.tweens = this.tweens.filter((tw) => tw.target !== target);
  }

  /** Kill all active tweens. */
  killAll(): void {
    this.tweens = [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run __tests__/components/arena/tween.test.ts --reporter=verbose
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add components/arena/tween.ts __tests__/components/arena/tween.test.ts
git commit -m "feat(arena): add ticker-based tween utility with easing functions"
```

---

## Task 3: Create Background Layer

The background layer renders the sky gradient and animated spotlight beams.

**Files:**
- Create: `components/arena/layers/background.ts`

- [ ] **Step 1: Implement background layer**

Create `components/arena/layers/background.ts`:

```typescript
// components/arena/layers/background.ts
import { Container, Graphics } from "pixi.js";
import { ARENA_COLORS, ARENA_ZONES, ARENA_SIZES, ARENA_TIMING } from "@/lib/arena-constants";

export class BackgroundLayer extends Container {
  private skyGfx: Graphics;
  private spotlights: Graphics[] = [];
  private elapsed = 0;

  constructor() {
    super();
    this.skyGfx = new Graphics();
    this.addChild(this.skyGfx);

    // Create 3 spotlight beam graphics
    for (let i = 0; i < 3; i++) {
      const spot = new Graphics();
      spot.alpha = 0.08;
      this.addChild(spot);
      this.spotlights.push(spot);
    }
  }

  /** Redraw all graphics for current canvas dimensions. */
  resize(w: number, h: number): void {
    // Sky gradient (dark to slightly lighter)
    this.skyGfx.clear();
    this.skyGfx.rect(0, 0, w, h * ARENA_ZONES.railingY);
    this.skyGfx.fill(ARENA_COLORS.bg);

    // Lighter gradient band near stands
    this.skyGfx.rect(0, h * ARENA_ZONES.standsTop, w, h * (ARENA_ZONES.standsBottom - ARENA_ZONES.standsTop));
    this.skyGfx.fill({ color: ARENA_COLORS.surfaceElevated, alpha: 0.5 });

    // Redraw spotlights at new size
    this.drawSpotlights(w, h);
  }

  private drawSpotlights(w: number, h: number): void {
    const beamW = w * ARENA_SIZES.spotlightWidth;
    const positions = [0.25, 0.5, 0.75];

    for (let i = 0; i < this.spotlights.length; i++) {
      const spot = this.spotlights[i];
      spot.clear();

      const x = w * positions[i];
      // Narrow beam from top, widening downward
      spot.moveTo(x - beamW, 0);
      spot.lineTo(x + beamW, 0);
      spot.lineTo(x + beamW * 8, h * ARENA_ZONES.railingY);
      spot.lineTo(x - beamW * 8, h * ARENA_ZONES.railingY);
      spot.closePath();
      spot.fill({ color: ARENA_COLORS.spotlightBeam, alpha: 0.15 });
    }
  }

  /** Call every frame with deltaMs for spotlight animation. */
  update(deltaMs: number): void {
    this.elapsed += deltaMs;
    const cycle = ARENA_TIMING.spotlightCycleMs;

    for (let i = 0; i < this.spotlights.length; i++) {
      // Each spotlight pulses at different phase
      const phase = (this.elapsed / cycle + i * 0.33) % 1;
      this.spotlights[i].alpha = 0.04 + 0.06 * Math.sin(phase * Math.PI * 2);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/arena/layers/background.ts
git commit -m "feat(arena): add background layer with sky gradient and spotlights"
```

---

## Task 4: Create Arena Floor Layer

The arena floor with a dark playing field, subtle radial glow, and the glowing railing separator.

**Files:**
- Create: `components/arena/layers/arena-floor.ts`

- [ ] **Step 1: Implement arena floor layer**

Create `components/arena/layers/arena-floor.ts`:

```typescript
// components/arena/layers/arena-floor.ts
import { Container, Graphics } from "pixi.js";
import { ARENA_COLORS, ARENA_ZONES, ARENA_SIZES, ARENA_TIMING } from "@/lib/arena-constants";

export class ArenaFloorLayer extends Container {
  private floorGfx: Graphics;
  private railingGfx: Graphics;
  private glowGfx: Graphics;
  private elapsed = 0;

  constructor() {
    super();

    this.floorGfx = new Graphics();
    this.addChild(this.floorGfx);

    this.glowGfx = new Graphics();
    this.glowGfx.alpha = 0.15;
    this.addChild(this.glowGfx);

    this.railingGfx = new Graphics();
    this.addChild(this.railingGfx);
  }

  resize(w: number, h: number): void {
    const floorY = h * ARENA_ZONES.floorTop;
    const floorH = h * (ARENA_ZONES.handTop - ARENA_ZONES.floorTop);
    const railY = h * ARENA_ZONES.railingY;
    const railH = h * ARENA_SIZES.railingHeight;

    // Floor background
    this.floorGfx.clear();
    this.floorGfx.rect(0, floorY, w, floorH);
    this.floorGfx.fill(ARENA_COLORS.surface);

    // Center radial glow (ellipse)
    this.glowGfx.clear();
    this.glowGfx.ellipse(w / 2, h * ARENA_ZONES.battleCenterY, w * 0.3, h * 0.12);
    this.glowGfx.fill(ARENA_COLORS.floorGlow);

    // Railing (glowing horizontal line)
    this.railingGfx.clear();
    this.railingGfx.rect(0, railY, w, railH);
    this.railingGfx.fill(ARENA_COLORS.railingGreen);
  }

  update(deltaMs: number): void {
    this.elapsed += deltaMs;
    // Pulse the railing brightness
    const phase = (this.elapsed / ARENA_TIMING.railingPulseCycleMs) % 1;
    this.railingGfx.alpha = 0.6 + 0.4 * Math.sin(phase * Math.PI * 2);
    // Pulse the floor glow
    this.glowGfx.alpha = 0.10 + 0.08 * Math.sin(phase * Math.PI * 2 + 1);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/arena/layers/arena-floor.ts
git commit -m "feat(arena): add arena floor layer with railing and radial glow"
```

---

## Task 5: Create BattleBridge

The BattleBridge is the central coordinator that receives SSE event data (passed from React) and drives the PixiJS scene. In Phase 2, it wires up the foundation — later phases add game-specific event handling.

**Files:**
- Create: `components/arena/battle-bridge.ts`

- [ ] **Step 1: Implement BattleBridge**

Create `components/arena/battle-bridge.ts`:

```typescript
// components/arena/battle-bridge.ts
// Translates SSE battle events into PixiJS scene actions.
// React state changes → BattleBridge methods → layer updates.

import type { BackgroundLayer } from "./layers/background";
import type { ArenaFloorLayer } from "./layers/arena-floor";
import type { TweenManager } from "./tween";

export interface ArenaLayers {
  background: BackgroundLayer;
  arenaFloor: ArenaFloorLayer;
  // Future phases will add:
  // playerSlots: PlayerSlotsLayer;
  // battleCenter: BattleCenterLayer;
  // playerHand: PlayerHandLayer;
  // effects: EffectsLayer;
  // overlay: OverlayLayer;
}

export interface BattleState {
  status: string;
  currentRound: number;
  totalRounds: number;
  playerCount: number;
  isPlayer: boolean;
  currentUserId: string | null;
}

export class BattleBridge {
  private layers: ArenaLayers;
  private tweens: TweenManager;
  private state: BattleState;

  constructor(layers: ArenaLayers, tweens: TweenManager) {
    this.layers = layers;
    this.tweens = tweens;
    this.state = {
      status: "waiting",
      currentRound: 0,
      totalRounds: 0,
      playerCount: 2,
      isPlayer: false,
      currentUserId: null,
    };
  }

  /** Update battle state from React. Called when battle object changes. */
  updateState(state: Partial<BattleState>): void {
    Object.assign(this.state, state);
  }

  /** Resize all layers. */
  resize(w: number, h: number): void {
    this.layers.background.resize(w, h);
    this.layers.arenaFloor.resize(w, h);
  }

  /** Called every frame via app.ticker. */
  update(deltaMs: number): void {
    this.tweens.update(deltaMs);
    this.layers.background.update(deltaMs);
    this.layers.arenaFloor.update(deltaMs);
  }

  /** Cleanup all tweens. */
  destroy(): void {
    this.tweens.killAll();
  }

  // --- SSE Event Handlers (Phase 2: foundation only) ---
  // These will be expanded in Phase 3 with actual game logic.

  onRoundAnnounce(_data: { roundIndex: number; totalRounds: number }): void {
    // Phase 3: overlay zoom animation
  }

  onHandDealt(_data: { cards: unknown[] }): void {
    // Phase 3: show 5 cards at bottom
  }

  onPlayerSelected(_data: { userId: string }): void {
    // Phase 3: place face-down card in center
  }

  onCardsReveal(_data: { cards: unknown[] }): void {
    // Phase 3: flip all cards, trigger effects
  }

  onRoundResult(_data: { winnerId: string | null; isClose: boolean }): void {
    // Phase 3: highlight winner, animate scores
  }

  onBattleEnd(_data: { placements: unknown[] }): void {
    // Phase 3: podium scene, confetti
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/arena/battle-bridge.ts
git commit -m "feat(arena): add BattleBridge event-to-scene coordinator"
```

---

## Task 6: Create ArenaPixi (PixiJS Application + Scene Tree)

The main PixiJS module that initializes the Application, builds the scene tree from layers, hooks the ticker, and handles cleanup. This is the default export loaded by the dynamic import.

**Files:**
- Create: `components/arena/arena-pixi.tsx`

- [ ] **Step 1: Implement ArenaPixi**

Create `components/arena/arena-pixi.tsx`:

```typescript
// components/arena/arena-pixi.tsx
// PixiJS 8 Application setup with scene tree.
// Loaded via dynamic import (SSR: false) from arena-canvas.tsx.
"use client";

import { useEffect, useRef, useCallback } from "react";
import { Application } from "pixi.js";
import { ARENA_COLORS, ARENA_ASPECT_RATIO } from "@/lib/arena-constants";
import { TweenManager } from "./tween";
import { BattleBridge, type BattleState } from "./battle-bridge";
import { BackgroundLayer } from "./layers/background";
import { ArenaFloorLayer } from "./layers/arena-floor";

interface HandCard {
  index: number;
  card: string;
  coinValue: number;
  rarity: string;
  name: string;
  image: string;
}

interface PlayedCard {
  playerId: string;
  card: { _id: string; name: string; image: string };
  coinValue: number;
  rarity: string;
  effectTier: string;
}

export interface ArenaPixiProps {
  battle: {
    _id: string;
    status: string;
    currentRound: number;
    totalRounds: number;
    players: Array<{ user: { _id: string; name: string } }>;
  };
  isPlayer: boolean;
  currentUserId: string | null;
  // SSE-driven state
  roundAnnounce: { roundIndex: number; totalRounds?: number } | null;
  handCards: HandCard[] | null;
  selectedCardIndex: number | null;
  playersSelected: Set<string>;
  revealedPlayedCards: PlayedCard[] | null;
  roundResult: { winnerId: string | null; isClose: boolean } | null;
  onSelectCard: (cardIndex: number) => void;
}

export default function ArenaPixi(props: ArenaPixiProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const bridgeRef = useRef<BattleBridge | null>(null);

  // Initialize PixiJS Application
  const initApp = useCallback(async () => {
    if (!containerRef.current || appRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = Math.round(width / ARENA_ASPECT_RATIO);

    const app = new Application();
    await app.init({
      width,
      height,
      backgroundColor: ARENA_COLORS.bg,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    });

    container.appendChild(app.canvas);
    appRef.current = app;

    // Build scene tree
    const tweenManager = new TweenManager();
    const background = new BackgroundLayer();
    const arenaFloor = new ArenaFloorLayer();

    app.stage.addChild(background);
    app.stage.addChild(arenaFloor);

    // Create bridge
    const bridge = new BattleBridge(
      { background, arenaFloor },
      tweenManager,
    );
    bridgeRef.current = bridge;

    // Initial resize
    bridge.resize(width, height);

    // Ticker
    app.ticker.add(() => {
      bridge.update(app.ticker.deltaMS);
    });

    // Responsive resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = Math.round(w / ARENA_ASPECT_RATIO);
        app.renderer.resize(w, h);
        bridge.resize(w, h);
      }
    });
    resizeObserver.observe(container);

    // Store for cleanup
    (app as unknown as Record<string, unknown>).__resizeObserver = resizeObserver;
  }, []);

  // Init on mount, cleanup on unmount
  useEffect(() => {
    initApp();
    return () => {
      const app = appRef.current;
      if (app) {
        const observer = (app as unknown as Record<string, unknown>).__resizeObserver as ResizeObserver | undefined;
        observer?.disconnect();
        bridgeRef.current?.destroy();
        app.destroy(true, { children: true, texture: true, textureSource: true });
        appRef.current = null;
        bridgeRef.current = null;
      }
    };
  }, [initApp]);

  // Sync React state → BattleBridge
  useEffect(() => {
    bridgeRef.current?.updateState({
      status: props.battle.status,
      currentRound: props.battle.currentRound,
      totalRounds: props.battle.totalRounds,
      playerCount: props.battle.players.length,
      isPlayer: props.isPlayer,
      currentUserId: props.currentUserId,
    });
  }, [props.battle.status, props.battle.currentRound, props.battle.totalRounds, props.battle.players.length, props.isPlayer, props.currentUserId]);

  // Forward SSE events to bridge
  useEffect(() => {
    if (props.roundAnnounce) {
      bridgeRef.current?.onRoundAnnounce(props.roundAnnounce as { roundIndex: number; totalRounds: number });
    }
  }, [props.roundAnnounce]);

  useEffect(() => {
    if (props.handCards) {
      bridgeRef.current?.onHandDealt({ cards: props.handCards });
    }
  }, [props.handCards]);

  useEffect(() => {
    if (props.revealedPlayedCards) {
      bridgeRef.current?.onCardsReveal({ cards: props.revealedPlayedCards });
    }
  }, [props.revealedPlayedCards]);

  useEffect(() => {
    if (props.roundResult) {
      bridgeRef.current?.onRoundResult(props.roundResult);
    }
  }, [props.roundResult]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl border border-border bg-bg"
      style={{ aspectRatio: `${ARENA_ASPECT_RATIO}` }}
    />
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit components/arena/arena-pixi.tsx
```

Expected: No new errors (pre-existing path alias errors are OK)

- [ ] **Step 3: Commit**

```bash
git add components/arena/arena-pixi.tsx
git commit -m "feat(arena): add ArenaPixi component with Application + scene tree"
```

---

## Task 7: Create ArenaCanvas SSR Boundary

The thin React wrapper that uses `dynamic()` to prevent SSR crashes. This is the component that `battle-view.tsx` renders.

**Files:**
- Create: `components/arena/arena-canvas.tsx`

- [ ] **Step 1: Implement ArenaCanvas**

Create `components/arena/arena-canvas.tsx`:

```typescript
// components/arena/arena-canvas.tsx
// SSR boundary for PixiJS. All pixi imports are isolated behind this dynamic().
"use client";

import dynamic from "next/dynamic";
import type { ArenaPixiProps } from "./arena-pixi";

const ArenaPixi = dynamic(() => import("./arena-pixi"), { ssr: false });

export function ArenaCanvas(props: ArenaPixiProps) {
  return <ArenaPixi {...props} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add components/arena/arena-canvas.tsx
git commit -m "feat(arena): add ArenaCanvas SSR boundary with dynamic import"
```

---

## Task 8: Integrate ArenaCanvas into BattleView

Replace the `<BattleClash>` component with `<ArenaCanvas>` during the clash phase. Keep `<BattleClash>` as a fallback (it still works as the temporary DOM UI from Phase 1).

**Files:**
- Modify: `components/battles/battle-view.tsx`

- [ ] **Step 1: Add ArenaCanvas import**

At the top of `components/battles/battle-view.tsx`, add the import:

```typescript
import { ArenaCanvas } from "@/components/arena/arena-canvas";
```

- [ ] **Step 2: Replace BattleClash with ArenaCanvas in the render**

Find the section that renders `<BattleClash>` (the `{isClashing && (...)}` block). Replace it with `<ArenaCanvas>`, keeping the old `<BattleClash>` below it as a temporary DOM fallback for the card selection UI (since the PixiJS hand UI comes in Phase 3):

```tsx
{isClashing && (
  <>
    <ArenaCanvas
      battle={battle}
      isPlayer={isPlayer}
      currentUserId={currentUserId ?? null}
      roundAnnounce={roundAnnounce}
      handCards={handCards}
      selectedCardIndex={selectedCardIndex}
      playersSelected={playersSelected}
      revealedPlayedCards={revealedPlayedCards}
      roundResult={roundResult}
      onSelectCard={handleSelectCard}
    />
    {/* Temporary DOM card selection UI — replaced by PixiJS hand in Phase 3 */}
    <BattleClash
      battle={battle}
      currentRound={battle.currentRound}
      rounds={battle.rounds}
      players={battle.players}
      dict={dict}
      revealedCards={revealedCards}
      roundAnnounce={roundAnnounce}
      roundResult={roundResult}
      handCards={handCards}
      selectedCardIndex={selectedCardIndex}
      playersSelected={playersSelected}
      revealedPlayedCards={revealedPlayedCards}
      onSelectCard={handleSelectCard}
      isPlayer={isPlayer}
    />
  </>
)}
```

- [ ] **Step 3: Commit**

```bash
git add components/battles/battle-view.tsx
git commit -m "feat(arena): integrate ArenaCanvas into battle view alongside DOM fallback"
```

---

## Task 9: Smoke Test — Navigate to Battle Page

Manual verification that PixiJS loads without SSR crash and the canvas renders.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Navigate to a battle page**

Open a battle in the browser. During the clash phase, verify:
- The PixiJS canvas appears above the DOM card selection UI
- The canvas shows a dark background with pulsing spotlight beams
- The green railing line pulses
- The arena floor has a subtle green glow in the center
- The canvas maintains 16:9 aspect ratio
- Resizing the browser window causes the canvas to resize smoothly
- No console errors about `window is not defined` or SSR crashes

- [ ] **Step 3: Verify cleanup**

Navigate away from the battle page and back. Check the browser console for:
- No WebGL context leak warnings
- No "Application already destroyed" errors
- The canvas re-initializes cleanly on re-navigation

- [ ] **Step 4: Fix any issues and commit**

```bash
git add -A
git commit -m "fix(arena): address issues found during Phase 2 smoke test"
```

(Only if fixes are needed)

---

## Summary

| Task | What | Est. |
|------|------|------|
| 1 | Install PixiJS + arena constants | 5 min |
| 2 | Tween utility + tests | 10 min |
| 3 | Background layer (sky + spotlights) | 5 min |
| 4 | Arena floor layer (floor + railing) | 5 min |
| 5 | BattleBridge coordinator | 5 min |
| 6 | ArenaPixi (Application + scene tree) | 10 min |
| 7 | ArenaCanvas SSR boundary | 2 min |
| 8 | Integrate into BattleView | 5 min |
| 9 | Smoke test | 10 min |
| **Total** | | **~57 min** |
