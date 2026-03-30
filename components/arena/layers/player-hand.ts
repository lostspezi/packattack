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
    console.log("[hand] dealHand", { canvasW: this.canvasW, canvasH: this.canvasH, cardW, cardH, count: cardData.length });

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
      card.visible = false;
      this.removeChild(card);
    }
    this.cards = [];
    this.selectedIndex = null;
    this.timerStartMs = null;
    this.drawTimerBar(1);
  }

  /** Call every frame to update the timer bar. */
  update(/* _deltaMs */): void {
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
