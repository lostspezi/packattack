import BattleQueue, { IBattleQueueEntry } from "@/models/battle-queue";
import Battle from "@/models/battle";
import Box from "@/models/box";
import { startReadyCheck } from "./battle-orchestrator";

function getExpandedRange(queuedAt: Date): number {
  const waitMs = Date.now() - queuedAt.getTime();
  const waitSec = waitMs / 1000;
  if (waitSec < 30) return 100;
  if (waitSec < 60) return 200;
  if (waitSec < 90) return 300;
  return 400;
}

function isWithinMutualRange(a: IBattleQueueEntry, b: IBattleQueueEntry): boolean {
  const rangeA = getExpandedRange(a.queuedAt);
  const rangeB = getExpandedRange(b.queuedAt);
  return (
    Math.abs(a.elo - b.elo) <= rangeA &&
    Math.abs(a.elo - b.elo) <= rangeB
  );
}

export async function processMatchmakingQueue(): Promise<void> {
  const waitingEntries = await BattleQueue.find({ status: "waiting" })
    .sort({ queuedAt: 1 })
    .lean();

  if (waitingEntries.length === 0) return;

  const groups = new Map<string, IBattleQueueEntry[]>();
  for (const entry of waitingEntries) {
    const key = `${entry.box.toString()}_${entry.playerCount}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  for (const [, entries] of groups) {
    if (entries.length === 0) continue;
    const neededPlayers = entries[0].playerCount;
    if (entries.length < neededPlayers) continue;

    const oldest = entries[0];
    const matched: IBattleQueueEntry[] = [oldest];

    for (let i = 1; i < entries.length && matched.length < neededPlayers; i++) {
      const candidate = entries[i];
      const fitsAll = matched.every((m) => isWithinMutualRange(m, candidate));
      if (fitsAll) {
        matched.push(candidate);
      }
    }

    if (matched.length >= neededPlayers) {
      const selectedPlayers = matched.slice(0, neededPlayers);
      await createMatchedBattle(selectedPlayers);
    }
  }
}

async function createMatchedBattle(entries: IBattleQueueEntry[]): Promise<void> {
  const entryIds = entries.map((e) => e._id);
  const boxId = entries[0].box;
  const playerCount = entries[0].playerCount;

  const updateResult = await BattleQueue.updateMany(
    { _id: { $in: entryIds }, status: "waiting" },
    { $set: { status: "matched" } },
  );

  if (updateResult.modifiedCount < playerCount) {
    await BattleQueue.updateMany(
      { _id: { $in: entryIds }, status: "matched" },
      { $set: { status: "waiting" } },
    );
    return;
  }

  const box = await Box.findById(boxId).select("cardsPerPack").lean();
  if (!box) return;

  const packsPerPlayer = 1;
  const slug = `match-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;

  const players = entries.map((e) => ({
    user: e.user,
    coinsReserved: 0,
    eloAtStart: e.elo,
    score: 0,
    placement: null,
    eloChange: null,
    ready: false,
  }));

  const battle = await Battle.create({
    slug,
    createdBy: entries[0].user,
    box: boxId,
    packsPerPlayer,
    maxPlayers: playerCount,
    visibility: "public",
    eloRange: null,
    totalRounds: packsPerPlayer * box.cardsPerPack,
    seasonId: null,
    players,
    status: "waiting",
  });

  await startReadyCheck(battle._id.toString());
}
