import { BATTLE_QUEUE } from "@/lib/battle-jobs";
import { createWorker } from "@/lib/queue";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import { publishBattleEvent, withBattleLock } from "@/lib/battle-events";
import { resolveRound, startFirstRound } from "@/lib/battle-flow";

// ---------- Auto-Cancel: waiting battles that expired ----------

async function processAutoCancel(battleId: string) {
  await connectDB();

  return withBattleLock(battleId, "auto-cancel", async () => {
    const battle = await Battle.findById(battleId);
    if (!battle) return;

    // Cancel if waiting+expired or ready_check+expired
    if (battle.status === "waiting" && battle.lobbyExpiresAt > new Date()) return;
    if (battle.status === "ready_check" && battle.readyCheckExpiresAt && battle.readyCheckExpiresAt > new Date()) return;
    if (battle.status !== "waiting" && battle.status !== "ready_check") return;

    battle.status = "cancelled";
    await battle.save();
    await publishBattleEvent(battleId, "battle_cancelled", { reason: "expired" });
    console.log(`[battle-worker] Auto-cancelled expired battle ${battleId}`);
  });
}

// ---------- Auto-Start: countdown expired, start automatically ----------

async function processAutoStart(battleId: string) {
  await connectDB();

  return withBattleLock(battleId, "start", async () => {
    const battle = await Battle.findById(battleId);
    if (!battle) return;

    if (battle.status !== "countdown") return;
    if (battle.players.length < battle.settings.playerCount) return;

    await startFirstRound(battle, battleId);

    console.log(`[battle-worker] Auto-started battle ${battleId}`);
  });
}

// ---------- Auto-Select: pick random card for AFK players ----------

async function processAutoSelect(battleId: string, roundNumber: number) {
  await connectDB();

  // Atomic claim: flip the round's status from "selecting" to "revealing"
  // iff its deadline has actually passed. This wins against any concurrent
  // user-select request — once the status changes, /select returns 400
  // ("not_selecting") and cannot drive a second resolveRound.
  const battle = await Battle.findOneAndUpdate(
    {
      _id: battleId,
      status: { $in: ["active", "sudden_death"] },
      rounds: {
        $elemMatch: {
          roundNumber,
          status: "selecting",
          selectDeadline: { $lte: new Date() },
        },
      },
    },
    { $set: { "rounds.$[r].status": "revealing" } },
    {
      arrayFilters: [{ "r.roundNumber": roundNumber, "r.status": "selecting" }],
      returnDocument: "after",
    },
  );

  if (!battle) return; // Already handled or deadline not reached

  const currentRound = battle.rounds.find((r) => r.roundNumber === roundNumber);
  if (!currentRound) return;

  const autoSelectedPlayers: string[] = [];
  for (const hand of currentRound.hands) {
    if (hand.selectedCardIndex === null) {
      const randomIndex = Math.floor(Math.random() * hand.cards.length);
      hand.selectedCardIndex = randomIndex;
      hand.selectedAt = new Date();
      autoSelectedPlayers.push(hand.player.toString());
    }
  }

  // Emit player_selected BEFORE resolveRound so clients receive the natural
  // order: "these AFK players picked" → "round reveal". The atomic claim
  // above already transitioned the round to "revealing", so any client that
  // refetches between these events sees a consistent DB state.
  for (const playerId of autoSelectedPlayers) {
    await publishBattleEvent(battleId, "player_selected", {
      player: playerId,
      auto: true,
    });
  }

  try {
    // resolveRound persists before publishing round_reveal, so client
    // refetches after that point also see a consistent state.
    await resolveRound(battle, battleId);
  } catch (err) {
    // If resolveRound failed before persisting the round as "completed",
    // revert the atomic claim so a BullMQ retry (or a late user-select) can
    // re-enter. The arrayFilter only matches rounds still in "revealing",
    // so a successful save before the failure leaves this as a no-op.
    await Battle.updateOne(
      { _id: battleId },
      { $set: { "rounds.$[r].status": "selecting" } },
      { arrayFilters: [{ "r.roundNumber": roundNumber, "r.status": "revealing" }] },
    ).catch(() => {});
    throw err;
  }

  console.log(
    `[battle-worker] Auto-selected ${autoSelectedPlayers.length} AFK players in battle ${battleId} round ${roundNumber}`,
  );
}

// ---------- Worker Entry ----------

export function startBattleWorker() {
  const worker = createWorker(BATTLE_QUEUE, async (job) => {
    const data = job.data as { battleId: string; roundNumber?: number };

    switch (job.name) {
      case "auto-cancel":
        await processAutoCancel(data.battleId);
        break;
      case "auto-start":
        await processAutoStart(data.battleId);
        break;
      case "auto-select":
        await processAutoSelect(data.battleId, data.roundNumber ?? 0);
        break;
      default:
        console.warn(`[battle-worker] Unknown job: ${job.name}`);
    }
  });

  worker.on("failed", (job, err) => {
    console.error(`[battle-worker] Job ${job?.name} (${job?.id}) failed:`, err);
  });

  console.log("[battle-worker] Started");
  return worker;
}
