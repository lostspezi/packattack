// lib/validations/battle.ts
import { z } from "zod";
import { BATTLE_MAX_PLAYERS, BATTLE_MIN_PLAYERS, BATTLE_MAX_PACKS, PRESET_CHAT_MESSAGES } from "../battle-constants";

export const createBattleSchema = z.object({
  boxId: z.string().min(1),
  packsPerPlayer: z.number().int().min(1).max(BATTLE_MAX_PACKS),
  maxPlayers: z.number().int().min(BATTLE_MIN_PLAYERS).max(BATTLE_MAX_PLAYERS),
  visibility: z.enum(["public", "private"]).default("public"),
});

export const joinBattleSchema = z.object({});

export const battleChatSchema = z.object({
  messageKey: z.enum(PRESET_CHAT_MESSAGES.map(m => m.key) as [string, ...string[]]),
});

export const battleDecideSchema = z.object({
  battlePullId: z.string().min(1),
  decision: z.enum(["claim", "convert"]),
});

export const battleListSchema = z.object({
  status: z.enum(["waiting", "countdown", "opening", "clash", "finished"]).optional(),
  game: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const leaderboardSchema = z.object({
  category: z.enum(["elo", "wins", "streak", "pull_value"]).default("elo"),
  seasonId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
