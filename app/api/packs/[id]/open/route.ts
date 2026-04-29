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
import GodpackEvent from "@/models/godpack-event";
import { drawPacksWithFairness, type PackCard, type DrawnCard } from "@/lib/pack-engine";
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
import {
  buildGodpackPool,
  drawGodpack,
  poolSnapshotEntries,
  GODPACK_CARD_COUNT,
  type GodpackPool,
  type GodpackDrawnCard,
} from "@/lib/godpack-engine";
import {
  incrementGodpackCounter,
  retractGodpackTrigger,
} from "@/lib/godpack-counter";
import { publishRoomEvent } from "@/lib/chat";
import { CHAT_ROOM_SLUG } from "@/lib/chat-constants";
import type { GodpackIncomingEvent } from "@/types/chat";

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

    // 4b. Godpack-Counter inkrementieren — atomar via Aggregation-Pipeline,
    // die zugleich `nextTriggerAt` advanced, wenn der Counter den Trigger
    // überquert. Damit gewinnt genau ein paralleler Caller den Claim, ein
    // Race zwischen Inc und Advance ist ausgeschlossen.
    const triggerInfo = await incrementGodpackCounter(packCount, userId);
    let godpackOutcome: {
      packIndex: number;
      pool: GodpackPool;
      triggerCount: number;
    } | null = null;
    if (triggerInfo.triggered) {
      const candidatePool = await buildGodpackPool(box.game);
      if (!candidatePool.insufficient) {
        godpackOutcome = {
          packIndex: triggerInfo.godpackPackIndex!,
          pool: candidatePool,
          triggerCount: triggerInfo.triggeredAt!,
        };
      } else {
        // Pool zu klein — Drop nicht verlieren, sondern auf den unmittelbar
        // nächsten Pack-Pull verschieben (egal welches Franchise).
        try {
          await retractGodpackTrigger();
        } catch (err) {
          console.error("[packs/[id]/open godpack-retract]", err);
        }
      }
    }

    // 5. Fairness wiring — auto-init client seed, reserve nonce range,
    // snapshot the pool, commit BEFORE any mutating draw step so every
    // downstream record has an immutable hash chain back to the seed.
    const regularPackCount = godpackOutcome ? packCount - 1 : packCount;
    const regularDrawCount = regularPackCount * box.cardsPerPack;
    const godpackDrawCount = godpackOutcome ? GODPACK_CARD_COUNT : 0;
    const totalDraws = regularDrawCount + godpackDrawCount;

    const clientSeed = await ensureClientSeed(userId);
    const { seed: reservedSeed, nonceStart } = await reserveNonces(userId, totalDraws);

    const regularNonceStart = nonceStart;
    const regularNonceEnd = regularNonceStart + regularDrawCount;
    const godpackNonceStart = regularNonceEnd;
    const godpackNonceEnd = godpackNonceStart + godpackDrawCount;

    const poolEntries: PoolEntry[] = packCards.map((c) => ({
      cardId: c.cardId,
      weight: scaleWeight(c.weight),
      stock: c.stock,
    }));
    const poolHash = await computePoolHash(poolEntries);

    let regularCommitment: { _id: Types.ObjectId } | null = null;
    if (regularPackCount > 0) {
      regularCommitment = await PackOpenCommitment.create({
        userId,
        packGroupId,
        boxId: realBoxId,
        kind: "regular",
        serverSeedId: reservedSeed._id,
        serverSeedHashAtOpen: reservedSeed.serverSeedHash,
        clientSeed,
        nonceStart: regularNonceStart,
        nonceEnd: regularNonceEnd,
        poolSnapshot: poolEntries.map((e) => ({
          cardId: new Types.ObjectId(e.cardId),
          weight: e.weight,
          stockAtOpen: e.stock,
        })),
        poolHash,
      });
    }

    // 5b. Godpack-Commitment (separater Pool-Hash über alle Franchise-Karten ≥ 20)
    let godpackCommitment: { _id: Types.ObjectId } | null = null;
    let godpackPoolHash: string | null = null;
    if (godpackOutcome) {
      const gpEntries = poolSnapshotEntries(godpackOutcome.pool);
      godpackPoolHash = await computePoolHash(gpEntries);
      godpackCommitment = await PackOpenCommitment.create({
        userId,
        packGroupId: `${packGroupId}-godpack`,
        boxId: realBoxId,
        kind: "godpack",
        serverSeedId: reservedSeed._id,
        serverSeedHashAtOpen: reservedSeed.serverSeedHash,
        clientSeed,
        nonceStart: godpackNonceStart,
        nonceEnd: godpackNonceEnd,
        poolSnapshot: gpEntries.map((e) => ({
          cardId: new Types.ObjectId(e.cardId),
          weight: e.weight,
          stockAtOpen: e.stock,
        })),
        poolHash: godpackPoolHash,
      });
    }

    // 6. Draw regular packs (skip wenn alle Slots vom Godpack belegt sind, also packCount=1+godpack)
    let regularDrawn: DrawnCard[] = [];
    if (regularPackCount > 0) {
      const regularRng = createFairnessRng({
        serverSeed: reservedSeed.serverSeed,
        clientSeed,
        nonceStart: regularNonceStart,
        poolHash,
      });
      const regularResult = await drawPacksWithFairness(
        packCards,
        box.cardsPerPack,
        regularPackCount,
        box.priceInCoins,
        regularRng,
      );
      regularDrawn = regularResult.drawnCards;

      if (regularDrawn.length === 0) {
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
    }

    // 6b. Pack-Index-Remap: reguläre Packs füllen die User-View-Slots, ohne
    // den Godpack-Slot zu beanspruchen. Der Engine-interne packIndex 0..N-1
    // wird zu den User-Slots [0..godpackPackIndex-1] ∪ [godpackPackIndex+1..packCount-1].
    if (godpackOutcome) {
      const gpIdx = godpackOutcome.packIndex;
      for (const card of regularDrawn) {
        if (card.packIndex >= gpIdx) {
          card.packIndex += 1;
        }
      }
    }

    // 6c. Godpack-Draw — gleiches Server-/Client-Seed, eigene Nonce-Range, eigener Pool-Hash
    let godpackDrawn: GodpackDrawnCard[] = [];
    if (godpackOutcome && godpackPoolHash) {
      const godpackRng = createFairnessRng({
        serverSeed: reservedSeed.serverSeed,
        clientSeed,
        nonceStart: godpackNonceStart,
        poolHash: godpackPoolHash,
      });
      godpackDrawn = await drawGodpack({ pool: godpackOutcome.pool, rng: godpackRng });
    }

    // 7. Get IP and User Agent
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";
    const ua = req.headers.get("user-agent") ?? "unknown";

    // 7b. GodpackEvent persistieren (BEVOR PackPulls, damit die Pulls die ID referenzieren können)
    let godpackEventId: Types.ObjectId | null = null;
    let godpackEventTotalCoinValue = 0;
    if (godpackOutcome && godpackCommitment && godpackDrawn.length > 0) {
      godpackEventTotalCoinValue = godpackDrawn.reduce((sum, c) => sum + c.coinValue, 0);
      const username =
        (user as unknown as { username?: string | null; name?: string | null }).username
        ?? (user as unknown as { name?: string | null }).name
        ?? "Nutzer";
      const created = await GodpackEvent.create({
        userId,
        username,
        game: box.game,
        triggerCount: godpackOutcome.triggerCount,
        packGroupId,
        cards: godpackDrawn.map((c) => ({
          cardId: new Types.ObjectId(c.cardId),
          sourceBoxId: new Types.ObjectId(c.sourceBoxId),
          name: c.name,
          image: c.image,
          rarity: c.rarity,
          coinValue: c.coinValue,
          conversionValue: c.conversionValue,
        })),
        totalCoinValue: godpackEventTotalCoinValue,
        fairnessCommitmentId: godpackCommitment._id,
        poolSize: godpackOutcome.pool.entries.length,
        poolFallbackUsed: godpackOutcome.pool.fallbackUsed,
      });
      godpackEventId = created._id;
      // Trigger wurde bereits in incrementGodpackCounter atomar advanced.
    }

    // 8. Create PackPull records with status "pending" — crash-safe. Reuse
    // the packGroupId + expiry we already pinned on the session so pulls and
    // session rot together.
    const pullExpiresAt = sessionExpiresAt;
    let cardIndexCounter = 0;
    const pullDocs: Array<Record<string, unknown>> = [];

    for (const d of regularDrawn) {
      pullDocs.push({
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
        cardIndex: cardIndexCounter,
        ipAddress: ip,
        userAgent: ua,
        expiresAt: pullExpiresAt,
        fairnessCommitmentId: regularCommitment?._id ?? null,
        fairnessNonce: regularNonceStart + d.cardIndex,
        isGodpack: false,
        godpackEventId: null,
        godpackPosition: null,
      });
      cardIndexCounter++;
    }

    for (const d of godpackDrawn) {
      pullDocs.push({
        userId,
        boxId: new Types.ObjectId(d.sourceBoxId),
        cardId: d.cardId,
        rarity: d.rarity,
        coinValue: d.coinValue,
        conversionValue: d.conversionValue,
        status: "pending" as const,
        decidedAt: null,
        packGroupId,
        packIndex: godpackOutcome!.packIndex,
        cardIndex: cardIndexCounter,
        ipAddress: ip,
        userAgent: ua,
        expiresAt: pullExpiresAt,
        fairnessCommitmentId: godpackCommitment?._id ?? null,
        fairnessNonce: godpackNonceStart + (d.position - 1),
        isGodpack: true,
        godpackEventId,
        godpackPosition: d.position,
      });
      cardIndexCounter++;
    }

    await PackPull.insertMany(pullDocs);
    // Pulls are durable — from here on a server error is recoverable by the
    // user-facing decide flow, not by a coin refund, so stop tracking the
    // deduction for catch-path cleanup.
    deductedCoins = 0;

    // 9. Atomically reduce stock per drawn card (race-condition safe).
    // Reguläre Karten zählen gegen die angeklickte Box, Godpack-Karten gegen
    // ihre Source-Box (kann eine andere Box im selben Franchise sein).
    const stockUpdatesPerBox: Map<string, Map<string, number>> = new Map();
    function bumpStock(boxIdStr: string, cardId: string) {
      let perBox = stockUpdatesPerBox.get(boxIdStr);
      if (!perBox) {
        perBox = new Map();
        stockUpdatesPerBox.set(boxIdStr, perBox);
      }
      perBox.set(cardId, (perBox.get(cardId) ?? 0) + 1);
    }
    for (const d of regularDrawn) {
      bumpStock(realBoxId.toString(), d.cardId);
    }
    for (const d of godpackDrawn) {
      bumpStock(d.sourceBoxId, d.cardId);
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
    for (const [boxIdStr, perBox] of stockUpdatesPerBox.entries()) {
      const boxObjectId = new Types.ObjectId(boxIdStr);
      for (const [cardId, count] of perBox.entries()) {
        const cardObjectId = new Types.ObjectId(cardId);
        for (let i = 0; i < count; i++) {
          stockOps.push({
            updateOne: {
              filter: { _id: boxObjectId, "cards.card": cardObjectId, "cards.stock": { $gte: 1 } },
              update: { $inc: { "cards.$.stock": -1 } },
            },
          });
        }
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
      const regularPullXp = regularDrawn.reduce(
        (sum, card) => sum + xpForPackPull(card.rarity, card.coinValue),
        0,
      );
      const godpackPullXp = godpackDrawn.reduce(
        (sum, card) => sum + xpForPackPull(card.rarity, card.coinValue),
        0,
      );
      const totalPullXp = regularPullXp + godpackPullXp;
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

    // 10. Low-stock warnings für die angeklickte Box. Godpack-Karten aus
    // anderen Boxen werden gesondert gelogged (Out-of-Stock unten), aber
    // pro-Box-Pause respektiert nur die Origin-Box, weil sie der Klick-Pfad
    // ist und wir Admin-Alerts kompakt halten wollen.
    const originBoxStockUpdates: Record<string, number> = {};
    const originPerBox = stockUpdatesPerBox.get(realBoxId.toString());
    if (originPerBox) {
      for (const [cardId, count] of originPerBox.entries()) {
        originBoxStockUpdates[cardId] = count;
      }
    }
    if (updatedBox) void sendLowStockAlerts(updatedBox, cardMap, originBoxStockUpdates);

    // 11. Pause boxes whose stock was depleted to 0 — checked across BOTH
    // the origin box (regular pulls) and any sibling boxes affected by
    // godpack pulls. Each box gets its own status="published" guard so a
    // concurrent opener that already paused it won't double-fire alerts.
    const affectedBoxIds = [...stockUpdatesPerBox.keys()];
    if (affectedBoxIds.length > 0) {
      const allAffectedBoxes = await Box.find({
        _id: { $in: affectedBoxIds.map((id) => new Types.ObjectId(id)) },
      });
      for (const affected of allAffectedBoxes) {
        const perBox = stockUpdatesPerBox.get(affected._id.toString());
        if (!perBox) continue;
        const depleted: Array<{ cardId: string; cardName: string }> = [];
        for (const cardId of perBox.keys()) {
          const entry = affected.cards.find((c) => c.card.toString() === cardId);
          if (entry && (entry.stock ?? 0) === 0) {
            depleted.push({
              cardId,
              cardName: cardMap.get(cardId)?.name ?? entry.card.toString(),
            });
          }
        }
        if (depleted.length === 0) continue;

        const pausedAt = new Date();
        const first = depleted[0];
        const pauseResult = await Box.updateOne(
          { _id: affected._id, status: "published" },
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
          void sendOutOfStockAlerts(affected, depleted);
        }
      }
    }

    // 12. Response — kombiniere reguläre und Godpack-Karten in User-View-Order.
    // Reguläre Karten haben packIndex bereits via Remap auf die richtigen Slots,
    // Godpack-Karten teilen sich packIndex `godpackOutcome.packIndex`.
    interface ResponseCard {
      cardId: string;
      name: string;
      rarity: string;
      coinValue: number;
      conversionValue: number;
      image: string | null;
      packIndex: number;
      cardIndex: number;
      isGodpack: boolean;
      godpackPosition: number | null;
    }
    const responseCards: ResponseCard[] = [];
    for (const c of regularDrawn) {
      responseCards.push({
        cardId: c.cardId,
        name: c.name,
        rarity: c.rarity,
        coinValue: c.coinValue,
        conversionValue: c.conversionValue,
        image: c.image,
        packIndex: c.packIndex,
        cardIndex: c.cardIndex,
        isGodpack: false,
        godpackPosition: null,
      });
    }
    for (const c of godpackDrawn) {
      responseCards.push({
        cardId: c.cardId,
        name: c.name,
        rarity: c.rarity,
        coinValue: c.coinValue,
        conversionValue: c.conversionValue,
        image: c.image,
        packIndex: godpackOutcome!.packIndex,
        cardIndex: regularDrawn.length + (c.position - 1),
        isGodpack: true,
        godpackPosition: c.position,
      });
    }
    responseCards.sort((a, b) => a.packIndex - b.packIndex || a.cardIndex - b.cardIndex);

    // 13. Live-Banner publishen, wenn Godpack getriggert wurde. Wird von allen
    // verbundenen Chat-Clients empfangen — der Toast unterdrückt sich beim
    // glücklichen User selbst (siehe ownerUserId).
    if (godpackOutcome && godpackEventId) {
      const username =
        (user as unknown as { username?: string | null; name?: string | null }).username
        ?? (user as unknown as { name?: string | null }).name
        ?? "Nutzer";
      try {
        await publishRoomEvent<GodpackIncomingEvent>(CHAT_ROOM_SLUG, {
          type: "godpack_incoming",
          payload: {
            eventId: godpackEventId.toString(),
            username,
            game: box.game,
            ownerUserId: userId,
          },
        });
      } catch (err) {
        // Banner-Publish darf nie den Pack-Open scheitern lassen
        console.error("[packs/[id]/open godpack-broadcast]", err);
      }
    }

    return NextResponse.json({
      packGroupId,
      packCount,
      totalCost,
      newBalance: finalBalance,
      cards: responseCards,
      godpack: godpackOutcome && godpackEventId
        ? {
            eventId: godpackEventId.toString(),
            packIndex: godpackOutcome.packIndex,
            game: box.game,
            totalCoinValue: godpackEventTotalCoinValue,
            poolFallbackUsed: godpackOutcome.pool.fallbackUsed,
            fairnessProof: godpackCommitment
              ? {
                  commitmentId: godpackCommitment._id.toString(),
                  nonceStart: godpackNonceStart,
                  nonceEnd: godpackNonceEnd,
                }
              : null,
          }
        : null,
      fairnessProof: regularCommitment
        ? {
            commitmentId: regularCommitment._id.toString(),
            nonceStart: regularNonceStart,
            nonceEnd: regularNonceEnd,
          }
        : null,
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
