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
