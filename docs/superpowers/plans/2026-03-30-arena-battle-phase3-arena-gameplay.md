# Arena Battle Phase 3: Arena Gameplay in PixiJS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full interactive battle experience inside the PixiJS canvas: player slots with names/scores, interactive 5-card hand with timer bar, face-down card placement in battle center, simultaneous card reveal with coin-value effects, round announcements, winner highlight, countdown sequence, and podium scene — then remove the temporary DOM-based clash UI.

**Architecture:** Each visual zone is a self-contained layer class (extends `Container`) that exposes `resize(w, h)` and `update(deltaMs)`. The `BattleBridge` receives SSE events from React and orchestrates layer methods + tweens to produce the animations. Card images are loaded from external URLs via `Assets.load()`. Interaction events (card clicks) bubble up through a callback to React's `onSelectCard`. All coordinates use relative units (0–1) multiplied by canvas size.

**Tech Stack:** PixiJS 8.17.x, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-30-arena-battle-cardgame-design.md` (sections: Game Flow Phase 3–6, Visual Effects by Coin Value, Timer & Simultaneous Play)

**Depends on:** Phase 2 (PixiJS foundation) — must be complete.

---

## File Structure

### New Files
- `components/arena/layers/player-slots.ts` — Player positions with name + score labels
- `components/arena/layers/battle-center.ts` — VS label, round counter, played cards zone
- `components/arena/layers/player-hand.ts` — 5 interactive card sprites + timer bar
- `components/arena/layers/overlay.ts` — Countdown, round announcements, winner badge
- `components/arena/layers/effects.ts` — Particle system for coin-value effects
- `components/arena/card-sprite.ts` — Reusable card display object (face-up/down, flip animation)

### Modified Files
- `components/arena/battle-bridge.ts` — Wire up all SSE event handlers to new layers
- `components/arena/arena-pixi.tsx` — Add new layers to scene tree, pass `onSelectCard` callback
- `components/battles/battle-view.tsx` — Remove `<BattleClash>` DOM fallback, keep only `<ArenaCanvas>`
- `lib/arena-constants.ts` — Add card-specific layout constants

---

## Task 1: Add Card and UI Layout Constants

**Files:**
- Modify: `lib/arena-constants.ts`

- [ ] **Step 1: Add card layout and effect constants**

Add these constants to `lib/arena-constants.ts` after the existing `ARENA_TIMING` block:

```typescript
// --- Card layout ---
export const CARD_LAYOUT = {
  // Hand cards (bottom of screen, interactive)
  handY: 0.78,
  handCardGap: 0.02,      // gap between cards in hand
  handCardLiftY: -0.04,   // Y offset when card is selected (lifts up)

  // Battle center (played cards)
  centerY: 0.42,
  centerCardGap: 0.04,    // gap between played cards in center

  // Face-down card (when placed in center before reveal)
  faceDownScale: 0.85,

  // Card dimensions in canvas-relative units
  cardW: 0.08,
  cardH: 0.17,
  handCardW: 0.09,
  handCardH: 0.19,
} as const;

// --- Timer bar ---
export const TIMER_BAR = {
  y: 0.95,
  height: 0.012,
  width: 0.5,             // centered, 50% of canvas width
  bgColor: 0x2d2c3d,
  fillColor: 0x9bff00,
  warnColor: 0xff6b6b,    // turns red below 25%
} as const;

// --- VS label ---
export const VS_LABEL = {
  y: 0.38,
  fontSize: 0.05,         // relative to canvas height
  color: 0xffffff,
} as const;

// --- Round announce overlay ---
export const ROUND_ANNOUNCE = {
  bgAlpha: 0.85,
  numberFontSize: 0.15,   // relative to canvas height
  labelFontSize: 0.03,
  durationMs: 2500,
  zoomInMs: 300,
  holdMs: 1800,
  fadeOutMs: 400,
} as const;

// --- Effect tiers (particle counts and intensities) ---
export const EFFECT_TIERS = {
  low:     { particles: 0,  shake: 0,   glowAlpha: 0,    confetti: false },
  medium:  { particles: 8,  shake: 0,   glowAlpha: 0.15, confetti: false },
  high:    { particles: 20, shake: 3,   glowAlpha: 0.3,  confetti: false },
  extreme: { particles: 50, shake: 8,   glowAlpha: 0.5,  confetti: true  },
} as const;

// --- Podium ---
export const PODIUM = {
  firstY: 0.45,
  secondY: 0.52,
  thirdY: 0.58,
  avatarSize: 0.08,
  labelFontSize: 0.025,
  eloFontSize: 0.02,
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add lib/arena-constants.ts
git commit -m "feat(arena): add card layout, timer, overlay, and effect constants"
```

---

## Task 2: Create CardSprite (Reusable Card Display Object)

A reusable display object that can show a card face-up (with image, name, value) or face-down (with a back design), and animate flipping between them. Used in both the hand and battle center.

**Files:**
- Create: `components/arena/card-sprite.ts`

- [ ] **Step 1: Implement CardSprite**

Create `components/arena/card-sprite.ts`:

```typescript
// components/arena/card-sprite.ts
import { Container, Graphics, Text, Sprite, Assets } from "pixi.js";
import { ARENA_COLORS } from "@/lib/arena-constants";
import { type TweenManager, easeOutCubic } from "./tween";

export interface CardData {
  index: number;
  card: string;       // card ID or image URL
  coinValue: number;
  rarity: string;
  name: string;
  image: string;
}

export class CardSprite extends Container {
  private cardW: number;
  private cardH: number;
  private backGfx: Graphics;
  private frontContainer: Container;
  private borderGfx: Graphics;
  private valueLabel: Text;
  private nameLabel: Text;
  private imageSprite: Sprite | null = null;
  private _faceUp = false;
  private _data: CardData | null = null;
  private _borderColor = ARENA_COLORS.paLila;

  constructor(cardW: number, cardH: number) {
    super();
    this.cardW = cardW;
    this.cardH = cardH;

    // Border (drawn behind everything)
    this.borderGfx = new Graphics();
    this.addChild(this.borderGfx);

    // Back face
    this.backGfx = new Graphics();
    this.addChild(this.backGfx);

    // Front face container (hidden initially)
    this.frontContainer = new Container();
    this.frontContainer.visible = false;
    this.addChild(this.frontContainer);

    // Value label on front
    this.valueLabel = new Text({
      text: "",
      style: {
        fontFamily: "monospace",
        fontSize: Math.round(cardH * 0.18),
        fill: ARENA_COLORS.paGreen,
        fontWeight: "bold",
        align: "center",
      },
    });
    this.valueLabel.anchor.set(0.5);
    this.valueLabel.x = cardW / 2;
    this.valueLabel.y = cardH * 0.55;
    this.frontContainer.addChild(this.valueLabel);

    // Name label on front
    this.nameLabel = new Text({
      text: "",
      style: {
        fontFamily: "monospace",
        fontSize: Math.round(cardH * 0.09),
        fill: ARENA_COLORS.textSecondary,
        align: "center",
        wordWrap: true,
        wordWrapWidth: cardW - 4,
      },
    });
    this.nameLabel.anchor.set(0.5);
    this.nameLabel.x = cardW / 2;
    this.nameLabel.y = cardH * 0.82;
    this.frontContainer.addChild(this.nameLabel);

    this.drawBack();
    this.drawBorder(ARENA_COLORS.paLila);
  }

  private drawBack(): void {
    this.backGfx.clear();
    // Card back — dark with subtle pattern
    this.backGfx.roundRect(2, 2, this.cardW - 4, this.cardH - 4, 6);
    this.backGfx.fill(ARENA_COLORS.surface);
    // Center emblem
    this.backGfx.circle(this.cardW / 2, this.cardH / 2, this.cardW * 0.2);
    this.backGfx.fill({ color: ARENA_COLORS.paLila, alpha: 0.4 });
  }

  private drawBorder(color: number): void {
    this._borderColor = color;
    this.borderGfx.clear();
    this.borderGfx.roundRect(0, 0, this.cardW, this.cardH, 8);
    this.borderGfx.fill({ color: ARENA_COLORS.bg, alpha: 0.8 });
    this.borderGfx.roundRect(0, 0, this.cardW, this.cardH, 8);
    this.borderGfx.stroke({ color, width: 2, alpha: 0.7 });
  }

  /** Set card data and optionally show face-up. */
  setCard(data: CardData, faceUp = false): void {
    this._data = data;
    this.valueLabel.text = `${Math.round(data.coinValue)}`;
    this.nameLabel.text = data.name;
    if (faceUp) this.showFront();
    else this.showBack();
    this.loadImage(data.image);
  }

  private async loadImage(url: string): Promise<void> {
    if (!url) return;
    try {
      const texture = await Assets.load(url);
      if (this.imageSprite) {
        this.frontContainer.removeChild(this.imageSprite);
      }
      this.imageSprite = new Sprite(texture);
      this.imageSprite.width = this.cardW - 8;
      this.imageSprite.height = this.cardH * 0.45;
      this.imageSprite.x = 4;
      this.imageSprite.y = 4;
      this.frontContainer.addChildAt(this.imageSprite, 0);
    } catch {
      // Image load failed — show without image
    }
  }

  showFront(): void {
    this._faceUp = true;
    this.backGfx.visible = false;
    this.frontContainer.visible = true;
  }

  showBack(): void {
    this._faceUp = false;
    this.backGfx.visible = true;
    this.frontContainer.visible = false;
  }

  get isFaceUp(): boolean {
    return this._faceUp;
  }

  get data(): CardData | null {
    return this._data;
  }

  /** Animate flip from back to front using scale.x squeeze. */
  animateFlip(tweens: TweenManager, durationMs: number, onComplete?: () => void): void {
    // Squeeze to 0
    tweens.to(this.scale, { x: 0 }, durationMs / 2, {
      easing: easeOutCubic,
      onComplete: () => {
        this.showFront();
        // Expand back out
        tweens.to(this.scale, { x: 1 }, durationMs / 2, {
          easing: easeOutCubic,
          onComplete,
        });
      },
    });
  }

  /** Set border color (e.g., player color or effect tier). */
  setBorderColor(color: number): void {
    this.drawBorder(color);
  }

  /** Set glow effect for high-value cards. */
  setGlow(alpha: number, color: number): void {
    this.borderGfx.clear();
    this.borderGfx.roundRect(-4, -4, this.cardW + 8, this.cardH + 8, 10);
    this.borderGfx.fill({ color, alpha: alpha * 0.3 });
    this.borderGfx.roundRect(0, 0, this.cardW, this.cardH, 8);
    this.borderGfx.fill({ color: ARENA_COLORS.bg, alpha: 0.8 });
    this.borderGfx.roundRect(0, 0, this.cardW, this.cardH, 8);
    this.borderGfx.stroke({ color, width: 2, alpha: 0.9 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/arena/card-sprite.ts
git commit -m "feat(arena): add reusable CardSprite with flip animation"
```

---

## Task 3: Create Player Slots Layer

Shows player positions on the arena floor with name labels, score counters, and player-colored borders. Scores animate when updated.

**Files:**
- Create: `components/arena/layers/player-slots.ts`

- [ ] **Step 1: Implement PlayerSlotsLayer**

Create `components/arena/layers/player-slots.ts`:

```typescript
// components/arena/layers/player-slots.ts
import { Container, Graphics, Text } from "pixi.js";
import {
  ARENA_COLORS,
  ARENA_ZONES,
  PLAYER_POSITIONS,
  PLAYER_COLORS,
} from "@/lib/arena-constants";
import type { TweenManager } from "../tween";
import { easeOutElastic } from "../tween";

interface PlayerData {
  userId: string;
  name: string;
  score: number;
  color: number;
}

class PlayerSlot extends Container {
  private bgGfx: Graphics;
  private nameLabel: Text;
  private scoreLabel: Text;
  private _score = 0;
  private _color: number;
  userId: string;

  constructor(userId: string, name: string, color: number) {
    super();
    this.userId = userId;
    this._color = color;

    this.bgGfx = new Graphics();
    this.addChild(this.bgGfx);

    this.nameLabel = new Text({
      text: name,
      style: {
        fontFamily: "monospace",
        fontSize: 14,
        fill: ARENA_COLORS.textPrimary,
        fontWeight: "bold",
        align: "center",
      },
    });
    this.nameLabel.anchor.set(0.5);
    this.addChild(this.nameLabel);

    this.scoreLabel = new Text({
      text: "0",
      style: {
        fontFamily: "monospace",
        fontSize: 24,
        fill: color,
        fontWeight: "bold",
        align: "center",
      },
    });
    this.scoreLabel.anchor.set(0.5);
    this.addChild(this.scoreLabel);
  }

  resize(slotW: number, slotH: number): void {
    this.bgGfx.clear();
    this.bgGfx.roundRect(-slotW / 2, -slotH / 2, slotW, slotH, 8);
    this.bgGfx.fill({ color: ARENA_COLORS.surface, alpha: 0.7 });
    this.bgGfx.roundRect(-slotW / 2, -slotH / 2, slotW, slotH, 8);
    this.bgGfx.stroke({ color: this._color, width: 2, alpha: 0.5 });

    this.nameLabel.y = -slotH / 2 + 16;
    this.nameLabel.style.fontSize = Math.max(10, Math.round(slotH * 0.15));

    this.scoreLabel.y = slotH / 2 - 20;
    this.scoreLabel.style.fontSize = Math.max(16, Math.round(slotH * 0.25));
  }

  updateScore(score: number, tweens: TweenManager): void {
    if (score === this._score) return;
    this._score = score;
    this.scoreLabel.text = String(score);
    // Pop animation
    tweens.to(this.scoreLabel.scale, { x: 1.5, y: 1.5 }, 200, {
      easing: easeOutElastic,
      onComplete: () => {
        tweens.to(this.scoreLabel.scale, { x: 1, y: 1 }, 300);
      },
    });
  }

  /** Flash the border for winner highlight. */
  highlightWinner(tweens: TweenManager): void {
    tweens.to(this.scale, { x: 1.1, y: 1.1 }, 300, {
      easing: easeOutElastic,
      onComplete: () => {
        tweens.to(this.scale, { x: 1, y: 1 }, 500);
      },
    });
  }
}

export class PlayerSlotsLayer extends Container {
  private slots: PlayerSlot[] = [];
  private playerCount = 0;

  /** Initialize slots for the given players. Call once at battle start. */
  setPlayers(players: Array<{ userId: string; name: string }>): void {
    // Remove existing
    for (const slot of this.slots) this.removeChild(slot);
    this.slots = [];
    this.playerCount = players.length;

    for (let i = 0; i < players.length; i++) {
      const slot = new PlayerSlot(
        players[i].userId,
        players[i].name,
        PLAYER_COLORS[i] ?? ARENA_COLORS.textPrimary,
      );
      this.addChild(slot);
      this.slots.push(slot);
    }
  }

  resize(w: number, h: number): void {
    const positions = PLAYER_POSITIONS[this.playerCount] ?? PLAYER_POSITIONS[2];
    const slotW = w * 0.12;
    const slotH = h * 0.12;

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      slot.x = w * (positions[i] ?? 0.5);
      slot.y = h * ARENA_ZONES.playerSlotsY;
      slot.resize(slotW, slotH);
    }
  }

  updateScores(scores: Record<string, number>, tweens: TweenManager): void {
    for (const slot of this.slots) {
      const score = scores[slot.userId];
      if (score !== undefined) {
        slot.updateScore(score, tweens);
      }
    }
  }

  highlightWinner(userId: string, tweens: TweenManager): void {
    const slot = this.slots.find((s) => s.userId === userId);
    slot?.highlightWinner(tweens);
  }

  getSlotPosition(userId: string): { x: number; y: number } | null {
    const slot = this.slots.find((s) => s.userId === userId);
    return slot ? { x: slot.x, y: slot.y } : null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/arena/layers/player-slots.ts
git commit -m "feat(arena): add player slots layer with score animations"
```

---

## Task 4: Create Battle Center Layer

The central zone where played cards appear face-down (waiting), then flip face-up simultaneously during reveal. Includes the VS label and round counter.

**Files:**
- Create: `components/arena/layers/battle-center.ts`

- [ ] **Step 1: Implement BattleCenterLayer**

Create `components/arena/layers/battle-center.ts`:

```typescript
// components/arena/layers/battle-center.ts
import { Container, Text } from "pixi.js";
import {
  ARENA_COLORS,
  PLAYER_COLORS,
  PLAYER_POSITIONS,
  CARD_LAYOUT,
  VS_LABEL,
} from "@/lib/arena-constants";
import { CardSprite, type CardData } from "../card-sprite";
import type { TweenManager } from "../tween";
import { easeOutCubic } from "../tween";
import { ARENA_TIMING } from "@/lib/arena-constants";

export class BattleCenterLayer extends Container {
  private vsLabel: Text;
  private roundLabel: Text;
  private playedCards: CardSprite[] = [];
  private playerCount = 2;
  private canvasW = 0;
  private canvasH = 0;

  constructor() {
    super();

    this.vsLabel = new Text({
      text: "VS",
      style: {
        fontFamily: "monospace",
        fontSize: 32,
        fill: ARENA_COLORS.textMuted,
        fontWeight: "bold",
        align: "center",
      },
    });
    this.vsLabel.anchor.set(0.5);
    this.vsLabel.alpha = 0.4;
    this.addChild(this.vsLabel);

    this.roundLabel = new Text({
      text: "",
      style: {
        fontFamily: "monospace",
        fontSize: 14,
        fill: ARENA_COLORS.textSecondary,
        align: "center",
      },
    });
    this.roundLabel.anchor.set(0.5);
    this.addChild(this.roundLabel);
  }

  setPlayerCount(count: number): void {
    this.playerCount = count;
  }

  resize(w: number, h: number): void {
    this.canvasW = w;
    this.canvasH = h;

    this.vsLabel.x = w / 2;
    this.vsLabel.y = h * VS_LABEL.y;
    this.vsLabel.style.fontSize = Math.round(h * VS_LABEL.fontSize);

    this.roundLabel.x = w / 2;
    this.roundLabel.y = h * VS_LABEL.y - h * 0.06;
    this.roundLabel.style.fontSize = Math.round(h * 0.018);

    // Reposition any existing played cards
    this.positionPlayedCards();
  }

  setRound(current: number, total: number): void {
    this.roundLabel.text = `RUNDE ${current + 1} / ${total}`;
  }

  /** Place a face-down card in center for a player who has selected. */
  placeCard(playerIndex: number, tweens: TweenManager): void {
    const cardW = this.canvasW * CARD_LAYOUT.cardW;
    const cardH = this.canvasH * CARD_LAYOUT.cardH;
    const card = new CardSprite(cardW, cardH);
    card.setBorderColor(PLAYER_COLORS[playerIndex] ?? ARENA_COLORS.textMuted);

    // Start from below, animate up
    const targetPos = this.getCardPosition(playerIndex);
    card.x = targetPos.x;
    card.y = targetPos.y + 60;
    card.alpha = 0;
    this.addChild(card);
    this.playedCards.push(card);

    tweens.to(card, { y: targetPos.y, alpha: 1 }, 400, { easing: easeOutCubic });
  }

  /** Reveal all played cards with their actual data and trigger effects. */
  revealCards(
    cards: Array<{ playerIndex: number; data: CardData; effectTier: string }>,
    tweens: TweenManager,
    onAllRevealed?: () => void,
  ): void {
    // Clear existing played cards, create new ones with data
    this.clearPlayedCards();

    const cardW = this.canvasW * CARD_LAYOUT.cardW;
    const cardH = this.canvasH * CARD_LAYOUT.cardH;
    let revealedCount = 0;

    for (const entry of cards) {
      const card = new CardSprite(cardW, cardH);
      card.setCard(entry.data, false); // start face-down
      card.setBorderColor(PLAYER_COLORS[entry.playerIndex] ?? ARENA_COLORS.textMuted);

      const pos = this.getCardPosition(entry.playerIndex);
      card.x = pos.x;
      card.y = pos.y;
      this.addChild(card);
      this.playedCards.push(card);

      // Flip with slight stagger
      const delay = entry.playerIndex * 50;
      setTimeout(() => {
        card.animateFlip(tweens, ARENA_TIMING.cardFlipMs, () => {
          // Apply effect tier glow
          const color = entry.effectTier === "extreme" ? ARENA_COLORS.effectExtreme
            : entry.effectTier === "high" ? ARENA_COLORS.effectHigh
            : entry.effectTier === "medium" ? ARENA_COLORS.effectMedium
            : ARENA_COLORS.textMuted;
          if (entry.effectTier !== "low") {
            card.setGlow(0.4, color);
          }
          revealedCount++;
          if (revealedCount === cards.length) {
            onAllRevealed?.();
          }
        });
      }, delay);
    }
  }

  /** Highlight the winning card. */
  highlightWinner(playerIndex: number, tweens: TweenManager): void {
    for (let i = 0; i < this.playedCards.length; i++) {
      const card = this.playedCards[i];
      if (i === playerIndex) {
        // Winner card scales up
        tweens.to(card.scale, { x: 1.15, y: 1.15 }, 400);
      } else {
        // Loser cards fade
        tweens.to(card, { alpha: 0.4 }, 400);
      }
    }
  }

  clearPlayedCards(): void {
    for (const card of this.playedCards) {
      this.removeChild(card);
      card.destroy();
    }
    this.playedCards = [];
  }

  private getCardPosition(playerIndex: number): { x: number; y: number } {
    const positions = PLAYER_POSITIONS[this.playerCount] ?? PLAYER_POSITIONS[2];
    const xPos = positions[playerIndex] ?? 0.5;
    return {
      x: this.canvasW * xPos - (this.canvasW * CARD_LAYOUT.cardW) / 2,
      y: this.canvasH * CARD_LAYOUT.centerY - (this.canvasH * CARD_LAYOUT.cardH) / 2,
    };
  }

  private positionPlayedCards(): void {
    for (let i = 0; i < this.playedCards.length; i++) {
      const pos = this.getCardPosition(i);
      this.playedCards[i].x = pos.x;
      this.playedCards[i].y = pos.y;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/arena/layers/battle-center.ts
git commit -m "feat(arena): add battle center layer with card placement and reveal"
```

---

## Task 5: Create Player Hand Layer

The interactive 5-card hand at the bottom of the screen. Only visible to the active player. Cards can be clicked to select. Includes a timer bar that depletes over 20 seconds.

**Files:**
- Create: `components/arena/layers/player-hand.ts`

- [ ] **Step 1: Implement PlayerHandLayer**

Create `components/arena/layers/player-hand.ts`:

```typescript
// components/arena/layers/player-hand.ts
import { Container, Graphics } from "pixi.js";
import {
  ARENA_COLORS,
  CARD_LAYOUT,
  TIMER_BAR,
} from "@/lib/arena-constants";
import { SELECTION_TIMEOUT_MS } from "@/lib/battle-constants";
import { CardSprite, type CardData } from "../card-sprite";
import type { TweenManager } from "../tween";
import { easeOutCubic } from "../tween";

export class PlayerHandLayer extends Container {
  private cards: CardSprite[] = [];
  private timerBg: Graphics;
  private timerFill: Graphics;
  private selectedIndex: number | null = null;
  private timerStartMs: number | null = null;
  private canvasW = 0;
  private canvasH = 0;
  private _onSelectCard: ((index: number) => void) | null = null;

  constructor() {
    super();

    this.timerBg = new Graphics();
    this.addChild(this.timerBg);

    this.timerFill = new Graphics();
    this.addChild(this.timerFill);
  }

  set onSelectCard(cb: ((index: number) => void) | null) {
    this._onSelectCard = cb;
  }

  resize(w: number, h: number): void {
    this.canvasW = w;
    this.canvasH = h;
    this.drawTimerBar(1);
    this.positionCards();
  }

  /** Deal a new hand of cards. Triggers flip-in animation. */
  dealHand(cardData: CardData[], tweens: TweenManager): void {
    this.clearHand();
    this.selectedIndex = null;
    this.timerStartMs = Date.now();

    const cardW = this.canvasW * CARD_LAYOUT.handCardW;
    const cardH = this.canvasH * CARD_LAYOUT.handCardH;

    for (let i = 0; i < cardData.length; i++) {
      const card = new CardSprite(cardW, cardH);
      card.setCard(cardData[i], false); // start face-down

      // Position from center
      const pos = this.getCardPosition(i, cardData.length);
      card.x = pos.x;
      card.y = pos.y + 40; // start below
      card.alpha = 0;

      // Make interactive
      card.eventMode = "static";
      card.cursor = "pointer";
      const idx = i;
      card.on("pointerdown", () => this.onCardClick(idx, tweens));

      this.addChild(card);
      this.cards.push(card);

      // Animate in with stagger
      tweens.to(card, { y: pos.y, alpha: 1 }, 300 + i * 80, {
        easing: easeOutCubic,
        onComplete: () => {
          // Flip to show face
          card.animateFlip(tweens, 300);
        },
      });
    }
  }

  private onCardClick(index: number, tweens: TweenManager): void {
    if (this.selectedIndex !== null) return; // already selected
    this.selectedIndex = index;

    // Lift selected card
    const card = this.cards[index];
    const liftY = this.canvasH * CARD_LAYOUT.handCardLiftY;
    tweens.to(card, { y: card.y + liftY }, 200, { easing: easeOutCubic });
    card.setBorderColor(ARENA_COLORS.paGreen);

    // Dim other cards
    for (let i = 0; i < this.cards.length; i++) {
      if (i !== index) {
        tweens.to(this.cards[i], { alpha: 0.3 }, 200);
        this.cards[i].eventMode = "none";
      }
    }

    // Disable further clicks
    card.eventMode = "none";

    // Notify React
    this._onSelectCard?.(index);
  }

  /** Mark a card as selected from external source (e.g., timeout auto-select). */
  setSelectedIndex(index: number): void {
    this.selectedIndex = index;
  }

  clearHand(): void {
    for (const card of this.cards) {
      this.removeChild(card);
      card.destroy();
    }
    this.cards = [];
    this.selectedIndex = null;
    this.timerStartMs = null;
    this.drawTimerBar(1);
  }

  /** Call every frame to update the timer bar. */
  update(_deltaMs: number): void {
    if (this.timerStartMs === null) return;
    const elapsed = Date.now() - this.timerStartMs;
    const remaining = Math.max(0, 1 - elapsed / SELECTION_TIMEOUT_MS);
    this.drawTimerBar(remaining);

    if (remaining <= 0) {
      this.timerStartMs = null; // stop updating
    }
  }

  private drawTimerBar(progress: number): void {
    const barW = this.canvasW * TIMER_BAR.width;
    const barH = this.canvasH * TIMER_BAR.height;
    const barX = (this.canvasW - barW) / 2;
    const barY = this.canvasH * TIMER_BAR.y;

    // Background
    this.timerBg.clear();
    this.timerBg.roundRect(barX, barY, barW, barH, barH / 2);
    this.timerBg.fill(TIMER_BAR.bgColor);

    // Fill
    this.timerFill.clear();
    if (progress > 0) {
      const fillColor = progress < 0.25 ? TIMER_BAR.warnColor : TIMER_BAR.fillColor;
      this.timerFill.roundRect(barX, barY, barW * progress, barH, barH / 2);
      this.timerFill.fill(fillColor);
    }
  }

  private getCardPosition(index: number, total: number): { x: number; y: number } {
    const cardW = this.canvasW * CARD_LAYOUT.handCardW;
    const gap = this.canvasW * CARD_LAYOUT.handCardGap;
    const totalW = total * cardW + (total - 1) * gap;
    const startX = (this.canvasW - totalW) / 2;

    return {
      x: startX + index * (cardW + gap),
      y: this.canvasH * CARD_LAYOUT.handY,
    };
  }

  private positionCards(): void {
    for (let i = 0; i < this.cards.length; i++) {
      const pos = this.getCardPosition(i, this.cards.length);
      this.cards[i].x = pos.x;
      this.cards[i].y = pos.y;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/arena/layers/player-hand.ts
git commit -m "feat(arena): add interactive player hand layer with timer bar"
```

---

## Task 6: Create Overlay Layer

Handles round announcements ("RUNDE X VON Y" zoom-in text), countdown sequence ("3-2-1-FIGHT!"), and winner badge display.

**Files:**
- Create: `components/arena/layers/overlay.ts`

- [ ] **Step 1: Implement OverlayLayer**

Create `components/arena/layers/overlay.ts`:

```typescript
// components/arena/layers/overlay.ts
import { Container, Graphics, Text } from "pixi.js";
import { ARENA_COLORS, ROUND_ANNOUNCE } from "@/lib/arena-constants";
import type { TweenManager } from "../tween";
import { easeOutCubic, easeOutElastic } from "../tween";

export class OverlayLayer extends Container {
  private bgOverlay: Graphics;
  private mainText: Text;
  private subText: Text;
  private canvasW = 0;
  private canvasH = 0;

  constructor() {
    super();
    this.visible = false;

    // Semi-transparent background
    this.bgOverlay = new Graphics();
    this.addChild(this.bgOverlay);

    // Large center text (round number, countdown number, "FIGHT!")
    this.mainText = new Text({
      text: "",
      style: {
        fontFamily: "monospace",
        fontSize: 80,
        fill: ARENA_COLORS.paGreen,
        fontWeight: "bold",
        align: "center",
      },
    });
    this.mainText.anchor.set(0.5);
    this.addChild(this.mainText);

    // Subtitle ("RUNDE", "VON X", etc.)
    this.subText = new Text({
      text: "",
      style: {
        fontFamily: "monospace",
        fontSize: 18,
        fill: ARENA_COLORS.textSecondary,
        fontWeight: "bold",
        align: "center",
        letterSpacing: 4,
      },
    });
    this.subText.anchor.set(0.5);
    this.addChild(this.subText);
  }

  resize(w: number, h: number): void {
    this.canvasW = w;
    this.canvasH = h;

    this.bgOverlay.clear();
    this.bgOverlay.rect(0, 0, w, h);
    this.bgOverlay.fill({ color: ARENA_COLORS.bg, alpha: ROUND_ANNOUNCE.bgAlpha });

    this.mainText.x = w / 2;
    this.mainText.y = h / 2;
    this.mainText.style.fontSize = Math.round(h * ROUND_ANNOUNCE.numberFontSize);

    this.subText.x = w / 2;
    this.subText.y = h / 2 - h * 0.1;
    this.subText.style.fontSize = Math.round(h * ROUND_ANNOUNCE.labelFontSize);
  }

  /** Show "RUNDE X VON Y" with zoom-in animation. */
  showRoundAnnounce(roundIndex: number, totalRounds: number, tweens: TweenManager): void {
    this.visible = true;
    this.alpha = 1;
    this.subText.text = "RUNDE";
    this.mainText.text = `${roundIndex + 1}`;
    this.mainText.style.fill = ARENA_COLORS.paGreen;

    // Zoom in from small
    this.mainText.scale.set(0.3);
    this.mainText.alpha = 0;
    this.subText.alpha = 0;

    tweens.to(this.mainText.scale, { x: 1, y: 1 }, ROUND_ANNOUNCE.zoomInMs, {
      easing: easeOutElastic,
    });
    tweens.to(this.mainText, { alpha: 1 }, ROUND_ANNOUNCE.zoomInMs / 2);
    tweens.to(this.subText, { alpha: 1 }, ROUND_ANNOUNCE.zoomInMs);

    // Show "von X" below after a beat
    setTimeout(() => {
      this.subText.text = `RUNDE ${roundIndex + 1} VON ${totalRounds}`;
    }, ROUND_ANNOUNCE.zoomInMs);

    // Fade out after hold
    setTimeout(() => {
      tweens.to(this, { alpha: 0 }, ROUND_ANNOUNCE.fadeOutMs, {
        easing: easeOutCubic,
        onComplete: () => {
          this.visible = false;
        },
      });
    }, ROUND_ANNOUNCE.zoomInMs + ROUND_ANNOUNCE.holdMs);
  }

  /** Show countdown "3", "2", "1", "FIGHT!" */
  showCountdown(tweens: TweenManager, onComplete?: () => void): void {
    this.visible = true;
    this.alpha = 1;
    this.subText.text = "";

    const numbers = ["3", "2", "1", "FIGHT!"];
    let i = 0;

    const showNext = () => {
      if (i >= numbers.length) {
        tweens.to(this, { alpha: 0 }, 300, {
          onComplete: () => {
            this.visible = false;
            onComplete?.();
          },
        });
        return;
      }

      this.mainText.text = numbers[i];
      this.mainText.style.fill = i === 3 ? ARENA_COLORS.paGreen : ARENA_COLORS.textPrimary;
      this.mainText.scale.set(1.5);
      this.mainText.alpha = 1;

      tweens.to(this.mainText.scale, { x: 1, y: 1 }, 400, { easing: easeOutElastic });

      i++;
      setTimeout(showNext, 800);
    };

    showNext();
  }

  /** Show winner badge text. */
  showWinnerBadge(playerName: string, tweens: TweenManager): void {
    this.visible = true;
    this.alpha = 1;
    this.bgOverlay.alpha = 0.5;
    this.subText.text = "GEWINNER";
    this.mainText.text = playerName;
    this.mainText.style.fill = ARENA_COLORS.paGreen;
    this.mainText.scale.set(0.5);

    tweens.to(this.mainText.scale, { x: 1, y: 1 }, 500, { easing: easeOutElastic });

    setTimeout(() => {
      tweens.to(this, { alpha: 0 }, 600, {
        onComplete: () => { this.visible = false; },
      });
    }, 2500);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/arena/layers/overlay.ts
git commit -m "feat(arena): add overlay layer with round announce and countdown"
```

---

## Task 7: Create Effects Layer

Particle system for coin-value-based visual effects: sparks, glow pulses, screen shake, and confetti for extreme-tier cards.

**Files:**
- Create: `components/arena/layers/effects.ts`

- [ ] **Step 1: Implement EffectsLayer**

Create `components/arena/layers/effects.ts`:

```typescript
// components/arena/layers/effects.ts
import { Container, Graphics } from "pixi.js";
import { ARENA_COLORS, EFFECT_TIERS } from "@/lib/arena-constants";

interface Particle {
  gfx: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  gravity: number;
}

export class EffectsLayer extends Container {
  private particles: Particle[] = [];
  private shakeAmount = 0;
  private shakeDuration = 0;
  private shakeElapsed = 0;
  private parentContainer: Container | null = null;

  /** Set the parent container to apply screen shake to. */
  setShakeTarget(target: Container): void {
    this.parentContainer = target;
  }

  /** Spawn particles at the given position with the given effect tier. */
  triggerEffect(
    x: number,
    y: number,
    tier: "low" | "medium" | "high" | "extreme",
  ): void {
    const config = EFFECT_TIERS[tier];
    if (config.particles === 0) return;

    const color = tier === "extreme" ? ARENA_COLORS.effectExtreme
      : tier === "high" ? ARENA_COLORS.effectHigh
      : ARENA_COLORS.effectMedium;

    // Spawn particles
    for (let i = 0; i < config.particles; i++) {
      const gfx = new Graphics();
      const size = 2 + Math.random() * 4;
      gfx.circle(0, 0, size);
      gfx.fill(color);
      gfx.x = x + (Math.random() - 0.5) * 40;
      gfx.y = y + (Math.random() - 0.5) * 20;
      this.addChild(gfx);

      this.particles.push({
        gfx,
        vx: (Math.random() - 0.5) * 4,
        vy: -(1 + Math.random() * 3),
        life: 0,
        maxLife: 500 + Math.random() * 800,
        gravity: 0.05,
      });
    }

    // Screen shake
    if (config.shake > 0) {
      this.shakeAmount = config.shake;
      this.shakeDuration = 400;
      this.shakeElapsed = 0;
    }

    // Confetti for extreme tier
    if (config.confetti) {
      this.spawnConfetti(x, y);
    }
  }

  private spawnConfetti(x: number, y: number): void {
    const colors = [0xff6b6b, 0x64b5f6, 0xffd54f, 0x9bff00, 0xc864ff];
    for (let i = 0; i < 30; i++) {
      const gfx = new Graphics();
      const w = 3 + Math.random() * 4;
      const h = 6 + Math.random() * 8;
      gfx.rect(-w / 2, -h / 2, w, h);
      gfx.fill(colors[i % colors.length]);
      gfx.x = x + (Math.random() - 0.5) * 100;
      gfx.y = y - 50;
      gfx.rotation = Math.random() * Math.PI;
      this.addChild(gfx);

      this.particles.push({
        gfx,
        vx: (Math.random() - 0.5) * 6,
        vy: -(2 + Math.random() * 4),
        life: 0,
        maxLife: 1500 + Math.random() * 1500,
        gravity: 0.08,
      });
    }
  }

  update(deltaMs: number): void {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += deltaMs;
      p.vy += p.gravity;
      p.gfx.x += p.vx;
      p.gfx.y += p.vy;
      p.gfx.alpha = Math.max(0, 1 - p.life / p.maxLife);

      if (p.life >= p.maxLife) {
        this.removeChild(p.gfx);
        p.gfx.destroy();
        this.particles.splice(i, 1);
      }
    }

    // Screen shake
    if (this.shakeDuration > 0 && this.parentContainer) {
      this.shakeElapsed += deltaMs;
      if (this.shakeElapsed < this.shakeDuration) {
        const intensity = this.shakeAmount * (1 - this.shakeElapsed / this.shakeDuration);
        this.parentContainer.x = (Math.random() - 0.5) * intensity * 2;
        this.parentContainer.y = (Math.random() - 0.5) * intensity * 2;
      } else {
        this.parentContainer.x = 0;
        this.parentContainer.y = 0;
        this.shakeDuration = 0;
      }
    }
  }

  /** Remove all particles immediately. */
  clearAll(): void {
    for (const p of this.particles) {
      this.removeChild(p.gfx);
      p.gfx.destroy();
    }
    this.particles = [];
    this.shakeAmount = 0;
    this.shakeDuration = 0;
    if (this.parentContainer) {
      this.parentContainer.x = 0;
      this.parentContainer.y = 0;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/arena/layers/effects.ts
git commit -m "feat(arena): add effects layer with particles, confetti, and screen shake"
```

---

## Task 8: Wire Up BattleBridge with All Layers

Now that all layers exist, update the BattleBridge to actually handle SSE events and drive the full game flow.

**Files:**
- Modify: `components/arena/battle-bridge.ts`

- [ ] **Step 1: Rewrite BattleBridge with full event handling**

Replace the entire contents of `components/arena/battle-bridge.ts`:

```typescript
// components/arena/battle-bridge.ts
import type { BackgroundLayer } from "./layers/background";
import type { ArenaFloorLayer } from "./layers/arena-floor";
import type { PlayerSlotsLayer } from "./layers/player-slots";
import type { BattleCenterLayer } from "./layers/battle-center";
import type { PlayerHandLayer } from "./layers/player-hand";
import type { EffectsLayer } from "./layers/effects";
import type { OverlayLayer } from "./layers/overlay";
import type { TweenManager } from "./tween";
import type { CardData } from "./card-sprite";
import { PLAYER_COLORS, ARENA_COLORS } from "@/lib/arena-constants";

export interface ArenaLayers {
  background: BackgroundLayer;
  arenaFloor: ArenaFloorLayer;
  playerSlots: PlayerSlotsLayer;
  battleCenter: BattleCenterLayer;
  playerHand: PlayerHandLayer;
  effects: EffectsLayer;
  overlay: OverlayLayer;
}

export interface BattleState {
  status: string;
  currentRound: number;
  totalRounds: number;
  playerCount: number;
  isPlayer: boolean;
  currentUserId: string | null;
  players: Array<{ userId: string; name: string }>;
}

interface HandCardData {
  index: number;
  card: string;
  coinValue: number;
  rarity: string;
  name: string;
  image: string;
}

interface RevealCardData {
  playerId: string;
  card: { _id: string; name: string; image: string };
  coinValue: number;
  rarity: string;
  effectTier: string;
}

export class BattleBridge {
  private layers: ArenaLayers;
  private tweens: TweenManager;
  private state: BattleState;
  private playersInitialized = false;

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
      players: [],
    };
  }

  updateState(state: Partial<BattleState>): void {
    Object.assign(this.state, state);

    // Initialize player slots once we have player data
    if (state.players && state.players.length > 0 && !this.playersInitialized) {
      this.layers.playerSlots.setPlayers(state.players);
      this.layers.battleCenter.setPlayerCount(state.players.length);
      this.playersInitialized = true;
    }
  }

  resize(w: number, h: number): void {
    this.layers.background.resize(w, h);
    this.layers.arenaFloor.resize(w, h);
    this.layers.playerSlots.resize(w, h);
    this.layers.battleCenter.resize(w, h);
    this.layers.playerHand.resize(w, h);
    this.layers.overlay.resize(w, h);
  }

  update(deltaMs: number): void {
    this.tweens.update(deltaMs);
    this.layers.background.update(deltaMs);
    this.layers.arenaFloor.update(deltaMs);
    this.layers.playerHand.update(deltaMs);
    this.layers.effects.update(deltaMs);
  }

  destroy(): void {
    this.tweens.killAll();
    this.layers.effects.clearAll();
  }

  // --- SSE Event Handlers ---

  onRoundAnnounce(data: { roundIndex: number; totalRounds: number }): void {
    this.layers.battleCenter.clearPlayedCards();
    this.layers.battleCenter.setRound(data.roundIndex, data.totalRounds);
    this.layers.overlay.showRoundAnnounce(data.roundIndex, data.totalRounds, this.tweens);
  }

  onHandDealt(data: { cards: HandCardData[] }): void {
    if (!this.state.isPlayer) return; // spectators don't see the hand

    const cardData: CardData[] = data.cards.map((c) => ({
      index: c.index,
      card: c.card,
      coinValue: c.coinValue,
      rarity: c.rarity,
      name: c.name,
      image: c.image,
    }));
    this.layers.playerHand.dealHand(cardData, this.tweens);
  }

  onPlayerSelected(data: { userId: string }): void {
    // Find player index
    const playerIndex = this.state.players.findIndex((p) => p.userId === data.userId);
    if (playerIndex === -1) return;

    // Place face-down card in center
    this.layers.battleCenter.placeCard(playerIndex, this.tweens);
  }

  onCardsReveal(data: { cards: RevealCardData[]; highestEffectTier?: string }): void {
    // Hide hand
    this.layers.playerHand.clearHand();

    // Build reveal data with player indices
    const revealData = data.cards.map((c) => {
      const playerIndex = this.state.players.findIndex((p) => p.userId === c.playerId);
      return {
        playerIndex,
        data: {
          index: 0,
          card: c.card._id,
          coinValue: c.coinValue,
          rarity: c.rarity,
          name: c.card.name,
          image: c.card.image,
        } as CardData,
        effectTier: c.effectTier,
      };
    });

    // Reveal all cards with flip animation
    this.layers.battleCenter.revealCards(revealData, this.tweens, () => {
      // After all revealed, trigger effects for each card
      for (const card of revealData) {
        if (card.effectTier !== "low") {
          const pos = this.layers.playerSlots.getSlotPosition(
            this.state.players[card.playerIndex]?.userId ?? "",
          );
          if (pos) {
            this.layers.effects.triggerEffect(
              pos.x,
              pos.y - 50,
              card.effectTier as "medium" | "high" | "extreme",
            );
          }
        }
      }
    });
  }

  onRoundResult(data: { winnerId: string | null; isClose: boolean; scores?: Record<string, number> }): void {
    if (data.winnerId) {
      const winnerIndex = this.state.players.findIndex((p) => p.userId === data.winnerId);
      if (winnerIndex !== -1) {
        this.layers.battleCenter.highlightWinner(winnerIndex, this.tweens);
        this.layers.playerSlots.highlightWinner(data.winnerId!, this.tweens);
      }
    }
    if (data.scores) {
      this.layers.playerSlots.updateScores(data.scores, this.tweens);
    }
  }

  onBattleEnd(data: { placements: Array<{ userId: string; placement: number; eloChange: number; score: number }> }): void {
    this.layers.playerHand.clearHand();
    this.layers.battleCenter.clearPlayedCards();

    // Show winner
    const winner = data.placements.find((p) => p.placement === 1);
    if (winner) {
      const player = this.state.players.find((p) => p.userId === winner.userId);
      if (player) {
        this.layers.overlay.showWinnerBadge(player.name, this.tweens);
        // Confetti
        this.layers.effects.triggerEffect(
          0, 0, // will be centered by the effect
          "extreme",
        );
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/arena/battle-bridge.ts
git commit -m "feat(arena): wire BattleBridge with full SSE event handling"
```

---

## Task 9: Update ArenaPixi with All Layers

Add the new layers to the scene tree and pass `onSelectCard` through the hand layer.

**Files:**
- Modify: `components/arena/arena-pixi.tsx`

- [ ] **Step 1: Update ArenaPixi to include all layers**

In `components/arena/arena-pixi.tsx`, update the imports and the scene tree construction inside `initApp`:

Add these imports at the top:
```typescript
import { PlayerSlotsLayer } from "./layers/player-slots";
import { BattleCenterLayer } from "./layers/battle-center";
import { PlayerHandLayer } from "./layers/player-hand";
import { EffectsLayer } from "./layers/effects";
import { OverlayLayer } from "./layers/overlay";
```

Replace the scene tree construction section (inside `initApp`, after `const arenaFloor = new ArenaFloorLayer();`):

```typescript
    // Build scene tree (order = draw order, back to front)
    const tweenManager = new TweenManager();
    const background = new BackgroundLayer();
    const arenaFloor = new ArenaFloorLayer();
    const playerSlots = new PlayerSlotsLayer();
    const battleCenter = new BattleCenterLayer();
    const playerHand = new PlayerHandLayer();
    const effects = new EffectsLayer();
    const overlay = new OverlayLayer();

    app.stage.addChild(background);
    app.stage.addChild(arenaFloor);
    app.stage.addChild(playerSlots);
    app.stage.addChild(battleCenter);
    app.stage.addChild(playerHand);
    app.stage.addChild(effects);
    app.stage.addChild(overlay);

    // Screen shake targets the stage
    effects.setShakeTarget(app.stage);

    // Create bridge with all layers
    const bridge = new BattleBridge(
      { background, arenaFloor, playerSlots, battleCenter, playerHand, effects, overlay },
      tweenManager,
    );
    bridgeRef.current = bridge;
```

Update the `updateState` useEffect to include player data:
```typescript
  useEffect(() => {
    bridgeRef.current?.updateState({
      status: props.battle.status,
      currentRound: props.battle.currentRound,
      totalRounds: props.battle.totalRounds,
      playerCount: props.battle.players.length,
      isPlayer: props.isPlayer,
      currentUserId: props.currentUserId,
      players: props.battle.players.map((p) => ({
        userId: p.user._id,
        name: p.user.name,
      })),
    });
  }, [props.battle, props.isPlayer, props.currentUserId]);
```

Add an effect to wire up `onSelectCard` callback to the hand layer:
```typescript
  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    // Access hand layer through bridge to set the callback
    // We need to store a reference. Simplest: add a method to BattleBridge.
  }, [props.onSelectCard]);
```

Actually, a cleaner approach — add a `setOnSelectCard` method to BattleBridge:

In `battle-bridge.ts`, add:
```typescript
  setOnSelectCard(cb: (index: number) => void): void {
    this.layers.playerHand.onSelectCard = cb;
  }
```

Then in `arena-pixi.tsx`, after creating the bridge:
```typescript
    // Wire card selection callback
    bridge.setOnSelectCard(onSelectCardRef.current);
```

Store the callback in a ref to avoid re-creating the app:
```typescript
  const onSelectCardRef = useRef(props.onSelectCard);
  onSelectCardRef.current = props.onSelectCard;
```

And add a `useEffect` for the `player_selected` event too:
```typescript
  useEffect(() => {
    if (props.playersSelected.size > 0) {
      const latest = Array.from(props.playersSelected).pop();
      if (latest) bridgeRef.current?.onPlayerSelected({ userId: latest });
    }
  }, [props.playersSelected.size]);
```

- [ ] **Step 2: Commit**

```bash
git add components/arena/arena-pixi.tsx components/arena/battle-bridge.ts
git commit -m "feat(arena): add all layers to scene tree and wire event flow"
```

---

## Task 10: Remove DOM Fallback and Clean Up BattleView

Remove the temporary `<BattleClash>` DOM component from the clash phase render, keeping only the PixiJS `<ArenaCanvas>`.

**Files:**
- Modify: `components/battles/battle-view.tsx`

- [ ] **Step 1: Remove BattleClash from clash phase render**

In `components/battles/battle-view.tsx`, find the `{isClashing && (...)}` block and remove the `<BattleClash>` component. Keep only `<ArenaCanvas>`:

```tsx
{isClashing && (
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
)}
```

**Note:** Keep the `<BattleClash>` import and component file — it may still be useful for debugging or as a reference. Just stop rendering it.

- [ ] **Step 2: Remove unused state that was only for the old DOM UI**

The `revealedCards` state and the `card_reveal` SSE handler were for the old sequential card reveal. Since the new system uses `cards_reveal` (simultaneous), remove:

- `const [revealedCards, setRevealedCards] = useState<Record<string, RoundCard>>({});`
- The `es.addEventListener("card_reveal", ...)` handler
- The `setRevealedCards({})` calls in `round_announce` handler (replace with nothing — it's already clearing card state)

Keep the `cards_reveal` handler that was added in Phase 1.

- [ ] **Step 3: Commit**

```bash
git add components/battles/battle-view.tsx
git commit -m "feat(arena): replace DOM clash UI with PixiJS arena canvas"
```

---

## Task 11: Full Gameplay Smoke Test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Create a battle with 2 players**

Open two browser windows. Create a battle, have both join, pass ready check.

- [ ] **Step 3: Verify the arena gameplay flow**

During the clash phase, verify in the PixiJS canvas:
- Round announcement overlay ("RUNDE 1") zooms in and fades
- Player slots appear with names and "0" scores
- 5 cards appear at the bottom, flip from face-down to face-up
- Timer bar starts depleting (green → red below 25%)
- Clicking a card lifts it up with green border, dims others
- Face-down card appears in the center for the player who selected
- After both players select, all cards flip simultaneously in the center
- Effect particles spawn for medium/high/extreme value cards
- Winner's player slot gets highlighted with scale animation
- Score counter animates ("pop") on the winner's slot
- After all rounds: winner badge appears
- Cards, timer, and center clear between rounds

- [ ] **Step 4: Test edge cases**

- Let the timer expire (one player doesn't click) — random card should be auto-selected
- Test with 3 and 4 players if possible
- Resize the browser window during gameplay — canvas should resize smoothly
- Navigate away and back — no WebGL leaks, clean re-init

- [ ] **Step 5: Fix any issues and commit**

```bash
git add -A
git commit -m "fix(arena): address issues found during Phase 3 smoke test"
```

---

## Summary

| Task | What | Est. |
|------|------|------|
| 1 | Card layout + effect constants | 3 min |
| 2 | CardSprite (reusable display object) | 10 min |
| 3 | Player slots layer | 10 min |
| 4 | Battle center layer (cards + VS) | 10 min |
| 5 | Player hand layer (interactive + timer) | 15 min |
| 6 | Overlay layer (announce + countdown) | 10 min |
| 7 | Effects layer (particles + shake) | 10 min |
| 8 | Wire BattleBridge with all events | 10 min |
| 9 | Update ArenaPixi scene tree | 10 min |
| 10 | Remove DOM fallback | 5 min |
| 11 | Full gameplay smoke test | 15 min |
| **Total** | | **~108 min** |
