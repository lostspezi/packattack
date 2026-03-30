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
