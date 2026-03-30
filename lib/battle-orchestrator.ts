import mongoose, { AnyBulkWriteOperation } from "mongoose";
import { getRedis } from "./redis";
import { drawPacks, PackCard } from "./pack-engine";
import {
  determineRoundWinner,
  calculatePlacements,
  snakeDraftDistribute,
  getRarityBonusMs,
  isCloseMatch,
  dealHands,
} from "./battle-engine";
import {
  storeSelection,
  getSelections,
  allPlayersSelected,
  clearSelections,
} from "@/lib/battle-selection";
import { calculateEloChanges } from "./battle-elo";
import {
  RARITY_ORDER,
  BATTLE_COUNTDOWN_SECONDS,
  READY_CHECK_TIMEOUT_SECONDS,
  ROUND_ANNOUNCE_MS,
  ROUND_BUILDUP_MS,
  CARD_REVEAL_FLIP_MS,
  CARD_REVEAL_DISPLAY_MS,
  BETWEEN_REVEALS_MS,
  COMPARISON_PAUSE_MS,
  WINNER_REVEAL_MS,
  WINNER_CLOSE_REVEAL_MS,
  SCORE_UPDATE_MS,
  ROUND_TRANSITION_MS,
  ELO_FLOOR,
  ELO_DEFAULT,
  HAND_SIZE,
  SELECTION_TIMEOUT_MS,
  HAND_DEAL_MS,
  HAND_REVEAL_MS,
  SELECTION_WAIT_DISPLAY_MS,
  SIMULTANEOUS_REVEAL_MS,
  COIN_VALUE_EFFECT_THRESHOLDS,
} from "./battle-constants";
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

async function waitForSelections(
  battleId: string,
  roundIndex: number,
  playerIds: string[],
  timeoutMs: number
): Promise<Record<string, number>> {
  const pollInterval = 500;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const allDone = await allPlayersSelected(battleId, roundIndex, playerIds);
    if (allDone) {
      return getSelections(battleId, roundIndex);
    }
    await sleep(pollInterval);
  }

  // Timeout — get whatever selections exist, fill missing with random
  const selections = await getSelections(battleId, roundIndex);
  for (const playerId of playerIds) {
    if (!(playerId in selections)) {
      const randomIndex = Math.floor(Math.random() * HAND_SIZE);
      selections[playerId] = randomIndex;
      await storeSelection(battleId, roundIndex, playerId, randomIndex);
    }
  }
  return selections;
}

function getCoinValueEffectTier(coinValue: number): string {
  if (coinValue >= COIN_VALUE_EFFECT_THRESHOLDS.extreme) return "extreme";
  if (coinValue >= COIN_VALUE_EFFECT_THRESHOLDS.high) return "high";
  if (coinValue >= COIN_VALUE_EFFECT_THRESHOLDS.medium) return "medium";
  return "low";
}

/* ------------------------------------------------------------------ */
/*  Ready-check                                                        */
/* ------------------------------------------------------------------ */

export async function startReadyCheck(battleId: string): Promise<void> {
  await Battle.updateOne(
    { _id: battleId },
    {
      $set: {
        status: "ready_check",
        readyCheckStartedAt: new Date(),
      },
    },
  );

  publish(battleId, {
    type: "ready_check_start",
    timeoutSeconds: READY_CHECK_TIMEOUT_SECONDS,
  });

  // Wait for the timeout period
  await sleep(READY_CHECK_TIMEOUT_SECONDS * 1000);

  // Re-check battle state — it may have already started if all went ready
  const battle = await Battle.findById(battleId).lean();
  if (!battle || battle.status !== "ready_check") {
    // Battle already started (all players went ready) or was cancelled
    return;
  }

  // Kick non-ready players and refund their coins
  const CoinTransaction = (await import("@/models/coin-transaction")).default;
  const notReadyPlayers = battle.players.filter((p) => !p.ready);
  const readyPlayers = battle.players.filter((p) => p.ready);

  for (const player of notReadyPlayers) {
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

  // Remove non-ready players, reset ready status on remaining, go back to waiting
  const kickedUserIds = notReadyPlayers.map((p) => p.user.toString());

  await Battle.updateOne(
    { _id: battleId },
    {
      $set: {
        status: "waiting",
        readyCheckStartedAt: null,
      },
      $pull: {
        players: { user: { $in: notReadyPlayers.map((p) => p.user) } },
      },
    },
  );

  // Reset ready status for remaining players
  if (readyPlayers.length > 0) {
    for (let i = 0; i < readyPlayers.length; i++) {
      await Battle.updateOne(
        { _id: battleId, "players.user": readyPlayers[i].user },
        { $set: { "players.$.ready": false } },
      );
    }
  }

  publish(battleId, {
    type: "players_kicked",
    kickedUserIds,
    refunded: true,
  });
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
      .select("name image internalPrice")
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
        const roundIndex = drawn.packIndex;
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
    const totalRounds = battle.packsPerPlayer;
    const rounds = [];
    for (let r = 0; r < totalRounds; r++) {
      rounds.push({
        roundIndex: r,
        cards: [],
        hands: [],
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
    /*  3. CLASH ROUNDS — card selection                               */
    /* ============================================================== */
    await Battle.updateOne({ _id: battleId }, { $set: { status: "clash" } });

    // Re-fetch for fresh state
    const freshBattle = await Battle.findById(battleId).lean();
    if (!freshBattle) throw new Error(`Battle ${battleId} not found after opening`);

    const scores = new Map<string, number>();
    const playerIds = freshBattle.players.map(
      (p: { user: { toString(): string } }) => p.user.toString()
    );
    for (const pid of playerIds) scores.set(pid, 0);

    for (let r = 0; r < totalRounds; r++) {
      // 1. Round announcement
      publish(battleId, {
        type: "round_announce",
        roundIndex: r,
        totalRounds,
      });
      await sleep(ROUND_ANNOUNCE_MS);

      // 2. Deal hands — pick HAND_SIZE cards per player from the round's card pool
      const roundPulls = allPulls.filter((p) => p.roundIndex === r);
      const hands = dealHands(
        roundPulls.map((p) => ({
          card: p.cardId,
          coinValue: p.coinValue,
          rarity: p.rarity,
          name: p.name,
          image: p.image,
        })),
        playerIds
      );

      // Store hands in DB
      await Battle.updateOne(
        { _id: battleId },
        { $set: { [`rounds.${r}.hands`]: hands.map((h) => ({
          player: h.player,
          dealtCards: h.dealtCards,
          selectedIndex: null,
        }))}}
      );

      // 3. Send hand_dealt to each player (player-specific — filtered by events route)
      for (const hand of hands) {
        publish(battleId, {
          type: "hand_dealt",
          targetUserId: hand.player,
          roundIndex: r,
          cards: hand.dealtCards.map((c, i) => ({
            index: i,
            card: c.card,
            coinValue: c.coinValue,
            rarity: c.rarity,
            name: c.name,
            image: c.image,
          })),
        });
      }
      await sleep(HAND_DEAL_MS + HAND_REVEAL_MS);

      // 4. Wait for all players to select (or timeout)
      const selections = await waitForSelections(
        battleId,
        r,
        playerIds,
        SELECTION_TIMEOUT_MS
      );

      await sleep(SELECTION_WAIT_DISPLAY_MS);

      // 5. Build played cards from selections
      const playedCards = playerIds.map((pid) => {
        const hand = hands.find((h) => h.player === pid)!;
        const selectedIdx = selections[pid];
        const card = hand.dealtCards[selectedIdx];
        return {
          player: pid,
          card: card.card,
          coinValue: card.coinValue,
          rarity: card.rarity,
          name: card.name,
          image: card.image,
        };
      });

      // 6. Simultaneous reveal — send all cards to everyone
      const maxCoinValue = Math.max(...playedCards.map((c) => c.coinValue));
      publish(battleId, {
        type: "cards_reveal",
        roundIndex: r,
        cards: playedCards.map((c) => ({
          playerId: c.player,
          card: { _id: c.card, name: c.name, image: c.image },
          coinValue: c.coinValue,
          rarity: c.rarity,
          effectTier: getCoinValueEffectTier(c.coinValue),
        })),
        highestEffectTier: getCoinValueEffectTier(maxCoinValue),
      });
      await sleep(SIMULTANEOUS_REVEAL_MS);

      // 7. Determine winner
      const roundCards = playedCards.map((c) => ({
        playerId: c.player,
        coinValue: c.coinValue,
        rarity: c.rarity,
      }));
      const winnerId = determineRoundWinner(roundCards);
      const isClose = isCloseMatch(roundCards);

      // 8. Update DB: store played cards and winner in round
      await Battle.updateOne(
        { _id: battleId },
        {
          $set: {
            [`rounds.${r}.cards`]: playedCards.map((c) => ({
              player: c.player,
              card: c.card,
              rarity: c.rarity,
              coinValue: c.coinValue,
            })),
            [`rounds.${r}.winnerId`]: winnerId,
            [`rounds.${r}.revealedAt`]: new Date(),
            currentRound: r,
          },
        }
      );

      // Update scores
      if (winnerId) {
        scores.set(winnerId, (scores.get(winnerId) || 0) + 1);
        await Battle.updateOne(
          { _id: battleId, "players.user": winnerId },
          { $inc: { "players.$.score": 1 } }
        );
      }

      // Update local rounds for achievements
      rounds[r].winnerId = winnerId ? new mongoose.Types.ObjectId(winnerId) : null;

      // 9. Publish round result
      publish(battleId, {
        type: "round_result",
        roundIndex: r,
        winnerId,
        scores: Object.fromEntries(scores),
        isClose,
      });

      // Timing for winner reveal
      await sleep(isClose ? WINNER_CLOSE_REVEAL_MS : WINNER_REVEAL_MS);
      await sleep(SCORE_UPDATE_MS);

      // Cleanup Redis selections for this round
      await clearSelections(battleId, r);

      // Round transition (except after last round)
      if (r < totalRounds - 1) {
        await sleep(ROUND_TRANSITION_MS);
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
        elo: user?.elo ?? ELO_DEFAULT,
        totalBattles: user?.battleStats?.totalBattles ?? 0,
        placement: p.placement,
      };
    });

    const eloChanges = calculateEloChanges(eloPlayers);

    // Clamp to floor: prevent any user from dropping below ELO_FLOOR
    const clampedEloChanges = new Map<string, number>();
    for (const p of placements) {
      const change = eloChanges.get(p.userId) ?? 0;
      const user = userMap.get(p.userId);
      const currentElo = user?.elo ?? ELO_DEFAULT;
      clampedEloChanges.set(p.userId, Math.max(change, ELO_FLOOR - currentElo));
    }

    // Update battle with placements and ELO changes
    const bulkPlayerUpdates: Record<string, unknown> = {};
    for (const p of placements) {
      const idx = battle.players.findIndex(
        (bp) => bp.user.toString() === p.userId,
      );
      if (idx !== -1) {
        bulkPlayerUpdates[`players.${idx}.placement`] = p.placement;
        bulkPlayerUpdates[`players.${idx}.eloChange`] =
          clampedEloChanges.get(p.userId) ?? 0;
      }
    }

    await Battle.updateOne(
      { _id: battleId },
      { $set: bulkPlayerUpdates },
    );

    // Update each user's elo and battleStats
    for (const p of placements) {
      const change = clampedEloChanges.get(p.userId) ?? 0;
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
        eloChange: clampedEloChanges.get(p.userId) ?? 0,
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
          const originalPull = allPulls.find(
            (ap) => ap.cardId === pull?.card.toString(),
          );
          return {
            pullId: c.id,
            card: {
              _id: pull?.card.toString(),
              name: originalPull?.name ?? "Unknown",
              image: originalPull?.image ?? null,
            },
            rarity: pull?.rarity ?? "Common",
            coinValue: c.coinValue,
            conversionValue: pull?.conversionValue ?? c.coinValue,
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
