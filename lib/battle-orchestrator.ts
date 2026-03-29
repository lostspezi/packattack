import mongoose, { AnyBulkWriteOperation } from "mongoose";
import { getRedis } from "./redis";
import { drawPacks, PackCard } from "./pack-engine";
import {
  determineRoundWinner,
  calculatePlacements,
  snakeDraftDistribute,
  getRevealDelayMs,
} from "./battle-engine";
import { calculateEloChanges } from "./battle-elo";
import { RARITY_ORDER, BATTLE_COUNTDOWN_SECONDS } from "./battle-constants";
import Battle from "@/models/battle";
import BattlePull from "@/models/battle-pull";
import Box from "@/models/box";
import Card from "@/models/card";
import User from "@/models/user";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function publish(battleId: string, data: Record<string, unknown>): void {
  const redis = getRedis();
  redis
    .publish(`battle:${battleId}`, JSON.stringify(data))
    .catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  Main orchestrator                                                  */
/* ------------------------------------------------------------------ */

export async function runBattle(battleId: string): Promise<void> {
  try {
    /* ============================================================== */
    /*  1. COUNTDOWN                                                   */
    /* ============================================================== */
    await Battle.updateOne(
      { _id: battleId },
      { $set: { status: "countdown", startedAt: new Date() } },
    );

    publish(battleId, {
      type: "battle_start",
      countdownSeconds: BATTLE_COUNTDOWN_SECONDS,
    });

    await sleep(BATTLE_COUNTDOWN_SECONDS * 1000);

    /* ============================================================== */
    /*  2. OPENING (draw cards)                                        */
    /* ============================================================== */
    await Battle.updateOne({ _id: battleId }, { $set: { status: "opening" } });

    const battle = await Battle.findById(battleId).lean();
    if (!battle) throw new Error(`Battle ${battleId} not found`);

    const box = await Box.findById(battle.box).lean();
    if (!box) throw new Error(`Box ${battle.box} not found`);

    // Build the shared card pool
    const cardDocs = await Card.find({
      _id: { $in: box.cards.map((c) => c.card) },
    })
      .select("name image")
      .lean();

    const cardMap = new Map(
      cardDocs.map((c) => [c._id.toString(), c]),
    );

    let packCards: PackCard[] = box.cards
      .filter((bc) => bc.stock > 0)
      .map((bc) => {
        const doc = cardMap.get(bc.card.toString());
        return {
          cardId: bc.card.toString(),
          name: doc?.name ?? "Unknown",
          rarity: bc.rarity,
          weight: bc.weight,
          stock: bc.stock,
          coinValue: doc?.internalPrice ?? 0,
          image: doc?.image ?? null,
        } as PackCard;
      });

    // Draw for each player, sharing the stock pool
    const allPulls: Array<{
      userId: string;
      cardId: string;
      rarity: string;
      coinValue: number;
      conversionValue: number;
      roundIndex: number;
      image: string | null;
      name: string;
    }> = [];

    for (const player of battle.players) {
      const result = drawPacks(
        packCards,
        box.cardsPerPack,
        battle.packsPerPlayer,
        box.priceInCoins,
      );

      for (const drawn of result.drawnCards) {
        const roundIndex =
          drawn.cardIndex + drawn.packIndex * box.cardsPerPack;
        allPulls.push({
          userId: player.user.toString(),
          cardId: drawn.cardId,
          rarity: drawn.rarity,
          coinValue: drawn.coinValue,
          conversionValue: drawn.conversionValue,
          roundIndex,
          image: drawn.image,
          name: drawn.name,
        });

        // Update local stock so next player sees reduced availability
        const pc = packCards.find((c) => c.cardId === drawn.cardId);
        if (pc) pc.stock = Math.max(0, pc.stock - 1);
      }

      // Filter out depleted cards for next player
      packCards = packCards.filter((c) => c.stock > 0);
    }

    // Atomically decrement box stock in DB
    const stockDecrements = new Map<string, number>();
    for (const pull of allPulls) {
      stockDecrements.set(
        pull.cardId,
        (stockDecrements.get(pull.cardId) ?? 0) + 1,
      );
    }
    for (const [cardId, count] of stockDecrements) {
      for (let i = 0; i < count; i++) {
        await Box.updateOne(
          {
            _id: box._id,
            "cards.card": new mongoose.Types.ObjectId(cardId),
            "cards.stock": { $gte: 1 },
          },
          { $inc: { "cards.$.stock": -1 } },
        );
      }
    }

    // Note: CoinTransactions for battle_entry are created at join/create time,
    // not here — coins are deducted atomically when players join.

    // Save BattlePull records
    const pullDocs = allPulls.map((p) => ({
      battle: new mongoose.Types.ObjectId(battleId),
      user: new mongoose.Types.ObjectId(p.userId),
      card: new mongoose.Types.ObjectId(p.cardId),
      rarity: p.rarity,
      coinValue: p.coinValue,
      conversionValue: p.conversionValue,
      roundIndex: p.roundIndex,
      status: "pending" as const,
      distributedTo: null,
    }));
    await BattlePull.insertMany(pullDocs);

    // Build rounds array: group pulls by roundIndex
    const totalRounds = box.cardsPerPack * battle.packsPerPlayer;
    const rounds = [];
    for (let r = 0; r < totalRounds; r++) {
      const roundPulls = allPulls.filter((p) => p.roundIndex === r);
      rounds.push({
        roundIndex: r,
        cards: roundPulls.map((p) => ({
          player: new mongoose.Types.ObjectId(p.userId),
          card: new mongoose.Types.ObjectId(p.cardId),
          rarity: p.rarity,
          coinValue: p.coinValue,
        })),
        winnerId: null as mongoose.Types.ObjectId | null,
        revealedAt: null,
      });
    }

    await Battle.updateOne(
      { _id: battleId },
      { $set: { rounds, totalRounds } },
    );

    publish(battleId, { type: "opening_complete" });

    /* ============================================================== */
    /*  3. CLASH ROUNDS                                                */
    /* ============================================================== */
    await Battle.updateOne({ _id: battleId }, { $set: { status: "clash" } });

    // Track scores locally
    const scores = new Map<string, number>();
    for (const player of battle.players) {
      scores.set(player.user.toString(), 0);
    }

    for (let r = 0; r < totalRounds; r++) {
      const round = rounds[r];

      // Load card details for reveal
      const cardIds = round.cards.map((c) => c.card);
      const revealCards = await Card.find({ _id: { $in: cardIds } })
        .select("name image")
        .lean();
      const revealMap = new Map(
        revealCards.map((c) => [c._id.toString(), c]),
      );

      // Determine max rarity for animation delay
      let maxRarity = "Common";
      for (const rc of round.cards) {
        if ((RARITY_ORDER[rc.rarity] ?? 0) > (RARITY_ORDER[maxRarity] ?? 0)) {
          maxRarity = rc.rarity;
        }
      }

      // Publish round_reveal with card data
      publish(battleId, {
        type: "round_reveal",
        roundIndex: r,
        cards: round.cards.map((c) => {
          const doc = revealMap.get(c.card.toString());
          return {
            playerId: c.player.toString(),
            cardId: c.card.toString(),
            name: doc?.name ?? "Unknown",
            image: doc?.image ?? null,
            rarity: c.rarity,
            coinValue: c.coinValue,
          };
        }),
      });

      // Wait for animation
      await sleep(getRevealDelayMs(maxRarity));

      // Determine winner
      const roundCards = round.cards.map((c) => ({
        playerId: c.player.toString(),
        coinValue: c.coinValue,
        rarity: c.rarity,
      }));
      const winnerId = determineRoundWinner(roundCards);

      // Update local rounds array so streak calculation in achievements can use it
      round.winnerId = new mongoose.Types.ObjectId(winnerId);

      // Update local score
      scores.set(winnerId, (scores.get(winnerId) ?? 0) + 1);

      // Update battle in DB
      await Battle.updateOne(
        { _id: battleId },
        {
          $set: {
            [`rounds.${r}.winnerId`]: new mongoose.Types.ObjectId(winnerId),
            [`rounds.${r}.revealedAt`]: new Date(),
            [`players.$[p].score`]: scores.get(winnerId),
            currentRound: r + 1,
          },
        },
        {
          arrayFilters: [
            { "p.user": new mongoose.Types.ObjectId(winnerId) },
          ],
        },
      );

      // Publish round result
      publish(battleId, {
        type: "round_result",
        roundIndex: r,
        winnerId,
        scores: Object.fromEntries(scores),
      });

      // Brief pause between rounds (except after last)
      if (r < totalRounds - 1) {
        await sleep(1500);
      }
    }

    /* ============================================================== */
    /*  4. FINISH (placements, ELO, distribution)                      */
    /* ============================================================== */

    // Calculate total value per player for tiebreaker
    const totalValues = new Map<string, number>();
    for (const pull of allPulls) {
      totalValues.set(
        pull.userId,
        (totalValues.get(pull.userId) ?? 0) + pull.coinValue,
      );
    }

    const placementInput = battle.players.map((p) => ({
      userId: p.user.toString(),
      score: scores.get(p.user.toString()) ?? 0,
      totalValue: totalValues.get(p.user.toString()) ?? 0,
    }));

    const placements = calculatePlacements(placementInput);

    // Load users for ELO calculation
    const userIds = battle.players.map((p) => p.user);
    const users = await User.find({ _id: { $in: userIds } })
      .select("elo battleStats")
      .lean();
    const userMap = new Map(
      users.map((u) => [u._id.toString(), u]),
    );

    const eloPlayers = placements.map((p) => {
      const user = userMap.get(p.userId);
      return {
        userId: p.userId,
        elo: user?.elo ?? 1000,
        totalBattles: user?.battleStats?.totalBattles ?? 0,
        placement: p.placement,
      };
    });

    const eloChanges = calculateEloChanges(eloPlayers);

    // Update battle with placements and ELO changes
    const bulkPlayerUpdates: Record<string, unknown> = {};
    for (const p of placements) {
      const idx = battle.players.findIndex(
        (bp) => bp.user.toString() === p.userId,
      );
      if (idx !== -1) {
        bulkPlayerUpdates[`players.${idx}.placement`] = p.placement;
        bulkPlayerUpdates[`players.${idx}.eloChange`] =
          eloChanges.get(p.userId) ?? 0;
      }
    }

    await Battle.updateOne(
      { _id: battleId },
      { $set: bulkPlayerUpdates },
    );

    // Update each user's elo and battleStats
    for (const p of placements) {
      const change = eloChanges.get(p.userId) ?? 0;
      const user = userMap.get(p.userId);
      const currentStreak = user?.battleStats?.streak ?? 0;
      const currentBestStreak = user?.battleStats?.bestStreak ?? 0;

      const newStreak = p.placement === 1 ? currentStreak + 1 : 0;
      const newBestStreak = Math.max(currentBestStreak, newStreak);

      const statsUpdate: Record<string, number> = {
        elo: change,
        "battleStats.totalBattles": 1,
      };
      if (p.placement === 1) {
        statsUpdate["battleStats.wins"] = 1;
      } else {
        statsUpdate["battleStats.losses"] = 1;
      }

      await User.updateOne(
        { _id: new mongoose.Types.ObjectId(p.userId) },
        {
          $inc: statsUpdate,
          $set: {
            "battleStats.streak": newStreak,
            "battleStats.bestStreak": newBestStreak,
          },
        },
      );
    }

    // Snake-draft distribution
    const battlePulls = await BattlePull.find({ battle: battleId })
      .sort({ coinValue: -1 })
      .lean();

    const distributableCards = battlePulls.map((bp) => ({
      id: bp._id.toString(),
      coinValue: bp.coinValue,
    }));

    const playersByPlacement = placements.map((p) => p.userId);
    const distribution = snakeDraftDistribute(
      distributableCards,
      playersByPlacement,
    );

    // Update each BattlePull with distributedTo
    const bulkOps: AnyBulkWriteOperation<typeof BattlePull extends mongoose.Model<infer T> ? T : never>[] = [];
    for (const [userId, cards] of distribution) {
      for (const card of cards) {
        bulkOps.push({
          updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(card.id) },
            update: {
              $set: {
                distributedTo: new mongoose.Types.ObjectId(userId),
                status: "distributed",
              },
            },
          },
        });
      }
    }
    if (bulkOps.length > 0) {
      await BattlePull.bulkWrite(bulkOps);
    }

    // Set battle to finished
    await Battle.updateOne(
      { _id: battleId },
      { $set: { status: "finished", finishedAt: new Date() } },
    );

    /* ============================================================== */
    /*  5. PUBLISH RESULTS                                             */
    /* ============================================================== */
    publish(battleId, {
      type: "battle_end",
      placements: placements.map((p) => ({
        userId: p.userId,
        placement: p.placement,
        eloChange: eloChanges.get(p.userId) ?? 0,
        score: scores.get(p.userId) ?? 0,
      })),
    });

    // Publish distribution events per player
    for (const [userId, cards] of distribution) {
      publish(battleId, {
        type: "distribution",
        targetUserId: userId,
        cards: cards.map((c) => {
          const pull = battlePulls.find(
            (bp) => bp._id.toString() === c.id,
          );
          return {
            pullId: c.id,
            cardId: pull?.card.toString(),
            coinValue: c.coinValue,
          };
        }),
      });
    }

    // --- ACHIEVEMENTS ---
    const { checkAndAwardAchievements } = await import("./battle-achievements");
    for (const p of placements) {
      const playerEntry = battle.players.find(
        (bp) => bp.user.toString() === p.userId,
      );
      const userAfter = await User.findById(p.userId).select("elo").lean();
      const opponentMaxElo = Math.max(
        ...battle.players
          .filter((fp) => fp.user.toString() !== p.userId)
          .map((fp) => fp.eloAtStart),
      );

      // Calculate longest round streak for this player
      let longestStreak = 0;
      let currentStreak = 0;
      for (const round of rounds) {
        if (round.winnerId?.toString() === p.userId) {
          currentStreak++;
          longestStreak = Math.max(longestStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }

      // Check if player pulled an ultra rare
      const playerPulls = allPulls.filter((pull) => pull.userId === p.userId);
      const hadUltraRare = playerPulls.some(
        (pull) => (RARITY_ORDER[pull.rarity] ?? 0) >= 5,
      );

      await checkAndAwardAchievements({
        userId: p.userId,
        battleId: battleId,
        placement: p.placement,
        eloAtStart: playerEntry?.eloAtStart ?? 1000,
        eloAfter: (userAfter as Record<string, unknown> | null)?.elo as number ?? 1000,
        opponentMaxElo,
        longestRoundStreak: longestStreak,
        hadUltraRare,
      });
    }
  } catch (error) {
    console.error(`[battle-orchestrator] Error in battle ${battleId}:`, error);

    // Refund all players' coins
    try {
      const cancelledBattle = await Battle.findById(battleId).lean();
      if (cancelledBattle) {
        const CoinTransaction = (await import("@/models/coin-transaction")).default;
        for (const player of cancelledBattle.players) {
          const refundAmount = player.coinsReserved;
          if (refundAmount > 0) {
            await User.updateOne(
              { _id: player.user },
              { $inc: { coins: refundAmount } },
            );
            await CoinTransaction.create({
              userId: player.user,
              amount: refundAmount,
              type: "battle_refund",
              relatedBattleId: new mongoose.Types.ObjectId(battleId),
            });
          }
        }
      }
    } catch (refundErr) {
      console.error(`[battle-orchestrator] Refund failed for ${battleId}:`, refundErr);
    }

    await Battle.updateOne(
      { _id: battleId },
      { $set: { status: "cancelled" } },
    ).catch(() => {});

    publish(battleId, {
      type: "error",
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}
