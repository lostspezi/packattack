/**
 * Visuelle Konstanten für das Godpack-Theme.
 *
 * Bewusst zentral, damit die Cosmic-Komponenten (Pack-Ripper, Pre-Reveal,
 * Card-Reveal, Toast, Chat-Highlight) konsistent denselben Look benutzen.
 * Ändere hier einen Wert und das ganze Feature folgt.
 *
 * Aktuelle Stimmung: tiefes Crimson + Gold („royal blood / phoenix"),
 * dunkle Hintergrundgradients mit Gold-Akzenten, statt vorher lila Galaxy.
 */

export const GODPACK_THEME = {
  /** Hauptverlauf für den Pack und große Hintergrund-Layer. */
  bgGradient:
    "linear-gradient(155deg, #190406 0%, #3a0810 18%, #6e0f1a 35%, #9c1422 50%, #6e0f1a 65%, #3a0810 82%, #190406 100%)",

  /** Radialer Backdrop für Vollbild-Overlays (Pre-Reveal, Pack-Opening). */
  backdropRadial:
    "radial-gradient(ellipse at 50% 50%, rgba(165, 25, 30, 0.55) 0%, rgba(80, 10, 14, 0.88) 38%, rgba(0,0,0,0.95) 75%)",

  /** Sanfter rot-goldener Schein für Pre-Reveal-Spotlights. */
  spotlight:
    "radial-gradient(ellipse at 50% 50%, rgba(255, 110, 80, 0.32) 0%, rgba(255, 200, 80, 0.16) 38%, transparent 72%)",

  /** Gold-Halo, der sich gut auf dem roten Backdrop liest. */
  haloGradient:
    "radial-gradient(circle, rgba(255, 220, 100, 0.55) 0%, rgba(255, 140, 60, 0.30) 30%, transparent 65%)",

  /** Halo-Glow direkt hinter dem Pack während des Ripping. */
  packHaloGradient:
    "radial-gradient(ellipse at center, rgba(255, 215, 95, 0.34) 0%, rgba(255, 80, 60, 0.18) 35%, transparent 72%)",

  /** Holografische Reflexion auf dem Pack — gold + warmes Rot. */
  hologramSheen:
    "linear-gradient(105deg, transparent 30%, rgba(255, 255, 255, 0.18) 47%, rgba(255, 215, 95, 0.22) 50%, rgba(255, 90, 60, 0.18) 53%, transparent 70%)",

  /** Burst-Farben für Particle-Engine Bursts (Pack-Open, Reveal-Hits). */
  burstColors: ["#FFD700", "#FFEC8B", "#FFFFFF", "#FFA500", "#FF7A4A"] as string[],

  /** Confetti-Palette — warmer Mix aus Rot, Gold, Orange, Weiß. */
  confettiColors: [
    "#FFD700",
    "#FFEC8B",
    "#FFA500",
    "#FF7A4A",
    "#FF4F4F",
    "#C9152F",
    "#FFFFFF",
    "#FFB347",
  ] as string[],

  /** Hauptakzent — Goldgelb, hochgesättigt für Letters & Headlines. */
  glowGold: "#FFD580",

  /** Crimson für Akzente und Borders. */
  crimson: "#9C1422",
  deepCrimson: "#3A0810",

  /** Standard-Goldfarbe für Text + Trim. */
  goldText: "rgba(255, 215, 95, 0.95)",
  goldTextSoft: "rgba(255, 215, 95, 0.55)",

  /** Border-Glanz auf Pack/Card. */
  goldTrim: "rgba(255, 215, 95, 0.40)",
  goldTrimGlow: "rgba(255, 200, 80, 0.20)",

  /** Diagonale Pattern-Linien. */
  patternGold: "rgba(255, 215, 95, 0.05)",
  patternRed: "rgba(255, 90, 60, 0.04)",

  /** Text-Shadow Mix für Headlines (steht auf Crimson + Gold-Glow). */
  headlineShadow:
    "drop-shadow(0 0 28px rgba(255, 215, 95, 1)) drop-shadow(0 10px 0 rgba(120, 35, 10, 0.7)) drop-shadow(0 18px 28px rgba(0,0,0,0.55))",
} as const;
