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

  return withBattleLock(battleId, "select", async () => {
    const battle = await Battle.findById(battleId);
    if (!battle) return;

    if (battle.status !== "active" && battle.status !== "sudden_death") return;

    const currentRound = battle.rounds.find((r) => r.roundNumber === roundNumber);
    if (!currentRound || currentRound.status !== "selecting") return;

    const autoSelectedPlayers: string[] = [];
    for (const hand of currentRound.hands) {
      if (hand.selectedCardIndex === null) {
        const randomIndex = Math.floor(Math.random() * hand.cards.length);
        hand.selectedCardIndex = randomIndex;
        hand.selectedAt = new Date();
        autoSelectedPlayers.push(hand.player.toString());
      }
    }

    if (autoSelectedPlayers.length === 0) return;

    // resolveRound persists before publishing, so client refetches are safe.
    await resolveRound(battle, battleId);

    // Emit player_selected AFTER the state is resolved — keeps event order
    // consistent with the manual select path.
    for (const playerId of autoSelectedPlayers) {
      await publishBattleEvent(battleId, "player_selected", {
        player: playerId,
        auto: true,
      });
    }

    console.log(`[battle-worker] Auto-selected for AFK players in battle ${battleId} round ${roundNumber}`);
  });
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
