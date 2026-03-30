import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import {
  appendChatArchiveEvent,
  ensureGlobalChatRoom,
  publishRoomEvent,
  serializeChatMessageWithCurrentRelations,
} from "@/lib/chat";
import { isChatAdmin } from "@/lib/chat-constants";
import { escapeMentionRegex, extractMentionUsernames } from "@/lib/chat-mentions";
import { containsChatLink, normalizeChatBody } from "@/lib/chat-links";
import connectDB from "@/lib/db";
import { updateChatMessageSchema } from "@/lib/validations";
import ChatMessage from "@/models/chat-message";
import User from "@/models/user";

export const dynamic = "force-dynamic";

function canEditAsAdmin(role: string | null | undefined) {
  return isChatAdmin(role);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  const sessionRole = session?.user?.role ?? null;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canEditAsAdmin(sessionRole)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = updateChatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { messageId } = await params;
    if (!Types.ObjectId.isValid(messageId)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    await connectDB();

    const [room, user] = await Promise.all([
      ensureGlobalChatRoom(),
      User.findById(userId).lean(),
    ]);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canEditAsAdmin(user.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const message = await ChatMessage.findOne({
      _id: new Types.ObjectId(messageId),
      roomId: room._id,
    });

    if (!message) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (!message.authorUserId || message.authorUserId.toString() !== userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (message.status !== "visible") {
      return NextResponse.json({ error: "not_editable" }, { status: 400 });
    }

    const normalizedBody = normalizeChatBody(parsed.data.body);
    const mentionUsernames = extractMentionUsernames(normalizedBody).slice(0, 8);
    const mentionUsers =
      mentionUsernames.length > 0
        ? await User.find(
            {
              $or: mentionUsernames.map((username) => ({
                username: new RegExp(`^${escapeMentionRegex(username)}$`, "i"),
              })),
            },
            "name username"
          ).lean()
        : [];

    const mentionTargets = mentionUsers
      .filter((target): target is typeof target & { username: string } => Boolean(target.username))
      .map((target) => ({
        userId: target._id,
        username: target.username,
        name: target.username,
      }));

    message.bodyOriginal = normalizedBody;
    message.bodyNormalized = normalizedBody.toLowerCase();
    message.bodyDisplay = normalizedBody;
    message.mentionTargets = mentionTargets;
    message.hasMention = mentionTargets.length > 0;
    message.hasLink = containsChatLink(normalizedBody);
    await message.save();

    const serializedMessage = await serializeChatMessageWithCurrentRelations(message);

    await appendChatArchiveEvent({
      roomId: room._id,
      roomSlug: room.slug,
      eventType: "message_updated",
      messageId: message._id,
      submissionSeq: message.submissionSeq,
      actorUserId: userId,
      payload: {
        bodyOriginal: normalizedBody,
        hasMention: message.hasMention,
        hasLink: message.hasLink,
        mentionTargets: message.mentionTargets,
      },
    });

    await publishRoomEvent(room.slug, {
      type: "message_updated",
      payload: {
        message: serializedMessage,
      },
    });

    return NextResponse.json({ message: serializedMessage });
  } catch (error) {
    console.error("[chat message PATCH]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
