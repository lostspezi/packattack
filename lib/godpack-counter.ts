/**
 * Trigger-Logik für den globalen Godpack-Counter.
 *
 * Der Counter ist ein einziges Singleton-Doc; jeder Pack-Open inkrementiert
 * `totalPacksOpened` atomar und prüft danach, ob der Sprung den momentanen
 * `nextTriggerAt` überquert hat. Der überquerende User bekommt das Godpack
 * (genau einer dank `findOneAndUpdate`).
 *
 * Wenn der Trigger verfehlt wird, weil der Franchise-Pool zu klein ist,
 * lassen wir `nextTriggerAt` bewusst stehen — der nächste Pack-Pull triggert
 * dann erneut. So bleibt der ~10k-Rhythmus über die gesamte Plattform stabil,
 * auch wenn ein einzelnes Franchise nicht spielen kann.
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
  /** Wert von `nextTriggerAt`, der beim Trigger gerade gültig war. Wird zum Advance referenziert. */
  triggeredAt: number | null;
}

export async function incrementGodpackCounter(
  packCount: number,
): Promise<CounterIncrementResult> {
  if (!Number.isInteger(packCount) || packCount <= 0) {
    throw new Error(`incrementGodpackCounter: invalid packCount ${packCount}`);
  }

  const after = await GodpackCounter.findOneAndUpdate(
    {},
    {
      $inc: { totalPacksOpened: packCount },
      $setOnInsert: { nextTriggerAt: rollNextTriggerGap() },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    },
  );

  if (!after) {
    throw new Error("incrementGodpackCounter: counter not returned after upsert");
  }

  const next = after.totalPacksOpened;
  const prev = next - packCount;
  const trigger = after.nextTriggerAt;

  const triggered = next >= trigger && prev < trigger;
  const godpackPackIndex = triggered ? trigger - prev - 1 : null;

  return {
    counter: after,
    triggered,
    godpackPackIndex,
    triggeredAt: triggered ? trigger : null,
  };
}

/**
 * Wird aufgerufen, NACHDEM ein Godpack erfolgreich gezogen wurde. Setzt den
 * nächsten Trigger-Bucket relativ zum bisherigen `nextTriggerAt` (nicht zum
 * aktuellen Counter), damit die Durchschnitts-Frequenz stabil bei ~10k bleibt.
 *
 * Conditional auf den alten Trigger-Wert: schützt gegen versehentliche
 * Doppel-Advance, falls dieselbe Funktion in einem unwahrscheinlichen
 * Edge-Case zweimal liefe.
 */
export async function advanceGodpackTrigger(args: {
  previousTriggerAt: number;
  triggerCount: number;
  userId: Types.ObjectId | string;
}): Promise<void> {
  const newGap = rollNextTriggerGap();
  await GodpackCounter.updateOne(
    { nextTriggerAt: args.previousTriggerAt },
    {
      $set: {
        nextTriggerAt: args.previousTriggerAt + newGap,
        lastTriggerAt: new Date(),
        lastTriggerCount: args.triggerCount,
        lastTriggerUserId: new Types.ObjectId(args.userId),
      },
    },
  );
}
