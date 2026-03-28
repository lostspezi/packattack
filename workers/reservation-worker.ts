import { RESERVATION_QUEUE, createWorker, getQueue } from "@/lib/queue";
import connectDB from "@/lib/db";
import CartItem from "@/models/cart-item";
import PackPull from "@/models/pack-pull";
import User from "@/models/user";
import Box from "@/models/box";
import CoinTransaction from "@/models/coin-transaction";
import Notification from "@/models/notification";
import { runRedisCommand } from "@/lib/redis";
import mongoose from "mongoose";

async function processExpiredReservations() {
  await connectDB();

  const now = new Date();
  const expiredItems = await CartItem.find({
    status: "reserved",
    expiresAt: { $lt: now },
  }).lean();

  if (expiredItems.length === 0) return;

  const userCoinsMap = new Map<string, number>();

  for (const item of expiredItems) {
    await CartItem.updateOne(
      { _id: item._id, status: "reserved" },
      { status: "expired" }
    );

    await PackPull.updateOne(
      { _id: item.pullId, status: "reserved" },
      { status: "converted", decidedAt: now }
    );

    await User.findByIdAndUpdate(item.userId, {
      $inc: { coins: item.conversionValue },
    });

    const cardObjectId = new mongoose.Types.ObjectId(item.cardId.toString());
    await Box.updateOne(
      { _id: item.boxId, "cards.card": cardObjectId },
      { $inc: { "cards.$.stock": 1 } }
    );

    await CoinTransaction.create({
      userId: item.userId,
      amount: item.conversionValue,
      type: "reservation_expired",
      reason: "Reservation expired after 6 hours",
      relatedPullId: item.pullId,
      relatedBoxId: item.boxId,
    });

    const uid = item.userId.toString();
    userCoinsMap.set(uid, (userCoinsMap.get(uid) ?? 0) + item.conversionValue);
  }

  for (const [userId, totalCoins] of userCoinsMap) {
    await Notification.create({
      userId,
      title: "Reservierung abgelaufen",
      message: `Deine reservierten Karten wurden automatisch in ${totalCoins} Coins umgewandelt.`,
      type: "info",
      cta: { label: "Zum Guthaben", url: "/balance" },
      category: "reservation",
      entityType: "cart_expiry",
    });

    await runRedisCommand("notify-expiry", null, async (redis) => {
      const count = await Notification.countDocuments({ userId, read: false });
      await redis.set(`notifications:unread:${userId}`, count, "EX", 60);
      await redis.publish(`notifications:${userId}`, JSON.stringify({ unreadCount: count }));
      return null;
    });
  }

  console.log(`[reservation-worker] Processed ${expiredItems.length} expired reservations`);
}

async function processExpiryWarnings() {
  await connectDB();

  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  const warningItems = await CartItem.find({
    status: "reserved",
    expiresAt: { $lt: oneHourFromNow, $gt: now },
    warningNotified: false,
  }).lean();

  if (warningItems.length === 0) return;

  const userItems = new Map<string, number>();
  const itemIds: mongoose.Types.ObjectId[] = [];

  for (const item of warningItems) {
    const uid = item.userId.toString();
    userItems.set(uid, (userItems.get(uid) ?? 0) + 1);
    itemIds.push(item._id as mongoose.Types.ObjectId);
  }

  await CartItem.updateMany(
    { _id: { $in: itemIds } },
    { warningNotified: true }
  );

  for (const [userId, cardCount] of userItems) {
    await Notification.create({
      userId,
      title: "Reservierung läuft bald ab",
      message: `${cardCount} Karte${cardCount > 1 ? "n" : ""} im Warenkorb ${cardCount > 1 ? "laufen" : "läuft"} in weniger als 1 Stunde ab. Schließe jetzt den Versand ab.`,
      type: "warning",
      cta: { label: "Zum Warenkorb", url: "/cart" },
      category: "reservation",
      entityType: "cart_warning",
    });

    await runRedisCommand("notify-warning", null, async (redis) => {
      const count = await Notification.countDocuments({ userId, read: false });
      await redis.set(`notifications:unread:${userId}`, count, "EX", 60);
      await redis.publish(`notifications:${userId}`, JSON.stringify({ unreadCount: count }));
      return null;
    });
  }

  console.log(`[reservation-worker] Sent ${warningItems.length} expiry warnings`);
}

export function startReservationWorker() {
  const worker = createWorker(RESERVATION_QUEUE, async (job) => {
    if (job.name === "check-expired") {
      await processExpiredReservations();
    } else if (job.name === "send-warnings") {
      await processExpiryWarnings();
    }
  });

  worker.on("failed", (job, err) => {
    console.error(`[reservation-worker] Job ${job?.name} failed:`, err);
  });

  const queue = getQueue(RESERVATION_QUEUE);
  void queue.add("check-expired", {}, { repeat: { every: 60_000 }, removeOnComplete: 100, removeOnFail: 50 });
  void queue.add("send-warnings", {}, { repeat: { every: 60_000 }, removeOnComplete: 100, removeOnFail: 50 });

  console.log("[reservation-worker] Started with 60s interval");

  return worker;
}
