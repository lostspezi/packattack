import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { updateFeedbackMessageSchema } from "@/lib/validations";
import FeedbackItem from "@/models/feedback-item";
import FeedbackMessage from "@/models/feedback-message";
import {
  canEditFeedbackMessage,
  findFeedbackAuditLogs,
  findFeedbackById,
  findFeedbackMessages,
  isFeedbackStaff,
  logFeedbackAudit,
  serializeFeedbackAuditLog,
  serializeFeedbackItem,
  serializeFeedbackMessage,
} from "@/lib/feedback";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const session = await auth();
  const viewerUserId = session?.user?.id;
  const viewerRole = (session?.user as { role?: string } | undefined)?.role ?? null;

  if (!viewerUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, messageId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateFeedbackMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    const [feedback, message] = await Promise.all([
      FeedbackItem.findById(id),
      FeedbackMessage.findOne({ _id: messageId, feedbackId: id }),
    ]);

    if (!feedback || !message) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!canEditFeedbackMessage(message, viewerUserId, viewerRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (parsed.data.body === message.body) {
      return NextResponse.json({ error: "No changes detected" }, { status: 400 });
    }

    const before = message.body;
    message.body = parsed.data.body;
    message.editedAt = new Date();
    message.editedByUserId = viewerUserId as never;
    message.editCount += 1;

    feedback.lastActivityAt = new Date();

    await Promise.all([message.save(), feedback.save()]);

    await logFeedbackAudit({
      feedbackId: feedback._id.toString(),
      actorUserId: viewerUserId,
      actorType: isFeedbackStaff(viewerRole) ? "staff" : "user",
      action: "message_updated",
      message: "Edited message",
      visibility: message.isInternal ? "internal" : "public",
      field: "message",
      before,
      after: message.body,
      metadata: {
        messageId: message._id.toString(),
      },
    });

    const hydrated = await findFeedbackById(id);
    const isStaff = isFeedbackStaff(viewerRole);
    const [messages, auditLogs] = await Promise.all([
      findFeedbackMessages(id, isStaff),
      findFeedbackAuditLogs(id, isStaff),
    ]);

    return NextResponse.json({
      feedback: serializeFeedbackItem(hydrated as never, {
        viewerUserId,
        viewerRole,
      }),
      messages: messages.map((entry) =>
        serializeFeedbackMessage(entry as never, {
          viewerUserId,
          viewerRole,
        })
      ),
      auditLogs: auditLogs.map((entry) => serializeFeedbackAuditLog(entry as never)),
    });
  } catch (err) {
    console.error("[feedback/[id]/messages/[messageId] PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
