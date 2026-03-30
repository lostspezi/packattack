// lib/arena-constants.ts
// All positions are in relative units (0–1) unless noted.
// Multiply by canvas width/height to get pixel values.

// --- Colors (hex for PixiJS) ---
export const ARENA_COLORS = {
  bg: 0x12111a,
  surface: 0x1a1924,
  surfaceElevated: 0x222131,
  paGreen: 0x9bff00,
  paGreenHover: 0x85dd00,
  paLila: 0x24043a,
  textPrimary: 0xc8c8d0,
  textSecondary: 0x8a8a96,
  textMuted: 0x6b6b78,
  // Player colors
  player1: 0x9bff00, // green (PA brand)
  player2: 0xff6b6b, // red
  player3: 0x64b5f6, // blue
  player4: 0xffd54f, // gold
  // Effect tier colors
  effectLow: 0xc8c8d0,
  effectMedium: 0x9bff00,
  effectHigh: 0xc864ff,
  effectExtreme: 0xffd54f,
  // Arena
  railingGreen: 0x9bff00,
  floorGlow: 0x9bff00,
  spotlightBeam: 0xffffff,
} as const;

// --- Player color lookup ---
export const PLAYER_COLORS = [
  ARENA_COLORS.player1,
  ARENA_COLORS.player2,
  ARENA_COLORS.player3,
  ARENA_COLORS.player4,
] as const;

// --- Zone layout (Y positions, relative 0–1) ---
export const ARENA_ZONES = {
  skyTop: 0,
  skyBottom: 0.18,
  standsTop: 0.04,
  standsBottom: 0.22,
  railingY: 0.24,
  floorTop: 0.26,
  floorBottom: 0.68,
  playerSlotsY: 0.55,
  battleCenterY: 0.42,
  handTop: 0.72,
  handBottom: 0.95,
  timerBarY: 0.96,
} as const;

// --- Sizes (relative) ---
export const ARENA_SIZES = {
  cardWidth: 0.08,
  cardHeight: 0.18,
  handCardWidth: 0.09,
  handCardHeight: 0.20,
  playerAvatarSize: 0.06,
  vsLabelSize: 0.04,
  spotlightWidth: 0.004,
  railingHeight: 0.005,
} as const;

// --- Player slot X positions by player count ---
export const PLAYER_POSITIONS: Record<number, number[]> = {
  2: [0.3, 0.7],
  3: [0.2, 0.5, 0.8],
  4: [0.15, 0.38, 0.62, 0.85],
};

// --- Animation timing (ms) ---
export const ARENA_TIMING = {
  spotlightCycleMs: 4000,
  spotlightFadeDuration: 0.3,
  railingPulseCycleMs: 3000,
  cardFlipMs: 400,
  cardLiftMs: 200,
  scorePopMs: 500,
  roundAnnounceZoomMs: 800,
  roundAnnounceFadeMs: 400,
  confettiDurationMs: 3000,
} as const;

// --- Canvas ---
export const ARENA_ASPECT_RATIO = 16 / 9;
export const ARENA_MIN_WIDTH = 640;
export const ARENA_MAX_WIDTH = 1920;
