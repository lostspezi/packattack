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
import CartItem from "@/models/cart-item";
import User from "@/models/user";
import Box from "@/models/box";
import Card from "@/models/card";
import ChatMessage from "@/models/chat-message";
import ChatRoom from "@/models/chat-room";
import CoinTransaction from "@/models/coin-transaction";

const RESERVATION_HOURS = 3;
const CHAT_JACKPOT_MIN_VALUE = 90;

async function publishJackpotPullsAfterCompletion(input: {
  packGroupId: string;
  userId: string;
}) {
  const hasPending = await PackPull.exists({
    packGroupId: input.packGroupId,
    userId: input.userId,
    status: "pending",
  });
  if (hasPending) return;

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
    const bodyOriginal = `JACKPOT! ${displayName} hat ${cardName} (${pull.coinValue} Coins) gezogen! 🔥🔥🔥🎆🎉💥`;

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

  const { packGroupId, cardId, cardIndex, rarity, coinValue, decision, boxId } = body as {
    packGroupId?: string;
    cardId?: string;
    cardIndex?: number;
    rarity?: string;
    coinValue?: number;
    decision?: "claim" | "convert";
    boxId?: string;
  };

  if (!packGroupId || !cardId || cardIndex === undefined || !decision || !boxId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (decision !== "claim" && decision !== "convert") {
    return NextResponse.json({ error: "decision must be 'claim' or 'convert'" }, { status: 400 });
  }

  try {
    await connectDB();

    // Update the pending PackPull record to the user's decision
    const pull = await PackPull.findOneAndUpdate(
      { packGroupId, cardIndex, userId, status: "pending" },
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

      await publishJackpotPullsAfterCompletion({ packGroupId, userId });

      return NextResponse.json({
        success: true,
        decision: "reserved",
        expiresAt: expiresAt.toISOString(),
        newBalance: user?.coins ?? 0,
      });
    } else {
      const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { coins: pull.conversionValue } },
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
        amount: pull.conversionValue,
        type: "card_conversion",
        relatedPullId: pull._id,
        relatedBoxId: pull.boxId,
      });

      // Publish SSE live event
      void publishLiveEvent(boxId, userDoc, cardDoc, pull.rarity, pull.coinValue, decision);

      await publishJackpotPullsAfterCompletion({ packGroupId, userId });

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
