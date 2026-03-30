export type EffectTier = 1 | 2 | 3 | 4;

export interface TierConfig {
  tier: EffectTier;
  label: string;
  colors: string[];
  glowColor: string;
  glowIntensity: number;
  particleCount: number;
  flipDuration: number;
  flipPauseMs: number;
  screenShake: boolean;
  confetti: boolean;
  soundKey: "flip" | "shimmer" | "epic" | "legendary";
  volume: number;
}

const DEFAULT_THRESHOLDS = [50, 200, 500] as const;

export function getEffectTier(
  coinValue: number,
  thresholds: readonly [number, number, number] = DEFAULT_THRESHOLDS,
): EffectTier {
  if (coinValue >= thresholds[2]) return 4;
  if (coinValue >= thresholds[1]) return 3;
  if (coinValue >= thresholds[0]) return 2;
  return 1;
}

export function getMaxTierFromCards(
  cards: { coinValue: number }[],
  thresholds?: readonly [number, number, number],
): EffectTier {
  let max: EffectTier = 1;
  for (const c of cards) {
    const t = getEffectTier(c.coinValue, thresholds);
    if (t > max) max = t;
  }
  return max;
}

export const TIER_CONFIGS: Record<EffectTier, TierConfig> = {
  1: {
    tier: 1, label: "Normal", colors: ["#C8C8D0"],
    glowColor: "transparent", glowIntensity: 0, particleCount: 0,
    flipDuration: 0.6, flipPauseMs: 0,
    screenShake: false, confetti: false, soundKey: "flip", volume: 0.3,
  },
  2: {
    tier: 2, label: "Good", colors: ["#9BFF00", "#7ACC00", "#B8FF4D"],
    glowColor: "rgba(155,255,0,0.3)", glowIntensity: 15, particleCount: 8,
    flipDuration: 0.6, flipPauseMs: 0,
    screenShake: false, confetti: false, soundKey: "shimmer", volume: 0.5,
  },
  3: {
    tier: 3, label: "Epic", colors: ["#FFD700", "#FFA500", "#FFEC8B"],
    glowColor: "rgba(255,215,0,0.3)", glowIntensity: 25, particleCount: 18,
    flipDuration: 0.8, flipPauseMs: 200,
    screenShake: false, confetti: false, soundKey: "epic", volume: 0.7,
  },
  4: {
    tier: 4, label: "Legendary", colors: ["#ff6b6b", "#FFD700", "#9BFF00", "#6bc5ff", "#c06bff"],
    glowColor: "rgba(255,107,107,0.3)", glowIntensity: 35, particleCount: 35,
    flipDuration: 1.0, flipPauseMs: 300,
    screenShake: true, confetti: true, soundKey: "legendary", volume: 1.0,
  },
};

