import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { appendChatArchiveEvent, ensureGlobalChatRoom, publishRoomEvent } from "@/lib/chat";
import { createChatReportSchema } from "@/lib/validations";
import ChatMessage from "@/models/chat-message";
import ChatReport from "@/models/chat-report";
import User from "@/models/user";

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = createChatReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await connectDB();
    const [room, user, message] = await Promise.all([
      ensureGlobalChatRoom(),
      User.findById(userId).lean(),
      ChatMessage.findById(parsed.data.messageId),
    ]);

    if (!user || !message || message.roomSlug !== room.slug) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const report = await ChatReport.findOneAndUpdate(
      {
        roomId: room._id,
        reporterUserId: userId,
        messageId: message._id,
      },
      {
        $setOnInsert: {
          roomId: room._id,
          roomSlug: room.slug,
          reporterUserId: userId,
          messageId: message._id,
        },
        $set: {
          category: parsed.data.category,
          note: parsed.data.note?.trim() || null,
          status: "open",
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    await appendChatArchiveEvent({
      roomId: room._id,
      eventType: "report_created",
      messageId: message._id,
      actorUserId: userId,
      payload: {
        reportId: report?._id?.toString(),
        category: parsed.data.category,
        note: parsed.data.note?.trim() || null,
      },
    });

    await publishRoomEvent(room.slug, {
      type: "moderation_updated",
      payload: {
        kind: "report_created",
        reportId: report?._id?.toString() ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[chat report POST]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
