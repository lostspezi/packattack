// lib/battle-constants.ts

// --- ELO ---
export const ELO_DEFAULT = 800;
export const ELO_FLOOR = 800;
export const ELO_K_NEW = 25;              // < 20 battles
export const ELO_K_EXPERIENCED = 15;      // 20-99 battles
export const ELO_K_VETERAN = 10;          // 100+ battles
export const ELO_NEW_THRESHOLD = 20;
export const ELO_VETERAN_THRESHOLD = 100;

export const ELO_RANKS = [
  { key: "bronze",   label: { de: "Bronze", en: "Bronze" },     minElo: 800,  emoji: "🥉", divisions: true },
  { key: "silver",   label: { de: "Silber", en: "Silver" },     minElo: 1000, emoji: "🥈", divisions: true },
  { key: "gold",     label: { de: "Gold", en: "Gold" },         minElo: 1200, emoji: "🥇", divisions: true },
  { key: "platin",   label: { de: "Platin", en: "Platinum" },   minElo: 1400, emoji: "💠", divisions: true },
  { key: "diamond",  label: { de: "Diamant", en: "Diamond" },   minElo: 1600, emoji: "💎", divisions: true },
  { key: "champion", label: { de: "Champion", en: "Champion" }, minElo: 1800, emoji: "👑", divisions: false },
] as const;

export const ELO_DIVISION_SIZE = 50;
export const BATTLE_ELO_RANGE = 200;

// --- Battle ---
export const BATTLE_COUNTDOWN_SECONDS = 3;  // "3-2-1-FIGHT!" after all ready
export const BATTLE_MAX_PLAYERS = 20;
export const BATTLE_MIN_PLAYERS = 2;
export const BATTLE_MAX_PACKS = 10;

// --- Ready Check ---
export const READY_CHECK_TIMEOUT_SECONDS = 30;

// --- Round Choreography (all values in ms) ---
export const ROUND_ANNOUNCE_MS = 3000;
export const ROUND_BUILDUP_MS = 3000;
export const CARD_REVEAL_FLIP_MS = 1000;
export const CARD_REVEAL_DISPLAY_MS = 4000;
export const CARD_REVEAL_RARE_BONUS_MS = 2000;    // Extra display for Rare+ (RARITY_ORDER >= 3)
export const CARD_REVEAL_ULTRA_BONUS_MS = 4000;    // Extra display for Ultra Rare+ (RARITY_ORDER >= 5)
export const BETWEEN_REVEALS_MS = 3000;
export const COMPARISON_PAUSE_MS = 4000;
export const WINNER_REVEAL_MS = 3000;
export const WINNER_CLOSE_REVEAL_MS = 8000;
export const SCORE_UPDATE_MS = 3000;
export const ROUND_TRANSITION_MS = 2000;
export const CLOSE_MATCH_THRESHOLD = 0.2;  // 20% coinValue difference = "close"

// --- Card Selection (new mechanic) ---
export const HAND_SIZE = 5;
export const SELECTION_TIMEOUT_MS = 20_000;

// New round choreography (replaces sequential reveal)
export const HAND_DEAL_MS = 2000;          // time to show hand cards appearing
export const HAND_REVEAL_MS = 3000;        // time for cards to flip face-up
export const SELECTION_WAIT_DISPLAY_MS = 1500; // display "waiting for players" after own selection
export const SIMULTANEOUS_REVEAL_MS = 2000;    // all cards flip at once
export const COIN_VALUE_EFFECT_THRESHOLDS = {
  medium: 1,    // $1+ = green glow, light sparks
  high: 5,      // $5+ = purple/gold glow, screen shake
  extreme: 20,  // $20+ = gold explosion, confetti
};

// --- Preset Chat ---
export const PRESET_CHAT_COOLDOWN_MS = 2000;

export const PRESET_CHAT_MESSAGES = [
  // HYPE
  { key: "hype_1", category: "hype", de: "Let's gooo! 🔥", en: "Let's gooo! 🔥", spectatorOnly: false },
  { key: "hype_2", category: "hype", de: "Nicht schlecht!", en: "Not bad!", spectatorOnly: false },
  { key: "hype_3", category: "hype", de: "Das wird wild!", en: "This is gonna be wild!", spectatorOnly: false },
  { key: "hype_4", category: "hype", de: "Krass!", en: "Insane!", spectatorOnly: false },
  // REACTION
  { key: "react_1", category: "reaction", de: "Das war knapp!", en: "That was close!", spectatorOnly: false },
  { key: "react_2", category: "reaction", de: "Oh nein...", en: "Oh no...", spectatorOnly: false },
  { key: "react_3", category: "reaction", de: "Unglaublich!", en: "Unbelievable!", spectatorOnly: false },
  { key: "react_4", category: "reaction", de: "RIP 💀", en: "RIP 💀", spectatorOnly: false },
  // RESPECT
  { key: "respect_1", category: "respect", de: "Gut gespielt!", en: "Well played!", spectatorOnly: false },
  { key: "respect_2", category: "respect", de: "GG! 🤝", en: "GG! 🤝", spectatorOnly: false },
  { key: "respect_3", category: "respect", de: "Starker Pull!", en: "Great pull!", spectatorOnly: false },
  { key: "respect_4", category: "respect", de: "Respekt!", en: "Respect!", spectatorOnly: false },
  // BATTLE
  { key: "battle_1", category: "battle", de: "Rematch? ⚔️", en: "Rematch? ⚔️", spectatorOnly: false },
  { key: "battle_2", category: "battle", de: "Ich bin bereit!", en: "I'm ready!", spectatorOnly: false },
  { key: "battle_3", category: "battle", de: "Glück gehabt! 😏", en: "Lucky! 😏", spectatorOnly: false },
  { key: "battle_4", category: "battle", de: "Nächstes Mal!", en: "Next time!", spectatorOnly: false },
  // SPECTATOR
  { key: "spec_1", category: "spectator", de: "Spannend! 🍿", en: "Exciting! 🍿", spectatorOnly: true },
  { key: "spec_2", category: "spectator", de: "Go go go!", en: "Go go go!", spectatorOnly: true },
  { key: "spec_3", category: "spectator", de: "Was ein Battle!", en: "What a battle!", spectatorOnly: true },
  { key: "spec_4", category: "spectator", de: "😱😱😱", en: "😱😱😱", spectatorOnly: true },
] as const;

// --- Rarity ordering for tiebreaker ---
export const RARITY_ORDER: Record<string, number> = {
  "Common": 1,
  "Uncommon": 2,
  "Rare": 3,
  "Rare Holo": 4,
  "Ultra Rare": 5,
  "Secret Rare": 6,
  "Illustration Rare": 7,
  "Special Illustration Rare": 8,
  "Hyper Rare": 9,
};

// --- Achievements ---
export const BATTLE_ACHIEVEMENTS = [
  { key: "first_clash",    label: { de: "Erster Clash", en: "First Clash" },     tone: "neutral" as const, condition: "first_battle" },
  { key: "win_streak_3",   label: { de: "On Fire", en: "On Fire" },              tone: "gold" as const,    condition: "win_streak_3" },
  { key: "underdog",       label: { de: "Underdog", en: "Underdog" },            tone: "lilac" as const,   condition: "underdog" },
  { key: "sharpshooter",   label: { de: "Scharfschütze", en: "Sharpshooter" },   tone: "blue" as const,    condition: "round_streak_10" },
  { key: "champion_rank",  label: { de: "Champion", en: "Champion" },            tone: "gold" as const,    condition: "champion_rank" },
  { key: "veteran",        label: { de: "Veteran", en: "Veteran" },              tone: "green" as const,   condition: "battles_100" },
  { key: "jackpot",        label: { de: "Jackpot", en: "Jackpot" },              tone: "gold" as const,    condition: "ultra_rare_pull" },
  { key: "host_10",        label: { de: "Gastgeber", en: "Host" },               tone: "green" as const,   condition: "hosted_10" },
] as const;

export type PresetChatKey = typeof PRESET_CHAT_MESSAGES[number]["key"];
