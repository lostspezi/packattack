import { getRedis } from "@/lib/redis";

export function buildSelectionKey(battleId: string, roundIndex: number): string {
  return `battle:${battleId}:round:${roundIndex}:selections`;
}

export async function storeSelection(
  battleId: string,
  roundIndex: number,
  playerId: string,
  cardIndex: number
): Promise<void> {
  const redis = getRedis();
  await redis.hset(buildSelectionKey(battleId, roundIndex), playerId, cardIndex.toString());
}

export async function getSelections(
  battleId: string,
  roundIndex: number
): Promise<Record<string, number>> {
  const redis = getRedis();
  const raw = await redis.hgetall(buildSelectionKey(battleId, roundIndex));
  const result: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw)) {
    result[key] = parseInt(val, 10);
  }
  return result;
}

export async function allPlayersSelected(
  battleId: string,
  roundIndex: number,
  playerIds: string[]
): Promise<boolean> {
  const selections = await getSelections(battleId, roundIndex);
  return playerIds.every((id) => id in selections);
}

export async function getSelectedCardIndex(
  battleId: string,
  roundIndex: number,
  playerId: string
): Promise<number | null> {
  const selections = await getSelections(battleId, roundIndex);
  return playerId in selections ? selections[playerId] : null;
}

export async function clearSelections(
  battleId: string,
  roundIndex: number
): Promise<void> {
  const redis = getRedis();
  await redis.del(buildSelectionKey(battleId, roundIndex));
}
