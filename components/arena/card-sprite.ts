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
  private _borderColor: number = ARENA_COLORS.paLila;

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
