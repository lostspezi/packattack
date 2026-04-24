import { Types } from "mongoose";
import { getRedis } from "@/lib/redis";
import connectDB from "@/lib/db";
import PackPull from "@/models/pack-pull";
import Battle from "@/models/battle";
import CoinTransaction from "@/models/coin-transaction";
import Card from "@/models/card";
import User from "@/models/user";

export const COIN_THRESHOLD = 100;

export type ActivityKind = "pull" | "battle" | "coin";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  createdAt: string;
  /** Display title, e.g. "Holo gezogen aus 'Box X'" or "Battle gewonnen" */
  title: string;
  /** Optional supporting line */
  detail: string;
  /** Optional positive/negative tone hint for UI */
  tone: "positive" | "negative" | "neutral";
  /** Optional payload for client-side rendering */
  meta: Record<string, unknown>;
}

export function activityChannel(userId: string): string {
  return `dashboard:activity:${userId}`;
}

export async function publishActivity(
  userId: string | Types.ObjectId,
  item: ActivityItem
): Promise<void> {
  try {
    const redis = getRedis();
    await redis.publish(activityChannel(String(userId)), JSON.stringify(item));
  } catch (err) {
    console.warn("[activity] publish failed:", (err as Error)?.message);
  }
}

interface RawPull {
  _id: unknown;
  rarity: string;
  coinValue: number;
  status: string;
  cardId: { _id: unknown; name?: string } | unknown;
  createdAt: Date;
}

function rarityToTone(rarity: string): "positive" | "neutral" {
  const r = rarity.toLowerCase();
  if (r.includes("legendary") || r.includes("ultra") || r.includes("secret"))
    return "positive";
  return "neutral";
}

function pullToActivity(pull: RawPull): ActivityItem {
  const card = pull.cardId as { name?: string } | null;
  const cardName = card?.name ?? "Karte";
  return {
    id: `pull:${String(pull._id)}`,
    kind: "pull",
    createdAt: pull.createdAt.toISOString(),
    title: `${cardName} gezogen`,
    detail: `${pull.rarity} · ${pull.coinValue} Coins`,
    tone: rarityToTone(pull.rarity),
    meta: {
      pullId: String(pull._id),
      rarity: pull.rarity,
      coinValue: pull.coinValue,
      status: pull.status,
    },
  };
}

interface RawBattleResult {
  _id: unknown;
  result: {
    winner: unknown;
    eloChanges?: { player: unknown; newElo: number; delta: number }[];
    completedAt?: Date;
  } | null;
  players: { user: unknown }[];
  createdAt: Date;
  updatedAt: Date;
}

function battleToActivities(
  battle: RawBattleResult,
  forUserId: string
): ActivityItem | null {
  if (!battle.result) return null;
  const won = String(battle.result.winner) === forUserId;
  const elo = battle.result.eloChanges?.find(
    (e) => String(e.player) === forUserId
  );
  const eloDelta = elo?.delta ?? 0;
  const sign = eloDelta > 0 ? "+" : "";
  const tone = won ? "positive" : "negative";
  return {
    id: `battle:${String(battle._id)}:${forUserId}`,
    kind: "battle",
    createdAt: (battle.result.completedAt ?? battle.updatedAt).toISOString(),
    title: won ? "Battle gewonnen" : "Battle verloren",
    detail: elo ? `Elo ${sign}${eloDelta}` : "",
    tone,
    meta: {
      battleId: String(battle._id),
      won,
      eloDelta,
    },
  };
}

interface RawCoinTx {
  _id: unknown;
  amount: number;
  type: string;
  createdAt: Date;
}

const COIN_TYPE_LABEL: Record<string, string> = {
  pack_purchase: "Pack gekauft",
  card_conversion: "Karten umgewandelt",
  battle_entry: "Battle-Einsatz",
  battle_payout: "Battle-Gewinn",
  signup_bonus: "Anmelde-Bonus",
  tour_reward: "Tour-Belohnung",
  admin_grant: "Admin-Gutschrift",
  refund: "Rückerstattung",
};

function coinToActivity(tx: RawCoinTx): ActivityItem | null {
  if (Math.abs(tx.amount) < COIN_THRESHOLD) return null;
  const sign = tx.amount > 0 ? "+" : "";
  const tone = tx.amount > 0 ? "positive" : "negative";
  const label = COIN_TYPE_LABEL[tx.type] ?? "Coin-Bewegung";
  return {
    id: `coin:${String(tx._id)}`,
    kind: "coin",
    createdAt: tx.createdAt.toISOString(),
    title: label,
    detail: `${sign}${tx.amount} Coins`,
    tone,
    meta: {
      txId: String(tx._id),
      type: tx.type,
      amount: tx.amount,
    },
  };
}

interface SnapshotOptions {
  limit?: number;
}

export async function getActivitySnapshot(
  userId: string,
  opts: SnapshotOptions = {}
): Promise<ActivityItem[]> {
  await connectDB();
  void User; // ensure model registered
  void Card;

  const limit = Math.min(50, Math.max(5, opts.limit ?? 20));
  const userObjectId = new Types.ObjectId(userId);

  const [pulls, battles, coins] = await Promise.all([
    PackPull.find({ userId: userObjectId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({ path: "cardId", select: "name" })
      .lean(),
    Battle.find({
      "players.user": userObjectId,
      status: "finished",
      result: { $ne: null },
    })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean(),
    CoinTransaction.find({
      userId: userObjectId,
      $or: [
        { amount: { $gte: COIN_THRESHOLD } },
        { amount: { $lte: -COIN_THRESHOLD } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  const items: ActivityItem[] = [];

  for (const pull of pulls as unknown as RawPull[]) {
    items.push(pullToActivity(pull));
  }
  for (const battle of battles as unknown as RawBattleResult[]) {
    const item = battleToActivities(battle, userId);
    if (item) items.push(item);
  }
  for (const tx of coins as unknown as RawCoinTx[]) {
    const item = coinToActivity(tx);
    if (item) items.push(item);
  }

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return items.slice(0, limit);
}

// Helpers exposed for the publisher
export const _internal = {
  pullToActivity,
  battleToActivities,
  coinToActivity,
};
