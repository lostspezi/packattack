/**
 * Godpack draw engine.
 *
 * Baut den franchise-weiten Pool (alle published Boxen mit demselben `game`),
 * filtert auf Karten ≥ Mindest-Coin-Wert und zieht via Provably-Fair-RNG fünf
 * unique Karten. Pool-Build und Draw sind absichtlich getrennt: der Build
 * läuft unabhängig vom RNG, damit der `poolHash` stabil bleibt und der
 * Verifier die Auswahl nachrechnen kann.
 *
 * Eingang von `app/api/packs/[id]/open/route.ts` → wenn der globale
 * GodpackCounter den Trigger erreicht, wird hier ein eigener Commitment für
 * den Godpack-Draw gebildet (separat vom regulären Pack-Commitment).
 */

import { Types } from "mongoose";
import Box, { type IBox } from "@/models/box";
import Card, { type ICard } from "@/models/card";
import {
  scaleWeight,
  totalWeightOf,
  walkPool,
  type PoolEntry,
  type RngStep,
} from "@/lib/fairness";

export const GODPACK_CARD_COUNT = 5;
export const GODPACK_MIN_COIN_VALUE = 20;
export const GODPACK_FALLBACK_MIN_COIN_VALUE = 10;
/** Pool muss mindestens so groß sein, damit der primäre Filter (≥ 20) genutzt wird. */
export const GODPACK_MIN_POOL_SIZE_FOR_PRIMARY = 10;
/** Wenn auch der Fallback (≥ 10) den Pool unter diese Grenze drückt, wird der Godpack übersprungen. */
export const GODPACK_MIN_POOL_SIZE = GODPACK_CARD_COUNT;

export interface GodpackPoolEntry {
  cardId: string;
  sourceBoxId: string;
  name: string;
  image: string | null;
  rarity: string;
  coinValue: number;
}

export interface GodpackPool {
  game: string;
  entries: GodpackPoolEntry[];
  fallbackUsed: boolean;
  /** True, wenn Pool < GODPACK_MIN_POOL_SIZE — Caller MUSS dann den Godpack-Draw überspringen. */
  insufficient: boolean;
}

export interface GodpackDrawnCard {
  cardId: string;
  sourceBoxId: string;
  name: string;
  image: string | null;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  position: number;
}

interface RawCandidate {
  cardId: string;
  sourceBoxId: string;
  name: string;
  image: string | null;
  rarity: string;
  coinValue: number;
  stock: number;
}

function computeCoinValue(card: Pick<ICard, "internalPrice" | "marketPrice"> | null): number {
  const raw = card?.internalPrice ?? card?.marketPrice ?? 1;
  return Math.max(1, Math.floor(raw));
}

/**
 * Lädt alle published Boxen des Franchise und baut eine deduplizierte
 * Karten-Liste mit ≥ minCoinValue. Wenn die gleiche Karte in mehreren Boxen
 * erscheint, gewinnt die Box mit dem höchsten verfügbaren Stock — so steht
 * der Stock-Dekrement-Schritt später auf der Box, die ihn am ehesten verträgt.
 */
async function buildCandidates(game: string, minCoinValue: number): Promise<RawCandidate[]> {
  const boxes = await Box.find({ game, status: "published" })
    .select("_id cards")
    .lean<Pick<IBox, "_id" | "cards">[]>();

  if (boxes.length === 0) return [];

  const cardIdSet = new Set<string>();
  for (const box of boxes) {
    for (const entry of box.cards ?? []) {
      cardIdSet.add(entry.card.toString());
    }
  }

  if (cardIdSet.size === 0) return [];

  const cards = await Card.find({ _id: { $in: [...cardIdSet] } })
    .select("_id name image rarity internalPrice marketPrice")
    .lean<
      Array<
        Pick<ICard, "name" | "image" | "rarity" | "internalPrice" | "marketPrice"> & {
          _id: Types.ObjectId;
        }
      >
    >();

  const cardMap = new Map(cards.map((c) => [c._id.toString(), c]));

  const byCardId = new Map<string, RawCandidate>();

  for (const box of boxes) {
    const boxIdStr = box._id.toString();
    for (const entry of box.cards ?? []) {
      const stock = entry.stock ?? 0;
      if (stock <= 0) continue;
      const cardIdStr = entry.card.toString();
      const cardDoc = cardMap.get(cardIdStr);
      if (!cardDoc) continue;
      const coinValue = computeCoinValue(cardDoc);
      if (coinValue < minCoinValue) continue;

      const candidate: RawCandidate = {
        cardId: cardIdStr,
        sourceBoxId: boxIdStr,
        name: cardDoc.name,
        image: cardDoc.image ?? null,
        rarity: entry.rarity,
        coinValue,
        stock,
      };

      const existing = byCardId.get(cardIdStr);
      if (!existing || candidate.stock > existing.stock) {
        byCardId.set(cardIdStr, candidate);
      }
    }
  }

  return [...byCardId.values()];
}

export async function buildGodpackPool(game: string): Promise<GodpackPool> {
  const primary = await buildCandidates(game, GODPACK_MIN_COIN_VALUE);

  if (primary.length >= GODPACK_MIN_POOL_SIZE_FOR_PRIMARY) {
    return {
      game,
      entries: primary.map(toPoolEntry),
      fallbackUsed: false,
      insufficient: false,
    };
  }

  const fallback = await buildCandidates(game, GODPACK_FALLBACK_MIN_COIN_VALUE);

  if (fallback.length >= GODPACK_MIN_POOL_SIZE) {
    return {
      game,
      entries: fallback.map(toPoolEntry),
      fallbackUsed: true,
      insufficient: false,
    };
  }

  return {
    game,
    entries: fallback.map(toPoolEntry),
    fallbackUsed: true,
    insufficient: true,
  };
}

function toPoolEntry(c: RawCandidate): GodpackPoolEntry {
  return {
    cardId: c.cardId,
    sourceBoxId: c.sourceBoxId,
    name: c.name,
    image: c.image,
    rarity: c.rarity,
    coinValue: c.coinValue,
  };
}

/**
 * Provably-fair Draw von genau GODPACK_CARD_COUNT unique Karten. Gleichgewichtet —
 * jede Karte im gefilterten Pool hat dieselbe Auswahlchance, der Coin-Filter
 * trägt die Wertigkeit. Nach jedem Draw fliegt die Karte aus dem Pool, damit
 * ein Godpack niemals Duplikate enthält.
 *
 * Der Pool wird vor dem Draw deterministisch sortiert (cardId asc) — derselben
 * Reihenfolge muss der Verifier beim Replay folgen, da `walkPool` index-basiert
 * arbeitet.
 */
export async function drawGodpack(args: {
  pool: GodpackPool;
  rng: RngStep;
}): Promise<GodpackDrawnCard[]> {
  if (args.pool.insufficient) {
    throw new Error("drawGodpack: pool is insufficient — caller must skip godpack");
  }

  const sorted = [...args.pool.entries].sort((a, b) => a.cardId.localeCompare(b.cardId));

  const remainingEntries: GodpackPoolEntry[] = [...sorted];
  const remainingPool: PoolEntry[] = sorted.map((e) => ({
    cardId: e.cardId,
    weight: scaleWeight(1),
    stock: 1,
  }));

  const drawn: GodpackDrawnCard[] = [];

  for (let position = 1; position <= GODPACK_CARD_COUNT; position++) {
    if (remainingPool.length === 0) break;
    const totalWeight = totalWeightOf(remainingPool);
    const bucket = await args.rng(totalWeight);
    const idx = walkPool(remainingPool, bucket);
    const picked = remainingEntries[idx];
    drawn.push({
      cardId: picked.cardId,
      sourceBoxId: picked.sourceBoxId,
      name: picked.name,
      image: picked.image,
      rarity: picked.rarity,
      coinValue: picked.coinValue,
      conversionValue: picked.coinValue,
      position,
    });
    remainingEntries.splice(idx, 1);
    remainingPool.splice(idx, 1);
  }

  return drawn;
}

/**
 * Pool-Snapshot fürs Commitment. Stock = 1 pro Karte (unique Draw-Modell).
 */
export function poolSnapshotEntries(pool: GodpackPool): PoolEntry[] {
  return [...pool.entries]
    .sort((a, b) => a.cardId.localeCompare(b.cardId))
    .map((e) => ({
      cardId: e.cardId,
      weight: scaleWeight(1),
      stock: 1,
    }));
}
