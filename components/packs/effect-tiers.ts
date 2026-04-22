export type EffectTier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

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
  screenShakeMs: number;
  confetti: boolean;
  confettiCount: number;
  soundKey: "flip" | "spark" | "shimmer" | "chime" | "epic" | "legendary";
  volume: number;
  extraSoundKey?: "rain";
  coinRainParticles?: boolean;
}

type Thresholds = readonly [number, number, number, number, number, number];

const DEFAULT_THRESHOLDS: Thresholds = [20, 50, 100, 250, 500, 1000] as const;

export function getEffectTier(
  coinValue: number,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): EffectTier {
  if (coinValue >= thresholds[5]) return 7;
  if (coinValue >= thresholds[4]) return 6;
  if (coinValue >= thresholds[3]) return 5;
  if (coinValue >= thresholds[2]) return 4;
  if (coinValue >= thresholds[1]) return 3;
  if (coinValue >= thresholds[0]) return 2;
  return 1;
}

export function getMaxTierFromCards(
  cards: { coinValue: number }[],
  thresholds?: Thresholds,
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
    screenShake: false, screenShakeMs: 0,
    confetti: false, confettiCount: 0,
    soundKey: "flip", volume: 0.3,
  },
  2: {
    tier: 2, label: "Common+", colors: ["#E8E8F0", "#B8B8C8", "#FFFFFF"],
    glowColor: "rgba(232,232,240,0.3)", glowIntensity: 10, particleCount: 5,
    flipDuration: 0.6, flipPauseMs: 0,
    screenShake: false, screenShakeMs: 0,
    confetti: false, confettiCount: 0,
    soundKey: "spark", volume: 0.4,
  },
  3: {
    tier: 3, label: "Good", colors: ["#9BFF00", "#7ACC00", "#B8FF4D"],
    glowColor: "rgba(155,255,0,0.3)", glowIntensity: 15, particleCount: 10,
    flipDuration: 0.6, flipPauseMs: 0,
    screenShake: false, screenShakeMs: 0,
    confetti: false, confettiCount: 0,
    soundKey: "shimmer", volume: 0.5,
  },
  4: {
    tier: 4, label: "Great", colors: ["#6bc5ff", "#3a9cff", "#a8ddff"],
    glowColor: "rgba(107,197,255,0.3)", glowIntensity: 20, particleCount: 16,
    flipDuration: 0.7, flipPauseMs: 100,
    screenShake: false, screenShakeMs: 0,
    confetti: false, confettiCount: 0,
    soundKey: "chime", volume: 0.6,
  },
  5: {
    tier: 5, label: "Epic", colors: ["#FFD700", "#FFA500", "#FFEC8B"],
    glowColor: "rgba(255,215,0,0.3)", glowIntensity: 25, particleCount: 22,
    flipDuration: 0.8, flipPauseMs: 200,
    screenShake: false, screenShakeMs: 0,
    confetti: false, confettiCount: 0,
    soundKey: "epic", volume: 0.7,
  },
  6: {
    tier: 6, label: "Legendary", colors: ["#ff6b6b", "#FFD700", "#9BFF00", "#6bc5ff", "#c06bff"],
    glowColor: "rgba(255,107,107,0.3)", glowIntensity: 35, particleCount: 35,
    flipDuration: 1.0, flipPauseMs: 300,
    screenShake: true, screenShakeMs: 150,
    confetti: true, confettiCount: 40,
    soundKey: "legendary", volume: 0.9,
  },
  7: {
    tier: 7, label: "Mythic", colors: ["#FFFFFF", "#FFD700", "#ff6bd6", "#6bc5ff", "#c06bff"],
    glowColor: "rgba(255,255,255,0.4)", glowIntensity: 45, particleCount: 55,
    flipDuration: 1.1, flipPauseMs: 500,
    screenShake: true, screenShakeMs: 300,
    confetti: true, confettiCount: 80,
    soundKey: "legendary", volume: 1.0,
    extraSoundKey: "rain",
    coinRainParticles: true,
  },
};
