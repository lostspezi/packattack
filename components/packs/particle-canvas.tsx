"use client";

import { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";
import { ParticleEngine, type ParticleConfig } from "./particle-engine";

export interface ParticleCanvasHandle {
  emit: (config: ParticleConfig) => void;
  emitConfetti: (colors: string[], count?: number) => void;
  stop: () => void;
}

export const ParticleCanvas = forwardRef<ParticleCanvasHandle>(
  function ParticleCanvas(_, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<ParticleEngine | null>(null);

    useEffect(() => {
      const engine = new ParticleEngine();
      engineRef.current = engine;
      const canvas = canvasRef.current;
      if (!canvas) return;
      engine.attach(canvas);

      function resize() {
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(dpr, dpr);
      }

      resize();
      window.addEventListener("resize", resize);
      return () => { engine.detach(); window.removeEventListener("resize", resize); };
    }, []);

    const emit = useCallback((config: ParticleConfig) => { engineRef.current?.emit(config); }, []);
    const emitConfetti = useCallback((colors: string[], count?: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      engineRef.current?.emitConfetti(rect.width, colors, count);
    }, []);
    const stop = useCallback(() => { engineRef.current?.stop(); }, []);

    useImperativeHandle(ref, () => ({ emit, emitConfetti, stop }), [emit, emitConfetti, stop]);

    return (
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-50"
        style={{ width: "100%", height: "100%" }}
      />
    );
  },
);
