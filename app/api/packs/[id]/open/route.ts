import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Box from "@/models/box";
import Card from "@/models/card";
import User from "@/models/user";
import PackPull from "@/models/pack-pull";
import PackOpenSession from "@/models/pack-open-session";
import CoinTransaction from "@/models/coin-transaction";
import Notification from "@/models/notification";
import PackOpenCommitment from "@/models/pack-open-commitment";
import { drawPacksWithFairness, type PackCard } from "@/lib/pack-engine";
import { grantXp, incrementCounter, fireOnceEvent } from "@/lib/level/grant-xp";
import { xpForPackPull } from "@/lib/level/xp-rates";
import { getUserEffects } from "@/lib/achievements/effects";
import {
  computePoolHash,
  createFairnessRng,
  scaleWeight,
  type PoolEntry,
} from "@/lib/fairness";
import { ensureClientSeed, reserveNonces } from "@/lib/fairness-server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boxId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { packCount } = body as { packCount?: number };

  if (!packCount || !Number.isInteger(packCount) || packCount < 1 || packCount > 10) {
    return NextResponse.json({ error: "packCount must be 1-10" }, { status: 400 });
  }

  // Hoisted so the outer catch can clean up the session mutex if anything
  // between `PackOpenSession.create` and the success response throws.
  let heldSessionKey: string | null = null;
  // Track how many coins we deducted so the outer catch can refund them if
  // the draw or persistence step fails after the atomic $inc. Without this
  // a transient Mongo error between coin-deduct and PackPull.insertMany
  // would silently burn the user's coins.
  let deductedCoins = 0;

  try {
    await connectDB();

    // 1. Load box (support slug or ObjectId)
    const isObjectId = /^[a-f\d]{24}$/i.test(boxId);
    const box = isObjectId
      ? await Box.findById(boxId)
      : await Box.findOne({ slug: boxId });
    if (!box || box.status !== "published") {
      return NextResponse.json({ error: "Box not found or not published" }, { status: 404 });
    }
    // Tutorial boxes are tour-only display props. Opening them would consume
    // real coins and mint real cards — explicitly blocked at the API layer.
    if (box.isTutorial) {
      return NextResponse.json(
        { error: "tutorial_box_not_openable" },
        { status: 403 },
      );
    }

    // Level-Gate: wenn die Box ein requiredLevel hat, muss der User es
    // erreicht haben — oder ein Achievement muss die Box explizit unlocken.
    if (box.requiredLevel != null && box.requiredLevel > 1) {
      const levelDoc = await User.findById(userId)
        .select("level")
        .lean<{ level?: number } | null>();
      const userLevel = levelDoc?.level ?? 1;
      if (userLevel < box.requiredLevel) {
        const effects = await getUserEffects(userId);
        if (!effects.unlockedBoxSlugs.includes(box.slug ?? "")) {
          return NextResponse.json(
            {
              error: "level_locked",
              requiredLevel: box.requiredLevel,
              currentLevel: userLevel,
            },
            { status: 403 },
          );
        }
      }
    }

    const realBoxId = box._id;
    const totalCost = box.priceInCoins * packCount;

    // 2. Open-session mutex — unique index on userId enforces at most one
    // active session. Double-click / racing tabs hit E11000 and get a clean
    // 409 before any coins are touched. A TTL on expiresAt reaps abandoned
    // sessions automatically.
    const packGroupId = randomUUID();
    const sessionExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    try {
      await PackOpenSession.create({
        userId,
        boxId: realBoxId,
        packGroupId,
        expiresAt: sessionExpiresAt,
      });
      heldSessionKey = packGroupId;
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        return NextResponse.json(
          { error: "pending_session", message: "Du hast noch offene Karten aus einem vorherigen Opening." },
          { status: 409 }
        );
      }
      throw err;
    }

    // 3. Check user coins (atomic: only deduct if sufficient)
    const user = await User.findOneAndUpdate(
      { _id: userId, coins: { $gte: totalCost } },
      { $inc: { coins: -totalCost } },
      { returnDocument: "after" }
    );

    if (!user) {
      await PackOpenSession.deleteOne({ userId, packGroupId });
      return NextResponse.json({ error: "Insufficient coins" }, { status: 400 });
    }
    deductedCoins = totalCost;

    // 4. Build card pool from box
    const cardEntries = box.cards as Array<{
      card: { toString(): string };
      weight: number;
      rarity: string;
      stock: number;
      minStock: number;
    }>;

    const cardIds = cardEntries.map((e) => e.card.toString());
    const cardDocs = await Card.find({ _id: { $in: cardIds } }).lean();
    const cardMap = new Map(cardDocs.map((c) => [c._id.toString(), c]));

    const packCards: PackCard[] = cardEntries
      .filter((e) => (e.stock ?? 0) > 0)
      .map((e) => {
        const doc = cardMap.get(e.card.toString());
        return {
          cardId: e.card.toString(),
          name: doc?.name ?? "Unknown",
          rarity: e.rarity,
          weight: e.weight,
          stock: e.stock,
          coinValue: Math.max(1, Math.floor(doc?.internalPrice ?? 1)),
          image: doc?.image ?? null,
        };
      });

    if (packCards.length === 0) {
      // Refund coins + release session — no cards available
      await User.findByIdAndUpdate(userId, { $inc: { coins: totalCost } });
      deductedCoins = 0;
      await PackOpenSession.deleteOne({ userId, packGroupId });
      return NextResponse.json({ error: "No available cards in this box" }, { status: 400 });
    }

    // 5. Fairness wiring — auto-init client seed, reserve nonce range,
    // snapshot the pool, commit BEFORE any mutating draw step so every
    // downstream record has an immutable hash chain back to the seed.
    const totalDraws = packCount * box.cardsPerPack;
    const clientSeed = await ensureClientSeed(userId);
    const { seed: reservedSeed, nonceStart } = await reserveNonces(userId, totalDraws);
    const nonceEnd = nonceStart + totalDraws;

    const poolEntries: PoolEntry[] = packCards.map((c) => ({
      cardId: c.cardId,
      weight: scaleWeight(c.weight),
      stock: c.stock,
    }));
    const poolHash = await computePoolHash(poolEntries);

    const commitment = await PackOpenCommitment.create({
      userId,
      packGroupId,
      boxId: realBoxId,
      serverSeedId: reservedSeed._id,
      serverSeedHashAtOpen: reservedSeed.serverSeedHash,
      clientSeed,
      nonceStart,
      nonceEnd,
      poolSnapshot: poolEntries.map((e) => ({
        cardId: new Types.ObjectId(e.cardId),
        weight: e.weight,
        stockAtOpen: e.stock,
      })),
      poolHash,
    });

    // 6. Draw cards
    const rng = createFairnessRng({
      serverSeed: reservedSeed.serverSeed,
      clientSeed,
      nonceStart,
      poolHash,
    });
    const result = await drawPacksWithFairness(
      packCards,
      box.cardsPerPack,
      packCount,
      box.priceInCoins,
      rng,
    );

    if (result.drawnCards.length === 0) {
      // Refund coins + release session. The commitment remains as a
      // deliberate audit trail: the nonce range is "burned" (FairnessSeed
      // already advanced) so user-side verification sees a commitment with
      // zero pulls — rare, but honest. /api/fairness/commitment treats
      // zero-pull commitments as a valid abandoned-draw state.
      await User.findByIdAndUpdate(userId, { $inc: { coins: totalCost } });
      deductedCoins = 0;
      await PackOpenSession.deleteOne({ userId, packGroupId });
      return NextResponse.json({ error: "Could not draw cards" }, { status: 400 });
    }

    // 7. Get IP and User Agent
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";
    const ua = req.headers.get("user-agent") ?? "unknown";

    // 6. Create PackPull records with status "pending" — crash-safe. Reuse
    // the packGroupId + expiry we already pinned on the session so pulls and
    // session rot together.
    const pullExpiresAt = sessionExpiresAt;
    const pullDocs = result.drawnCards.map((d, i) => ({
      userId,
      boxId: realBoxId,
      cardId: d.cardId,
      rarity: d.rarity,
      coinValue: d.coinValue,
      conversionValue: d.conversionValue,
      status: "pending" as const,
      decidedAt: null,
      packGroupId,
      packIndex: d.packIndex,
      cardIndex: i,
      ipAddress: ip,
      userAgent: ua,
      expiresAt: pullExpiresAt,
      fairnessCommitmentId: commitment._id,
      fairnessNonce: nonceStart + i,
    }));
    await PackPull.insertMany(pullDocs);
    // Pulls are durable — from here on a server error is recoverable by the
    // user-facing decide flow, not by a coin refund, so stop tracking the
    // deduction for catch-path cleanup.
    deductedCoins = 0;

    // 8. Atomically reduce stock per drawn card (race-condition safe)
    const stockUpdates: Record<string, number> = {};
    for (const d of result.drawnCards) {
      stockUpdates[d.cardId] = (stockUpdates[d.cardId] ?? 0) + 1;
    }

    // One atomic decrement per drawn unit, still guarded by $gte:1 so a
    // concurrent depletion skips the surplus op. bulkWrite with ordered:true
    // executes the guards against the state left by previous ops in the batch,
    // so three decrements against stock=2 still cleanly produce stock=0.
    const stockOps: Array<{
      updateOne: {
        filter: Record<string, unknown>;
        update: Record<string, unknown>;
      };
    }> = [];
    for (const [cardId, count] of Object.entries(stockUpdates)) {
      const cardObjectId = new Types.ObjectId(cardId);
      for (let i = 0; i < count; i++) {
        stockOps.push({
          updateOne: {
            filter: { _id: realBoxId, "cards.card": cardObjectId, "cards.stock": { $gte: 1 } },
            update: { $inc: { "cards.$.stock": -1 } },
          },
        });
      }
    }
    stockOps.push({
      updateOne: {
        filter: { _id: realBoxId },
        update: { $inc: { packsOpened: packCount } },
      },
    });
    await Box.bulkWrite(stockOps, { ordered: true });

    // Reload box for stock alerts (need current state)
    const updatedBox = await Box.findById(realBoxId);

    // 9. Record coin transaction
    await CoinTransaction.create({
      userId,
      amount: -totalCost,
      type: "pack_purchase",
      relatedBoxId: realBoxId,
    });

    // 9b. Level-System: XP für jede gezogene Karte + Counter-Inkremente +
    // optional Once-Event "first_pack_opened". Alle Seiteneffekte in einem
    // try/catch, damit ein Level-Fehler niemals die Pack-Öffnung scheitern
    // lässt (Coins sind dann ja schon verbucht und die Karten erzeugt).
    let finalBalance = user.coins;
    try {
      const totalPullXp = result.drawnCards.reduce(
        (sum, card) => sum + xpForPackPull(card.rarity, card.coinValue),
        0,
      );
      if (totalPullXp > 0) {
        await grantXp(userId, totalPullXp, "pack_open");
      }
      await incrementCounter(userId, "boxesOpened", packCount);
      await incrementCounter(userId, "coinsSpent", totalCost);
      await fireOnceEvent(userId, "first_pack_opened");
      // Achievement-Rewards können Coins gutgeschrieben haben — einmal kurz
      // nachlesen, damit das Response-Feld `newBalance` nicht verwaist.
      const refreshed = await User.findById(userId).select("coins").lean<{ coins?: number }>();
      if (refreshed?.coins != null) finalBalance = refreshed.coins;
    } catch (err) {
      console.error("[packs/[id]/open xp-hooks]", err);
    }

    // 10. Low-stock warnings for drawn cards. Out-of-stock notifications
    // live with the pause block below so the single request that actually
    // wins the pause race is the only one that notifies admins.
    if (updatedBox) void sendLowStockAlerts(updatedBox, cardMap, stockUpdates);

    // 11. Pause box if any drawn card hit stock 0. Admin reviews before it
    // goes live again. The `status: "published"` guard on the filter means
    // only one concurrent opener flips the status; others see modifiedCount=0
    // and skip notifications so admins don't get duplicate alerts.
    if (updatedBox) {
      const depleted: Array<{ cardId: string; cardName: string }> = [];
      for (const cardId of Object.keys(stockUpdates)) {
        const entry = updatedBox.cards.find((c) => c.card.toString() === cardId);
        if (entry && (entry.stock ?? 0) === 0) {
          depleted.push({
            cardId,
            cardName: cardMap.get(cardId)?.name ?? "Unknown",
          });
        }
      }

      if (depleted.length > 0) {
        const pausedAt = new Date();
        const first = depleted[0];
        const pauseResult = await Box.updateOne(
          { _id: realBoxId, status: "published" },
          {
            $set: {
              status: "paused",
              pausedAt,
              pausedReason: {
                cardId: new Types.ObjectId(first.cardId),
                cardName: first.cardName,
                at: pausedAt,
              },
            },
          },
        );

        if (pauseResult.modifiedCount === 1) {
          void sendOutOfStockAlerts(updatedBox, depleted);
        }
      }
    }

    // 12. Response
    return NextResponse.json({
      packGroupId,
      packCount,
      totalCost,
      newBalance: finalBalance,
      cards: result.drawnCards,
      fairnessProof: {
        commitmentId: commitment._id.toString(),
        nonceStart,
        nonceEnd,
      },
    });
  } catch (err) {
    console.error("[packs/[id]/open POST]", err);
    // Release the open-session mutex so the user isn't blocked for the full
    // 5-minute TTL after a server error between session-create and response.
    if (heldSessionKey) {
      await PackOpenSession.deleteOne({ userId, packGroupId: heldSessionKey }).catch(() => {});
    }
    // Refund any coins we had deducted but hadn't yet compensated with real
    // PackPulls — a transient Mongo error between coin-deduct and pull-write
    // would otherwise silently consume the user's balance.
    if (deductedCoins > 0) {
      await User.updateOne({ _id: userId }, { $inc: { coins: deductedCoins } }).catch(() => {});
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/**
 * Low-stock warnings for drawn cards that just crossed the minStock threshold.
 * stockUpdates: { cardId: drawCount } — only cards affected by this opening.
 *
 * Out-of-stock notifications are handled by sendOutOfStockAlerts, gated on
 * the single request that wins the pause race, to avoid duplicate alerts.
 */
async function sendLowStockAlerts(
  box: InstanceType<typeof Box>,
  cardMap: Map<string, { name?: string }>,
  stockUpdates: Record<string, number>
) {
  try {
    const admins = await User.find({ role: { $in: ["admin", "super_admin"] } }).select("_id").lean();
    if (admins.length === 0) return;
    const adminIds = admins.map((a) => a._id.toString());
    const boxName = box.name?.de ?? box.name?.en ?? "Box";

    for (const [cardId, drawnCount] of Object.entries(stockUpdates)) {
      const entry = box.cards.find((c) => c.card.toString() === cardId);
      if (!entry) continue;

      const stockNow = entry.stock ?? 0;
      if (stockNow === 0) continue; // out-of-stock handled elsewhere
      const stockBefore = stockNow + drawnCount;
      const minStock = entry.minStock ?? 5;
      const cardName = cardMap.get(cardId)?.name ?? "Unknown";

      if (stockNow <= minStock && stockBefore > minStock) {
        for (const adminId of adminIds) {
          await Notification.create({
            userId: adminId,
            title: `Niedriger Bestand: ${cardName}`,
            message: `${cardName} in "${boxName}" hat nur noch ${stockNow} Stück (Mindestbestand: ${minStock}).`,
            type: "warning",
            cta: { label: "Box öffnen", url: `/de/admin/boxes/${box._id}` },
          });
        }
      }
    }
  } catch (err) {
    console.error("[lowStockAlerts]", err);
  }
}

/**
 * Out-of-stock notifications for every card that was depleted by the request
 * which just won the pause race. Guarded by the caller on modifiedCount=1 so
 * concurrent openers that saw the same state don't double-notify.
 */
async function sendOutOfStockAlerts(
  box: InstanceType<typeof Box>,
  depleted: Array<{ cardId: string; cardName: string }>,
) {
  try {
    const admins = await User.find({ role: { $in: ["admin", "super_admin"] } }).select("_id").lean();
    if (admins.length === 0) return;
    const adminIds = admins.map((a) => a._id.toString());
    const boxName = box.name?.de ?? box.name?.en ?? "Box";

    for (const { cardName } of depleted) {
      for (const adminId of adminIds) {
        await Notification.create({
          userId: adminId,
          title: `Ausverkauft: ${cardName}`,
          message: `${cardName} in "${boxName}" hat Bestand 0. Box wurde pausiert — bitte prüfen und Bestand auffüllen oder Karte ersetzen, dann reaktivieren.`,
          type: "error",
          cta: { label: "Box öffnen", url: `/de/admin/boxes/${box._id}` },
        });
      }
    }
  } catch (err) {
    console.error("[outOfStockAlerts]", err);
  }
}
