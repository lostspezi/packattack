"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

interface CoinChestAnimationProps {
  coinsGranted: number;
  onClose: () => void;
}

export function CoinChestAnimation({
  coinsGranted,
  onClose,
}: CoinChestAnimationProps) {
  const [phase, setPhase] = useState(0); // 0=enter, 1=open, 2=rain, 3=result
  const [count, setCount] = useState(0);

  // Generate random coin trajectories
  const coins = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 300,
      y: -(Math.random() * 200 + 100),
      rotation: Math.random() * 720 - 360,
      delay: Math.random() * 0.4,
      size: 16 + Math.random() * 16,
    }));
  }, []);

  // Phase progression
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Sound effects
  useEffect(() => {
    if (phase === 1) {
      playSound("/sounds/chest-open.mp3", 0.5);
    }
    if (phase === 2) {
      playSound("/sounds/coins-rain.mp3", 0.4);
    }
  }, [phase]);

  // Count-up animation
  useEffect(() => {
    if (phase < 2) return;
    const duration = 1500;
    const start = performance.now();
    let raf: number;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.round(eased * coinsGranted));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, coinsGranted]);

  // Auto-dismiss after 8s
  useEffect(() => {
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
      onClick={onClose}
      style={{
        backgroundColor: `rgba(0, 0, 0, ${phase >= 1 ? 0.85 : 0})`,
        transition: "background-color 0.5s ease",
      }}
    >
      <div className="relative flex flex-col items-center">
        {/* Glow */}
        {phase >= 1 && (
          <div
            className="absolute rounded-full"
            style={{
              width: phase >= 2 ? 300 : 100,
              height: phase >= 2 ? 300 : 100,
              background: "radial-gradient(circle, rgba(155,255,0,0.25) 0%, transparent 70%)",
              transition: "all 1s ease-out",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
        )}

        {/* Chest */}
        <div
          className="relative"
          style={{
            transform: phase >= 0 ? "scale(1)" : "scale(0.3)",
            opacity: phase >= 0 ? 1 : 0,
            transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s",
          }}
        >
          {/* Chest SVG */}
          <svg width="120" height="100" viewBox="0 0 120 100">
            {/* Chest base */}
            <rect
              x="10"
              y="45"
              width="100"
              height="55"
              rx="6"
              fill="#8B5E3C"
              stroke="#6B4226"
              strokeWidth="2"
            />
            <rect x="10" y="45" width="100" height="15" rx="3" fill="#A0724A" />
            {/* Lock */}
            <rect x="52" y="55" width="16" height="20" rx="3" fill="#FFD700" />
            <circle cx="60" cy="67" r="3" fill="#8B5E3C" />
            {/* Chest lid */}
            <g
              style={{
                transformOrigin: "60px 45px",
                transform: `rotateX(${phase >= 1 ? -110 : 0}deg)`,
                transition: "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              <path
                d="M10,45 Q60,10 110,45 L110,45 L10,45 Z"
                fill="#A0724A"
                stroke="#6B4226"
                strokeWidth="2"
              />
              <rect
                x="10"
                y="35"
                width="100"
                height="15"
                rx="4"
                fill="#8B5E3C"
                stroke="#6B4226"
                strokeWidth="2"
              />
            </g>
          </svg>
        </div>

        {/* Coin particles */}
        {phase >= 2 &&
          coins.map((coin) => (
            <div
              key={coin.id}
              className="absolute"
              style={{
                left: "50%",
                top: "30%",
                width: coin.size,
                height: coin.size,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #FFD700, #FFA500)",
                boxShadow: "0 0 8px rgba(255, 215, 0, 0.5)",
                animation: `coinFly 1.2s ${coin.delay}s ease-out forwards`,
                "--coin-x": `${coin.x}px`,
                "--coin-y": `${coin.y}px`,
                "--coin-rotate": `${coin.rotation}deg`,
                opacity: 0,
              } as React.CSSProperties}
            />
          ))}

        {/* Count display */}
        {phase >= 2 && (
          <div
            className="mt-6 text-center"
            style={{
              opacity: phase >= 2 ? 1 : 0,
              transform: phase >= 3 ? "scale(1.1)" : "scale(1)",
              transition: "all 0.5s ease",
            }}
          >
            <div className="text-5xl font-black text-pa-green tabular-nums">
              +{count}
            </div>
            <div className="text-white text-lg font-semibold mt-1">
              Münzen gutgeschrieben!
            </div>
            {phase >= 3 && (
              <div className="text-text-secondary text-sm mt-3 animate-pulse">
                Klicke zum Schließen
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes coinFly {
          0% {
            opacity: 1;
            transform: translate(0, 0) rotate(0deg);
          }
          80% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(var(--coin-x), var(--coin-y))
              rotate(var(--coin-rotate));
          }
        }
      `}</style>
    </div>
  );
}

function playSound(src: string, volume = 0.5) {
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.play().catch(() => {});
  } catch {
    // Silently fail if audio not available
  }
}
