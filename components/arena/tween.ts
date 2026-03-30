// components/arena/tween.ts
// Lightweight ticker-based tween engine for PixiJS 8 animations.

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

export function easeLinear(t: number): number {
  return t;
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

type EasingFn = (t: number) => number;

interface ActiveTween {
  target: Record<string, number>;
  props: Array<{ key: string; from: number; to: number }>;
  duration: number;
  elapsed: number;
  easing: EasingFn;
  onComplete?: () => void;
  onUpdate?: () => void;
}

export class TweenManager {
  private tweens: ActiveTween[] = [];

  get activeCount(): number {
    return this.tweens.length;
  }

  /** Tween target's numeric properties to the given values over duration ms. */
  to(
    target: Record<string, number>,
    to: Record<string, number>,
    duration: number,
    opts?: { easing?: EasingFn; onComplete?: () => void; onUpdate?: () => void },
  ): void {
    const props = Object.keys(to).map((key) => ({
      key,
      from: target[key] ?? 0,
      to: to[key],
    }));
    this.tweens.push({
      target,
      props,
      duration: Math.max(1, duration),
      elapsed: 0,
      easing: opts?.easing ?? easeOutCubic,
      onComplete: opts?.onComplete,
      onUpdate: opts?.onUpdate,
    });
  }

  /** Call every frame with deltaMs (e.g., from ticker.deltaMS). */
  update(deltaMs: number): void {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.elapsed += deltaMs;
      const progress = Math.min(tw.elapsed / tw.duration, 1);
      const eased = tw.easing(progress);

      for (const prop of tw.props) {
        tw.target[prop.key] = lerp(prop.from, prop.to, eased);
      }

      tw.onUpdate?.();

      if (progress >= 1) {
        this.tweens.splice(i, 1);
        tw.onComplete?.();
      }
    }
  }

  /** Kill all tweens for a specific target object. */
  killTarget(target: Record<string, number>): void {
    this.tweens = this.tweens.filter((tw) => tw.target !== target);
  }

  /** Kill all active tweens. */
  killAll(): void {
    this.tweens = [];
  }
}
