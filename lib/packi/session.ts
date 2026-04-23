import { runRedisCommand } from "@/lib/redis";

export const PACKI_SESSION_TTL_SECONDS = 60 * 60 * 24;
export const PACKI_SESSION_MAX_TURNS = 20;

export type PackiTurnRole = "user" | "assistant";

export interface PackiTurn {
  role: PackiTurnRole;
  content: string;
  ts: number;
}

function sessionKey(userId: string): string {
  return `packi:session:${userId}`;
}

function coerceTurns(raw: unknown): PackiTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: PackiTurn[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { role, content, ts } = entry as Partial<PackiTurn>;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    if (typeof ts !== "number" || !Number.isFinite(ts)) continue;
    turns.push({ role, content, ts });
  }
  return turns;
}

export async function loadPackiSession(userId: string): Promise<PackiTurn[]> {
  const raw = await runRedisCommand<string | null>(
    `packi:session:${userId}:load`,
    null,
    async (redis) => redis.get(sessionKey(userId)),
  );
  if (!raw) return [];
  try {
    return coerceTurns(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function appendPackiTurns(
  userId: string,
  prior: PackiTurn[],
  newTurns: PackiTurn[],
): Promise<PackiTurn[]> {
  const combined = [...prior, ...newTurns];
  const trimmed = combined.slice(-PACKI_SESSION_MAX_TURNS);
  await runRedisCommand<void>(
    `packi:session:${userId}:append`,
    undefined,
    async (redis) => {
      await redis.set(
        sessionKey(userId),
        JSON.stringify(trimmed),
        "EX",
        PACKI_SESSION_TTL_SECONDS,
      );
    },
  );
  return trimmed;
}

export async function clearPackiSession(userId: string): Promise<void> {
  await runRedisCommand<void>(
    `packi:session:${userId}:clear`,
    undefined,
    async (redis) => {
      await redis.del(sessionKey(userId));
    },
  );
}
