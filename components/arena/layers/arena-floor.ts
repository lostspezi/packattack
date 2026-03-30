// components/arena/layers/arena-floor.ts
import { Container, Graphics } from "pixi.js";
import { ARENA_COLORS, ARENA_ZONES, ARENA_SIZES, ARENA_TIMING } from "@/lib/arena-constants";

export class ArenaFloorLayer extends Container {
  private floorGfx: Graphics;
  private railingGfx: Graphics;
  private glowGfx: Graphics;
  private elapsed = 0;

  constructor() {
    super();

    this.floorGfx = new Graphics();
    this.addChild(this.floorGfx);

    this.glowGfx = new Graphics();
    this.glowGfx.alpha = 0.15;
    this.addChild(this.glowGfx);

    this.railingGfx = new Graphics();
    this.addChild(this.railingGfx);
  }

  resize(w: number, h: number): void {
    const floorY = h * ARENA_ZONES.floorTop;
    const floorH = h * (ARENA_ZONES.handTop - ARENA_ZONES.floorTop);
    const railY = h * ARENA_ZONES.railingY;
    const railH = h * ARENA_SIZES.railingHeight;

    // Floor background — subtle elevated surface
    this.floorGfx.clear();
    this.floorGfx.rect(0, floorY, w, floorH);
    this.floorGfx.fill({ color: ARENA_COLORS.surface, alpha: 0.5 });

    // Center radial glow — very subtle
    this.glowGfx.clear();
    this.glowGfx.ellipse(w / 2, h * ARENA_ZONES.battleCenterY, w * 0.25, h * 0.1);
    this.glowGfx.fill(ARENA_COLORS.floorGlow);

    // Railing (glowing horizontal line)
    this.railingGfx.clear();
    this.railingGfx.rect(0, railY, w, railH);
    this.railingGfx.fill(ARENA_COLORS.railingGreen);
  }

  update(deltaMs: number): void {
    this.elapsed += deltaMs;
    // Pulse the railing brightness
    const phase = (this.elapsed / ARENA_TIMING.railingPulseCycleMs) % 1;
    this.railingGfx.alpha = 0.6 + 0.4 * Math.sin(phase * Math.PI * 2);
    // Pulse the floor glow
    this.glowGfx.alpha = 0.10 + 0.08 * Math.sin(phase * Math.PI * 2 + 1);
  }
}
