import { getQueue } from "@/lib/queue";

export const BATTLE_QUEUE = "battle-jobs";

export type BattleJobName = "auto-cancel" | "auto-start" | "auto-select";

interface BattleJobData {
  battleId: string;
  roundNumber?: number;
}

/**
 * Schedule a delayed battle job.
 * Uses jobId to deduplicate — re-scheduling the same job replaces the old one.
 */
export async function scheduleBattleJob(
  name: BattleJobName,
  data: BattleJobData,
  delayMs: number,
) {
  const queue = getQueue(BATTLE_QUEUE);
  const jobId = `${name}--${data.battleId}${data.roundNumber ? `--r${data.roundNumber}` : ""}`;

  // Remove existing job with same ID if present
  const existing = await queue.getJob(jobId);
  if (existing) {
    await existing.remove().catch(() => {});
  }

  await queue.add(name, data, {
    jobId,
    delay: Math.max(0, delayMs),
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 2,
    backoff: { type: "fixed", delay: 2000 },
  });
}

/**
 * Remove a scheduled battle job (e.g. when battle starts manually before auto-start fires).
 */
export async function removeBattleJob(name: BattleJobName, battleId: string, roundNumber?: number) {
  const queue = getQueue(BATTLE_QUEUE);
  const jobId = `${name}--${battleId}${roundNumber ? `--r${roundNumber}` : ""}`;
  const job = await queue.getJob(jobId);
  if (job) {
    await job.remove().catch(() => {});
  }
}
