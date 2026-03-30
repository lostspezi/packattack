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

  setOnSelectCard(cb: (index: number) => void): void {
    this.layers.playerHand.onSelectCard = cb;
  }

  // --- SSE Event Handlers ---

  onRoundAnnounce(data: { roundIndex: number; totalRounds: number }): void {
    this.layers.battleCenter.clearPlayedCards();
    this.layers.battleCenter.setRound(data.roundIndex, data.totalRounds);
    this.layers.overlay.showRoundAnnounce(data.roundIndex, data.totalRounds, this.tweens);
  }

  onHandDealt(data: { cards: HandCardData[] }): void {
    console.log("[bridge] onHandDealt", { isPlayer: this.state.isPlayer, cardCount: data.cards.length, canvasW: this.layers.playerHand.width });
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
        this.layers.effects.triggerEffect(0, 0, "extreme");
      }
    }
  }
}
