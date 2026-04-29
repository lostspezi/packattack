import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import GodpackEvent from "@/models/godpack-event";
import ChatMessage from "@/models/chat-message";
import ChatRoom from "@/models/chat-room";
import User from "@/models/user";
import {
  appendChatArchiveEvent,
  ensureGlobalChatRoom,
  publishRoomEvent,
  serializeChatMessageWithCurrentRelations,
} from "@/lib/chat";
import { getChatRoleBadgeLabel } from "@/lib/chat-constants";

/**
 * POST /api/godpacks/{eventId}/reveal
 *
 * Aufgerufen vom Client, sobald der Glückliche alle 5 Karten seines Godpacks
 * gesehen hat. Markiert das Event als enthüllt und feuert die System-Chat-
 * Nachricht inkl. allen 5 Karten ab — _erst jetzt_ sehen die anderen User
 * den vollständigen Pull (das Live-Banner beim Trigger zeigt nur „Jemand
 * öffnet GERADE ein Godpack"). Idempotent: wiederholte Calls sind no-ops.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await params;
  if (!Types.ObjectId.isValid(eventId)) {
    return NextResponse.json({ error: "invalid_event_id" }, { status: 400 });
  }

  try {
    await connectDB();

    const event = await GodpackEvent.findById(eventId);
    if (!event) {
      return NextResponse.json({ error: "event_not_found" }, { status: 404 });
    }
    if (event.userId.toString() !== userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (event.revealedAt) {
      return NextResponse.json({
        ok: true,
        alreadyRevealed: true,
        chatMessageId: event.chatMessageId?.toString() ?? null,
      });
    }

    // Atomarer Reveal-Lock — nur der erste Reveal-Call darf die Chat-Message
    // senden, spätere Calls fallen in den `alreadyRevealed`-Pfad oben.
    const locked = await GodpackEvent.findOneAndUpdate(
      { _id: event._id, revealedAt: null },
      { $set: { revealedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!locked) {
      const refreshed = await GodpackEvent.findById(event._id).lean();
      return NextResponse.json({
        ok: true,
        alreadyRevealed: true,
        chatMessageId: refreshed?.chatMessageId?.toString() ?? null,
      });
    }

    // System-Chat-Message + Broadcast
    const [room, userDoc] = await Promise.all([
      ensureGlobalChatRoom(),
      User.findById(userId).select("username role image identityVerified").lean<{
        username: string | null;
        role: string | null;
        image: string | null;
        identityVerified: boolean | null;
      }>(),
    ]);

    const displayName = userDoc?.username?.trim() || locked.username || "Ein Spieler";
    const authorSnapshot = {
      name: userDoc?.username?.trim() || locked.username || "Nutzer",
      username: userDoc?.username ?? null,
      role: userDoc?.role ?? "user",
      roleBadge: getChatRoleBadgeLabel(userDoc?.role ?? "user"),
      profileBadges: [],
      avatarUrl: userDoc?.image ?? null,
      identityVerified: Boolean(userDoc?.identityVerified),
    };

    const updatedRoom = await ChatRoom.findOneAndUpdate(
      { _id: room._id },
      {
        $inc: { submissionSeq: 1, visibleSeq: 1 },
        $set: { lastVisibleMessageAt: new Date() },
      },
      { returnDocument: "after" },
    );
    if (!updatedRoom) {
      return NextResponse.json({ ok: true, chatMessageId: null });
    }

    const bodyOriginal = `${displayName} hat ein GODPACK gezogen — 5x ${locked.game}, zusammen ${locked.totalCoinValue} Coins!`;

    const message = await ChatMessage.create({
      roomId: room._id,
      roomSlug: room.slug,
      submissionSeq: updatedRoom.submissionSeq,
      visibleSeq: updatedRoom.visibleSeq,
      authorUserId: new Types.ObjectId(userId),
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
      godpackHighlight: {
        eventId: locked._id,
        username: displayName,
        game: locked.game,
        totalCoinValue: locked.totalCoinValue,
        cards: locked.cards.map((card) => ({
          cardId: card.cardId,
          name: card.name,
          image: card.image,
          rarity: card.rarity,
          coinValue: card.coinValue,
        })),
      },
      moderation: {
        provider: "local",
        action: "allow",
        reasonCodes: [],
      },
    });

    await GodpackEvent.updateOne(
      { _id: locked._id },
      { $set: { chatMessageId: message._id } },
    );

    await appendChatArchiveEvent({
      roomId: room._id,
      roomSlug: room.slug,
      eventType: "message_visible",
      messageId: message._id,
      submissionSeq: message.submissionSeq,
      actorUserId: new Types.ObjectId(userId),
      payload: {
        visibleSeq: message.visibleSeq,
        godpackHighlight: message.godpackHighlight,
        source: "godpack_reveal",
      },
    });

    const serializedMessage = await serializeChatMessageWithCurrentRelations(message);
    await publishRoomEvent(room.slug, {
      type: "message_created",
      payload: {
        message: serializedMessage,
      },
    });

    await publishRoomEvent(room.slug, {
      type: "godpack_revealed",
      payload: {
        eventId: locked._id.toString(),
        chatMessageId: message._id.toString(),
        username: displayName,
        game: locked.game,
        totalCoinValue: locked.totalCoinValue,
      },
    });

    return NextResponse.json({
      ok: true,
      chatMessageId: message._id.toString(),
    });
  } catch (err) {
    console.error("[godpacks/[eventId]/reveal POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
