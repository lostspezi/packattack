export interface ParticleConfig {
  x: number;
  y: number;
  count: number;
  colors: string[];
  speed: [number, number];
  size: [number, number];
  lifetime: [number, number];
  gravity: number;
  spread: number;
  shape: "circle" | "square";
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  shape: "circle" | "square";
}

export class ParticleEngine {
  private particles: Particle[] = [];
  private animFrameId: number | null = null;
  private lastTime = 0;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  detach() {
    this.stop();
    this.canvas = null;
    this.ctx = null;
  }

  emit(config: ParticleConfig) {
    for (let i = 0; i < config.count; i++) {
      const angle = Math.random() * config.spread - config.spread / 2 - Math.PI / 2;
      const speed = config.speed[0] + Math.random() * (config.speed[1] - config.speed[0]);
      const size = config.size[0] + Math.random() * (config.size[1] - config.size[0]);
      const lifetime = config.lifetime[0] + Math.random() * (config.lifetime[1] - config.lifetime[0]);

      this.particles.push({
        x: config.x, y: config.y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        size, color: config.colors[Math.floor(Math.random() * config.colors.length)],
        life: lifetime, maxLife: lifetime, shape: config.shape,
      });
    }
    if (!this.animFrameId) { this.lastTime = performance.now(); this.loop(); }
  }

  emitConfetti(width: number, colors: string[], count = 40) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * width, y: -10 - Math.random() * 50,
        vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 120,
        size: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 2500 + Math.random() * 1000, maxLife: 3500, shape: "square",
      });
    }
    if (!this.animFrameId) { this.lastTime = performance.now(); this.loop(); }
  }

  private loop = () => {
    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.update(dt);
    this.render();
    if (this.particles.length > 0) {
      this.animFrameId = requestAnimationFrame(this.loop);
    } else {
      this.animFrameId = null;
    }
  };

  private update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      p.life -= dt * 1000;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  private render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.shape === "circle") {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  stop() {
    if (this.animFrameId !== null) { cancelAnimationFrame(this.animFrameId); this.animFrameId = null; }
    this.particles = [];
  }

  get isActive() { return this.particles.length > 0; }
}
