// components/arena/arena-canvas.tsx
// SSR boundary for PixiJS. All pixi imports are isolated behind this dynamic().
"use client";

import dynamic from "next/dynamic";
import type { ArenaPixiProps } from "./arena-pixi";

const ArenaPixi = dynamic(() => import("./arena-pixi"), { ssr: false });

export function ArenaCanvas(props: ArenaPixiProps) {
  return <ArenaPixi {...props} />;
}
