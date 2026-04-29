import { randomInt } from "node:crypto";
import mongoose, { Document, Model, Schema, Types } from "mongoose";

/**
 * Singleton-Doc, das jeden geöffneten Pack global zählt. Der `nextTriggerAt`-
 * Wert wird im Sliding Window 9500..10500 nach jedem Trigger neu gewürfelt,
 * damit der Drop-Zeitpunkt nicht durch reines Counter-Stalking vorhersagbar
 * ist. Der Counter läuft monoton weiter (kein Reset auf 0), dadurch bleibt
 * History-Audit lückenlos.
 */
export interface IGodpackCounter extends Document {
  _id: Types.ObjectId;
  totalPacksOpened: number;
  nextTriggerAt: number;
  lastTriggerAt: Date | null;
  lastTriggerCount: number | null;
  lastTriggerUserId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const GodpackCounterSchema = new Schema<IGodpackCounter>(
  {
    totalPacksOpened: { type: Number, required: true, default: 0, min: 0 },
    nextTriggerAt: {
      type: Number,
      required: true,
      min: 1,
      default: () => rollNextTriggerGap(),
    },
    lastTriggerAt: { type: Date, default: null },
    lastTriggerCount: { type: Number, default: null, min: 0 },
    lastTriggerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

const GodpackCounter: Model<IGodpackCounter> =
  mongoose.models.GodpackCounter ??
  mongoose.model<IGodpackCounter>("GodpackCounter", GodpackCounterSchema);

export default GodpackCounter;

/**
 * Min-/Max-Bucket für den nächsten Trigger. Auf `nextTriggerAt` wird also
 * `totalPacksOpened` plus eine ganze Zahl in [GODPACK_TRIGGER_MIN_GAP,
 * GODPACK_TRIGGER_MAX_GAP] addiert.
 */
export const GODPACK_TRIGGER_MIN_GAP = 9500;
export const GODPACK_TRIGGER_MAX_GAP = 10500;

export function rollNextTriggerGap(): number {
  // crypto.randomInt nutzt /dev/urandom-Niveau-Entropie statt Math.random's
  // V8-PRNG — ein Server-Admin kann die Trigger-Sequenz dann nicht aus dem
  // Node-Prozessstate ableiten.
  return randomInt(GODPACK_TRIGGER_MIN_GAP, GODPACK_TRIGGER_MAX_GAP + 1);
}
