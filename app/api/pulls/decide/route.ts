import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import {
  appendChatArchiveEvent,
  ensureGlobalChatRoom,
  publishRoomEvent,
  serializeChatMessageWithCurrentRelations,
} from "@/lib/chat";
import { getChatRoleBadgeLabel } from "@/lib/chat-constants";
import connectDB from "@/lib/db";
import { getRedis } from "@/lib/redis";
import PackPull from "@/models/pack-pull";
import PackOpenSession from "@/models/pack-open-session";
import CartItem from "@/models/cart-item";
import User from "@/models/user";
import Box from "@/models/box";
import Card from "@/models/card";
import ChatMessage from "@/models/chat-message";
import ChatRoom from "@/models/chat-room";
import CoinTransaction from "@/models/coin-transaction";
import { grantXp, incrementCounter } from "@/lib/level/grant-xp";
import { XP_RATES } from "@/lib/level/xp-rates";
import { getUserEffects } from "@/lib/achievements/effects";

const RESERVATION_HOURS = 3;
const CHAT_JACKPOT_MIN_VALUE = 90;

/**
 * Runs after each decision. If every pull in the group is now decided we
 * (a) release the open-session mutex so the user can open a new pack and
 * (b) broadcast any jackpot pulls to the chat room.
 */
async function finalizePackGroupIfComplete(input: {
  packGroupId: string;
  userId: string;
}) {
  const hasPending = await PackPull.exists({
    packGroupId: input.packGroupId,
    userId: input.userId,
    status: "pending",
  });
  if (hasPending) return;

  await PackOpenSession.deleteOne({
    userId: input.userId,
    packGroupId: input.packGroupId,
  });

  await publishJackpotPulls(input);
}

async function publishJackpotPulls(input: {
  packGroupId: string;
  userId: string;
}) {

  const jackpotPulls = await PackPull.find({
    packGroupId: input.packGroupId,
    userId: input.userId,
    coinValue: { $gte: CHAT_JACKPOT_MIN_VALUE },
  })
    .sort({ cardIndex: 1 })
    .lean();

  if (jackpotPulls.length === 0) return;

  const lock = await PackPull.updateMany(
    {
      packGroupId: input.packGroupId,
      userId: input.userId,
      jackpotAnnouncedAt: null,
    },
    {
      $set: {
        jackpotAnnouncedAt: new Date(),
      },
    }
  );
  if (!lock.modifiedCount) return;

  if (!Types.ObjectId.isValid(input.userId)) return;

  const [room, userDoc] = await Promise.all([
    ensureGlobalChatRoom(),
    User.findById(input.userId).select("username role image identityVerified").lean(),
  ]);

  if (!userDoc) return;

  const authorUserId = new Types.ObjectId(input.userId);
  const displayName = userDoc.username?.trim() || "Ein Spieler";
  const authorSnapshot = {
    name: userDoc.username?.trim() || "Nutzer",
    username: userDoc.username ?? null,
    role: userDoc.role ?? "user",
    roleBadge: getChatRoleBadgeLabel(userDoc.role ?? "user"),
    profileBadges: [],
    avatarUrl: userDoc.image ?? null,
    identityVerified: Boolean(userDoc.identityVerified),
  };

  const cardIds = [...new Set(jackpotPulls.map((pull) => pull.cardId.toString()))];
  const cardDocs = await Card.find({ _id: { $in: cardIds } }, "name image").lean();
  const cardMap = new Map(cardDocs.map((card) => [card._id.toString(), card]));

  for (const pull of jackpotPulls) {
    const updatedRoom = await ChatRoom.findOneAndUpdate(
      { _id: room._id },
      {
        $inc: { submissionSeq: 1, visibleSeq: 1 },
        $set: { lastVisibleMessageAt: new Date() },
      },
      { returnDocument: "after" }
    );

    if (!updatedRoom) continue;

    const card = cardMap.get(pull.cardId.toString());
    const cardName = card?.name ?? "Unbekannte Karte";
    const cardImage = card?.image ?? null;
    const bodyOriginal = `${displayName} hat ${cardName} (${pull.coinValue} Coins) gezogen! 🔥🔥🔥🎆🎉💥`;

    const message = await ChatMessage.create({
      roomId: room._id,
      roomSlug: room.slug,
      submissionSeq: updatedRoom.submissionSeq,
      visibleSeq: updatedRoom.visibleSeq,
      authorUserId,
      source: "system",
      authorSnapshot,
      bodyOriginal,
      bodyNormalized: bodyOriginal.toLowerCase(),
      bodyDisplay: bodyOriginal,
      status: "visible",
      clientNonce: randomUUID(),
      mentionTargets: [],
      hasMention: false,
      hasLink: false,
      hasPII: false,
      highlightCard: {
        name: cardName,
        image: cardImage,
        rarity: pull.rarity,
        coinValue: pull.coinValue,
      },
      moderation: {
        provider: "local",
        action: "allow",
        reasonCodes: [],
      },
    });

    await appendChatArchiveEvent({
      roomId: room._id,
      roomSlug: room.slug,
      eventType: "message_visible",
      messageId: message._id,
      submissionSeq: message.submissionSeq,
      actorUserId: authorUserId,
      payload: {
        visibleSeq: message.visibleSeq,
        highlightCard: message.highlightCard,
        source: "jackpot_pull",
      },
    });

    const serializedMessage = await serializeChatMessageWithCurrentRelations(message);
    await publishRoomEvent(room.slug, {
      type: "message_created",
      payload: {
        message: serializedMessage,
      },
    });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { pullId, packGroupId, cardId, cardIndex, rarity, coinValue, decision, boxId } = body as {
    pullId?: string;
    packGroupId?: string;
    cardId?: string;
    cardIndex?: number;
    rarity?: string;
    coinValue?: number;
    decision?: "claim" | "convert";
    boxId?: string;
  };

  if ((!pullId && (!packGroupId || !cardId || cardIndex === undefined)) || !decision || !boxId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (decision !== "claim" && decision !== "convert") {
    return NextResponse.json({ error: "decision must be 'claim' or 'convert'" }, { status: 400 });
  }

  try {
    await connectDB();

    // Update the pending PackPull record to the user's decision
    // Use pullId (direct _id lookup) when available, fall back to packGroupId+cardIndex
    const query = pullId
      ? { _id: pullId, userId, status: "pending" }
      : { packGroupId, cardIndex, userId, status: "pending" };
    const pull = await PackPull.findOneAndUpdate(
      query,
      {
        $set: {
          status: decision === "claim" ? "reserved" : "converted",
          decidedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!pull) {
      return NextResponse.json({ error: "Already decided or not found" }, { status: 400 });
    }

    // Get user info for SSE event
    const userDoc = await User.findById(userId).select("name username image").lean();
    const cardDoc = await Card.findById(cardId).select("name image").lean();

    if (decision === "claim") {
      // Use existing cart expiry or start a new 3h window
      const existingItem = await CartItem.findOne({ userId, status: "reserved" })
        .select("expiresAt")
        .lean();
      const expiresAt = existingItem?.expiresAt
        ? new Date(existingItem.expiresAt)
        : new Date(Date.now() + RESERVATION_HOURS * 60 * 60 * 1000);

      await CartItem.create({
        userId,
        cardId,
        boxId,
        pullId: pull._id,
        rarity: pull.rarity,
        conversionValue: pull.conversionValue,
        status: "reserved",
        expiresAt,
      });

      const user = await User.findById(userId).select("coins").lean();

      // Publish SSE live event
      void publishLiveEvent(boxId, userDoc, cardDoc, rarity ?? "", coinValue ?? 0, decision);

      await finalizePackGroupIfComplete({ packGroupId: pull.packGroupId, userId });

      return NextResponse.json({
        success: true,
        decision: "reserved",
        expiresAt: expiresAt.toISOString(),
        newBalance: user?.coins ?? 0,
      });
    } else {
      // Convert-Multiplikator aus Achievement-Effekten. Runden auf ganze
      // Coins, damit die CoinTransaction integer bleibt. Fehler beim
      // Effekt-Lesen fällt auf Faktor 1.0 zurück (kein Bonus).
      let multiplier = 1;
      try {
        const effects = await getUserEffects(userId);
        if (Number.isFinite(effects.convertMultiplier) && effects.convertMultiplier > 0) {
          multiplier = effects.convertMultiplier;
        }
      } catch (err) {
        console.error("[pulls/decide effects]", err);
      }
      const effectiveValue = Math.max(1, Math.round(pull.conversionValue * multiplier));

      const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { coins: effectiveValue } },
        { returnDocument: "after" }
      );

      const { Types } = await import("mongoose");
      const cardObjectId = new Types.ObjectId(pull.cardId.toString());
      await Box.updateOne(
        { _id: pull.boxId, "cards.card": cardObjectId },
        { $inc: { "cards.$.stock": 1 } }
      );

      await CoinTransaction.create({
        userId,
        amount: effectiveValue,
        type: "card_conversion",
        reason:
          multiplier !== 1
            ? `convert_multiplier:${multiplier.toFixed(2)}`
            : null,
        relatedPullId: pull._id,
        relatedBoxId: pull.boxId,
      });

      // Level-System: fixe XP je Convert + Counter-Inkrement. Fehler dürfen
      // die User-Response nicht kippen, deshalb gekapselt.
      try {
        await grantXp(userId, XP_RATES.CARD_CONVERT, "card_convert");
        await incrementCounter(userId, "cardsConverted", 1);
      } catch (err) {
        console.error("[pulls/decide xp-hooks]", err);
      }

      // Publish SSE live event
      void publishLiveEvent(boxId, userDoc, cardDoc, pull.rarity, pull.coinValue, decision);

      await finalizePackGroupIfComplete({ packGroupId: pull.packGroupId, userId });

      return NextResponse.json({ success: true, decision: "converted", newBalance: user?.coins ?? 0 });
    }
  } catch (err) {
    console.error("[pulls/decide POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

async function publishLiveEvent(
  boxId: string,
  userDoc: { name?: string; username?: string; image?: string | null } | null,
  cardDoc: { name?: string; image?: string | null } | null,
  rarity: string,
  coinValue: number,
  decision: string
) {
  try {
    const redis = getRedis();
    await redis.publish(`box-events:${boxId}`, JSON.stringify({
      userName: userDoc?.name ?? userDoc?.username ?? "User",
      userImage: userDoc?.image ?? null,
      cardName: cardDoc?.name ?? "Unknown",
      cardImage: cardDoc?.image ?? null,
      rarity,
      coinValue,
      decision,
      timestamp: Date.now(),
    }));
  } catch {
    // Non-critical — SSE is best-effort
  }
}
