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
