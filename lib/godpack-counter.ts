/**
 * Trigger-Logik für den globalen Godpack-Counter.
 *
 * Der Counter ist ein einziges Singleton-Doc; jeder Pack-Open inkrementiert
 * `totalPacksOpened` atomar UND advanced bei Bedarf den `nextTriggerAt` in
 * derselben Pipeline. Damit ist der Trigger-Claim race-frei — selbst zwei
 * Multi-Opens, die im selben Augenblick die Trigger-Schwelle überqueren,
 * sehen über die atomare findOneAndUpdate-Serialisierung getrennte Pre-/
 * Post-Werte und nur einer "claimt" das Godpack.
 *
 * Wenn der gewinnende Caller später feststellt, dass der Franchise-Pool zu
 * klein ist, kann er den Trigger via `retractGodpackTrigger` auf den
 * unmittelbar nächsten Pack-Pull verschieben — so geht der Drop nicht
 * verloren, das nächste Open (egal in welchem Franchise) feuert ihn neu ab.
 */

import { Types } from "mongoose";
import GodpackCounter, {
  rollNextTriggerGap,
  type IGodpackCounter,
} from "@/models/godpack-counter";

export interface CounterIncrementResult {
  counter: IGodpackCounter;
  triggered: boolean;
  /** 0-basierter Pack-Index innerhalb der aktuellen Multi-Open, der den Trigger trifft. Null wenn nicht getriggert. */
  godpackPackIndex: number | null;
  /** Wert von `nextTriggerAt`, der beim Trigger gerade gültig war. */
  triggeredAt: number | null;
}

export async function incrementGodpackCounter(
  packCount: number,
  userId: Types.ObjectId | string,
): Promise<CounterIncrementResult> {
  if (!Number.isInteger(packCount) || packCount <= 0) {
    throw new Error(`incrementGodpackCounter: invalid packCount ${packCount}`);
  }

  const initialGap = rollNextTriggerGap();
  const advanceGap = rollNextTriggerGap();
  const userObjectId = new Types.ObjectId(userId);

  const after = await GodpackCounter.findOneAndUpdate(
    {},
    [
      // Stage 1: Pre-Werte snapshotten — Default-Werte falls Doc neu ist
      {
        $set: {
          _prevTotal: { $ifNull: ["$totalPacksOpened", 0] },
          _prevTrigger: { $ifNull: ["$nextTriggerAt", initialGap] },
        },
      },
      // Stage 2: Inkrement und Trigger-Check (intermediate flag _triggered)
      {
        $set: {
          totalPacksOpened: { $add: ["$_prevTotal", packCount] },
          _triggered: {
            $and: [
              { $lt: ["$_prevTotal", "$_prevTrigger"] },
              { $gte: [{ $add: ["$_prevTotal", packCount] }, "$_prevTrigger"] },
            ],
          },
        },
      },
      // Stage 3: Conditional Advance + Audit-Felder schreiben
      {
        $set: {
          nextTriggerAt: {
            $cond: {
              if: "$_triggered",
              then: { $add: ["$_prevTrigger", advanceGap] },
              else: "$_prevTrigger",
            },
          },
          lastTriggerAt: {
            $cond: { if: "$_triggered", then: "$$NOW", else: "$lastTriggerAt" },
          },
          lastTriggerCount: {
            $cond: { if: "$_triggered", then: "$_prevTrigger", else: "$lastTriggerCount" },
          },
          lastTriggerUserId: {
            $cond: { if: "$_triggered", then: userObjectId, else: "$lastTriggerUserId" },
          },
        },
      },
      { $unset: ["_prevTotal", "_prevTrigger", "_triggered"] },
    ],
    {
      upsert: true,
      returnDocument: "after",
    },
  );

  if (!after) {
    throw new Error("incrementGodpackCounter: counter not returned after upsert");
  }

  const next = after.totalPacksOpened;
  const prev = next - packCount;
  const lastTriggerCount = after.lastTriggerCount;

  // Triggered iff der zuletzt gewonnene Trigger-Punkt im Inkrement-Range dieses
  // Calls liegt — andere Caller, die parallel den Counter weiter geschoben
  // haben, sehen ein lastTriggerCount außerhalb ihres eigenen Pre-/Post-Range.
  const triggered =
    lastTriggerCount != null && lastTriggerCount > prev && lastTriggerCount <= next;
  const godpackPackIndex = triggered ? lastTriggerCount - prev - 1 : null;

  return {
    counter: after,
    triggered,
    godpackPackIndex,
    triggeredAt: triggered ? lastTriggerCount : null,
  };
}

/**
 * Verschiebt den nächsten Godpack-Trigger auf den unmittelbar nachfolgenden
 * Pack-Pull, ohne den Counter selbst zurückzudrehen. Wird vom Caller benutzt,
 * wenn der claim-gewinnende User keinen brauchbaren Franchise-Pool zusammen-
 * bekommt. Best-effort: läuft auch dann sauber, wenn ein paralleler Caller
 * inzwischen schon den Trigger weiter geschoben hat.
 */
export async function retractGodpackTrigger(): Promise<void> {
  const counter = await GodpackCounter.findOne({}).lean();
  if (!counter) return;
  await GodpackCounter.updateOne(
    { _id: counter._id },
    { $set: { nextTriggerAt: counter.totalPacksOpened + 1 } },
  );
}
