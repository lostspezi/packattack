import { describe, it, expect } from "vitest";
import { easeOutCubic, easeInOutQuad, easeOutElastic, lerp, TweenManager } from "@/components/arena/tween";

describe("easing functions", () => {
  it("easeOutCubic starts at 0 and ends at 1", () => {
    expect(easeOutCubic(0)).toBeCloseTo(0);
    expect(easeOutCubic(1)).toBeCloseTo(1);
  });

  it("easeInOutQuad starts at 0 and ends at 1", () => {
    expect(easeInOutQuad(0)).toBeCloseTo(0);
    expect(easeInOutQuad(1)).toBeCloseTo(1);
  });

  it("easeOutElastic starts at 0 and ends at 1", () => {
    expect(easeOutElastic(0)).toBeCloseTo(0);
    expect(easeOutElastic(1)).toBeCloseTo(1);
  });

  it("easeOutCubic is monotonically increasing", () => {
    let prev = 0;
    for (let t = 0.1; t <= 1; t += 0.1) {
      const val = easeOutCubic(t);
      expect(val).toBeGreaterThanOrEqual(prev);
      prev = val;
    }
  });
});

describe("lerp", () => {
  it("returns start at t=0", () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it("returns end at t=1", () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it("returns midpoint at t=0.5", () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });
});

describe("TweenManager", () => {
  it("starts with no active tweens", () => {
    const tm = new TweenManager();
    expect(tm.activeCount).toBe(0);
  });

  it("adds a tween and tracks it", () => {
    const tm = new TweenManager();
    const target = { x: 0, y: 0 };
    tm.to(target, { x: 100 }, 1000);
    expect(tm.activeCount).toBe(1);
  });

  it("updates target values over time", () => {
    const tm = new TweenManager();
    const target = { x: 0 };
    tm.to(target, { x: 100 }, 1000);
    tm.update(500); // half duration
    expect(target.x).toBeGreaterThan(0);
    expect(target.x).toBeLessThan(100);
  });

  it("completes tween at full duration", () => {
    const tm = new TweenManager();
    const target = { x: 0 };
    tm.to(target, { x: 100 }, 1000);
    tm.update(1000);
    expect(target.x).toBeCloseTo(100);
    expect(tm.activeCount).toBe(0);
  });

  it("calls onComplete when tween finishes", () => {
    const tm = new TweenManager();
    const target = { x: 0 };
    let completed = false;
    tm.to(target, { x: 100 }, 500, { onComplete: () => { completed = true; } });
    tm.update(500);
    expect(completed).toBe(true);
  });

  it("killAll stops all tweens", () => {
    const tm = new TweenManager();
    tm.to({ x: 0 }, { x: 1 }, 1000);
    tm.to({ y: 0 }, { y: 1 }, 1000);
    expect(tm.activeCount).toBe(2);
    tm.killAll();
    expect(tm.activeCount).toBe(0);
  });

  it("killTarget stops tweens for specific target", () => {
    const tm = new TweenManager();
    const a = { x: 0 };
    const b = { y: 0 };
    tm.to(a, { x: 1 }, 1000);
    tm.to(b, { y: 1 }, 1000);
    tm.killTarget(a);
    expect(tm.activeCount).toBe(1);
  });
});
