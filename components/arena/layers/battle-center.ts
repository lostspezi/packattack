// components/arena/layers/battle-center.ts
import { Container, Text } from "pixi.js";
import {
  ARENA_COLORS,
  PLAYER_COLORS,
  PLAYER_POSITIONS,
  CARD_LAYOUT,
  VS_LABEL,
  ARENA_TIMING,
} from "@/lib/arena-constants";
import { CardSprite, type CardData } from "../card-sprite";
import type { TweenManager } from "../tween";
import { easeOutCubic } from "../tween";

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

    // Recreate text labels at correct size (avoids PixiJS TexturePool bug)
    this.rebuildLabels(w, h);

    // Reposition any existing played cards
    this.positionPlayedCards();
  }

  private rebuildLabels(w: number, h: number): void {
    this.removeChild(this.vsLabel);
    this.vsLabel.destroy();
    this.vsLabel = new Text({
      text: "VS",
      style: {
        fontFamily: "monospace",
        fontSize: Math.round(h * VS_LABEL.fontSize),
        fill: ARENA_COLORS.textMuted,
        fontWeight: "bold",
        align: "center",
      },
    });
    this.vsLabel.anchor.set(0.5);
    this.vsLabel.alpha = 0.4;
    this.vsLabel.x = w / 2;
    this.vsLabel.y = h * VS_LABEL.y;
    this.addChild(this.vsLabel);

    const roundText = this.roundLabel.text;
    this.removeChild(this.roundLabel);
    this.roundLabel.destroy();
    this.roundLabel = new Text({
      text: roundText,
      style: {
        fontFamily: "monospace",
        fontSize: Math.round(h * 0.018),
        fill: ARENA_COLORS.textSecondary,
        align: "center",
      },
    });
    this.roundLabel.anchor.set(0.5);
    this.roundLabel.x = w / 2;
    this.roundLabel.y = h * VS_LABEL.y - h * 0.06;
    this.addChild(this.roundLabel);
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
      card.visible = false;
      this.removeChild(card);
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
