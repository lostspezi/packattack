/**
 * Registers Mongoose post-save hooks that publish activity events to Redis.
 * Imported once at app start so each model gets exactly one hook attached.
 */
import type { CallbackWithoutResultAndOptionalError } from "mongoose";
import PackPull, { type IPackPull } from "@/models/pack-pull";
import Battle, { type IBattle } from "@/models/battle";
import CoinTransaction, { type ICoinTransaction } from "@/models/coin-transaction";
import { _internal, publishActivity } from "@/lib/dashboard/activity";

declare global {

  var _activityPublisherRegistered: boolean | undefined;
}

if (!global._activityPublisherRegistered) {
  global._activityPublisherRegistered = true;

  // ----- PackPull -----
  PackPull.schema.pre("save", function (
    this: IPackPull & { wasNew?: boolean },
    next: CallbackWithoutResultAndOptionalError
  ) {
    this.wasNew = this.isNew;
    next();
  });

  PackPull.schema.post("save", async function (this: IPackPull & { wasNew?: boolean }, doc: IPackPull) {
    if (!this.wasNew) return;
    try {
      await doc.populate({ path: "cardId", select: "name" });
      const item = _internal.pullToActivity(doc.toObject() as never);
      await publishActivity(String(doc.userId), item);
    } catch (err) {
      console.warn("[activity-publisher] pull hook failed:", (err as Error)?.message);
    }
  });

  // ----- Battle -----
  Battle.schema.pre("save", function (
    this: IBattle & { _publishFinished?: boolean },
    next: CallbackWithoutResultAndOptionalError
  ) {
    const becameFinished =
      this.isModified("status") && this.get("status") === "finished";
    this._publishFinished = becameFinished;
    next();
  });

  Battle.schema.post("save", async function (this: IBattle & { _publishFinished?: boolean }, doc: IBattle) {
    if (!this._publishFinished) return;
    try {
      const battle = doc.toObject() as never as {
        _id: unknown;
        result: unknown;
        players: { user: unknown }[];
        createdAt: Date;
        updatedAt: Date;
      };
      await Promise.all(
        battle.players.map((player) => {
          const userId = String(player.user);
          const item = _internal.battleToActivities(battle as never, userId);
          return item ? publishActivity(userId, item) : Promise.resolve();
        })
      );
    } catch (err) {
      console.warn("[activity-publisher] battle hook failed:", (err as Error)?.message);
    }
  });

  // ----- CoinTransaction -----
  CoinTransaction.schema.pre("save", function (
    this: ICoinTransaction & { wasNew?: boolean },
    next: CallbackWithoutResultAndOptionalError
  ) {
    this.wasNew = this.isNew;
    next();
  });

  CoinTransaction.schema.post("save", async function (this: ICoinTransaction & { wasNew?: boolean }, doc: ICoinTransaction) {
    if (!this.wasNew) return;
    try {
      const item = _internal.coinToActivity(doc.toObject() as never);
      if (item) await publishActivity(String(doc.userId), item);
    } catch (err) {
      console.warn("[activity-publisher] coin hook failed:", (err as Error)?.message);
    }
  });
}

export {};
