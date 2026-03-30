"use client";

import { useRef, useCallback } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

interface Pack3DProps {
  boxName: string;
  boxImage: string | null;
  onReady: () => void;
}

export function Pack3D({ boxName, boxImage, onReady }: Pack3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 150, damping: 20 });
  const springY = useSpring(rotateY, { stiffness: 150, damping: 20 });

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const x = (e.clientY - centerY) / (rect.height / 2);
      const y = (e.clientX - centerX) / (rect.width / 2);
      rotateX.set(x * -12);
      rotateY.set(y * 12);
    },
    [rotateX, rotateY],
  );

  const handlePointerLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center gap-6"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ perspective: 800 }}
    >
      <motion.div
        className="relative w-[200px] h-[280px] rounded-2xl border-2 border-pa-green/50 cursor-pointer animate-pack-float"
        style={{
          rotateX: springX,
          rotateY: springY,
          background: "linear-gradient(145deg, #2a1f4e 0%, #1a0f3e 60%, #0d0720 100%)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(155,255,0,0.12)",
          transformStyle: "preserve-3d",
        }}
        whileTap={{ scale: 0.97 }}
        onClick={onReady}
      >
        <div className="absolute inset-0 rounded-2xl animate-holo-shimmer pointer-events-none" />
        <div
          className="absolute top-0 right-0 w-[30%] h-full rounded-r-2xl pointer-events-none"
          style={{ background: "linear-gradient(to left, rgba(255,255,255,0.05), transparent)" }}
        />
        <div
          className="absolute left-[-2px] right-[-2px] h-[2px]"
          style={{
            top: "28%",
            background: "repeating-linear-gradient(90deg, rgba(155,255,0,0.4) 0px, rgba(155,255,0,0.4) 6px, transparent 6px, transparent 12px)",
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {boxImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={boxImage} alt={boxName} className="w-[120px] h-auto rounded-lg opacity-80" />
          ) : (
            <>
              <span className="text-3xl font-black text-pa-green" style={{ textShadow: "0 0 20px rgba(155,255,0,0.5)" }}>PA</span>
              <span className="text-[9px] text-pa-green/50 uppercase tracking-[3px]">Pack Attack</span>
            </>
          )}
        </div>
      </motion.div>
      <div className="flex flex-col items-center gap-2">
        <motion.span
          className="text-2xl text-pa-green"
          animate={{ y: [-8, 8] }}
          transition={{ duration: 1.2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        >
          &#8593;
        </motion.span>
        <span className="text-[11px] text-pa-green/60 uppercase tracking-[2px]">Swipe to Open</span>
      </div>
    </div>
  );
}
