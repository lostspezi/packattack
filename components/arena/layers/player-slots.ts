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
