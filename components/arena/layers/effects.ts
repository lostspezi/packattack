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
