import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import {
  deleteFeedbackAttachments,
  FEEDBACK_ATTACHMENT_MAX_FILES,
  FEEDBACK_ATTACHMENT_MAX_SIZE,
  isAllowedFeedbackAttachmentType,
  uploadFeedbackAttachment,
} from "@/lib/feedback-attachments";
import { createFeedbackMessageSchema } from "@/lib/validations";
import FeedbackItem from "@/models/feedback-item";
import FeedbackMessage from "@/models/feedback-message";
import User from "@/models/user";
import {
  canReplyToFeedback,
  createNotifications,
  findFeedbackAuditLogs,
  findFeedbackById,
  findFeedbackMessages,
  isFeedbackStaff,
  logFeedbackAudit,
  serializeFeedbackAuditLog,
  serializeFeedbackItem,
  serializeFeedbackMessage,
  syncFeedbackQueueNotifications,
} from "@/lib/feedback";

interface ParsedMessageRequest {
  body: unknown;
  attachments: Array<{
    filename: string;
    contentType: string;
    buffer: Buffer;
  }>;
}

async function readAttachments(files: FormDataEntryValue[]): Promise<ParsedMessageRequest["attachments"]> {
  if (files.length > FEEDBACK_ATTACHMENT_MAX_FILES) {
    throw new Error(`You can upload up to ${FEEDBACK_ATTACHMENT_MAX_FILES} files per reply.`);
  }

  const attachments: ParsedMessageRequest["attachments"] = [];

  for (const file of files) {
    if (typeof file === "string") {
      continue;
    }

    if (!isAllowedFeedbackAttachmentType(file.type)) {
      throw new Error(`Unsupported file type: ${file.type || file.name}`);
    }

    if (file.size > FEEDBACK_ATTACHMENT_MAX_SIZE) {
      throw new Error(`Files must be ${Math.round(FEEDBACK_ATTACHMENT_MAX_SIZE / (1024 * 1024))} MB or smaller.`);
    }

    attachments.push({
      filename: file.name,
      contentType: file.type,
      buffer: Buffer.from(await file.arrayBuffer()),
    });
  }

  return attachments;
}

async function parseMessageRequest(req: NextRequest): Promise<ParsedMessageRequest> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    return {
      body: {
        body: formData.get("body") ?? "",
        isInternal: formData.get("isInternal") === "true",
      },
      attachments: await readAttachments(formData.getAll("attachments")),
    };
  }

  const body = await req.json();
  return {
    body,
    attachments: [],
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const viewerUserId = session?.user?.id;
  const viewerRole = (session?.user as { role?: string } | undefined)?.role ?? null;

  if (!viewerUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let parsedRequest: ParsedMessageRequest;
  try {
    parsedRequest = await parseMessageRequest(req);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }

  const parsed = createFeedbackMessageSchema.safeParse(parsedRequest.body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (!parsed.data.body.trim() && parsedRequest.attachments.length === 0) {
    return NextResponse.json({ error: "Reply cannot be empty" }, { status: 400 });
  }

  let createdMessageId = "";
  let uploadedAttachments: Array<{ attachmentId: string }> = [];

  try {
    await connectDB();

    const feedback = await FeedbackItem.findById(id);
    if (!feedback) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isStaff = isFeedbackStaff(viewerRole);
    if (!canReplyToFeedback(feedback, viewerUserId, viewerRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isInternal = Boolean(parsed.data.isInternal && isStaff);
    const now = new Date();

    const createdMessage = await FeedbackMessage.create({
      feedbackId: feedback._id,
      authorUserId: viewerUserId,
      authorType: isStaff ? "staff" : "user",
      body: parsed.data.body.trim(),
      attachments: [],
      isInternal,
    });
    createdMessageId = createdMessage._id.toString();

    if (parsedRequest.attachments.length > 0) {
      const storedAttachments = [];

      for (const attachment of parsedRequest.attachments) {
        const stored = await uploadFeedbackAttachment({
          filename: attachment.filename,
          contentType: attachment.contentType as never,
          buffer: attachment.buffer,
          uploadedByUserId: viewerUserId,
          feedbackId: feedback._id.toString(),
          messageId: createdMessageId,
        });
        storedAttachments.push(stored);
      }

      createdMessage.attachments = storedAttachments;
      uploadedAttachments = storedAttachments;
      await createdMessage.save();
    }

    if (isStaff) {
      feedback.lastStaffReplyAt = now;
      if (!feedback.firstResponseAt && !isInternal) {
        feedback.firstResponseAt = now;
      }
      if (!isInternal && feedback.status !== "closed") {
        feedback.status = "waiting";
        feedback.waitingOn = "user";
      }
    } else {
      feedback.lastUserReplyAt = now;
      if (feedback.status !== "closed") {
        feedback.status = "waiting";
        feedback.waitingOn = "staff";
      }
    }

    feedback.lastActivityAt = now;
    await feedback.save();

    await logFeedbackAudit({
      feedbackId: feedback._id.toString(),
      actorUserId: viewerUserId,
      actorType: isStaff ? "staff" : "user",
      action: isInternal ? "internal_note_added" : "message_added",
      message: isInternal ? "Added internal note" : "Added reply",
      visibility: isInternal ? "internal" : "public",
      metadata: {
        messageId: createdMessageId,
      },
    });

    if (parsedRequest.attachments.length > 0) {
      await logFeedbackAudit({
        feedbackId: feedback._id.toString(),
        actorUserId: viewerUserId,
        actorType: isStaff ? "staff" : "user",
        action: "attachments_added",
        message: `Added ${parsedRequest.attachments.length} attachment${parsedRequest.attachments.length === 1 ? "" : "s"}`,
        visibility: isInternal ? "internal" : "public",
        metadata: {
          messageId: createdMessageId,
        },
      });
    }

    if (!isInternal) {
      if (isStaff) {
        const submitter = await User.findById(feedback.submitterUserId)
          .select("_id preferences.language")
          .lean();

        if (submitter) {
          await createNotifications([
            {
              userId: submitter._id.toString(),
              title: `Neue Antwort zu ${feedback.ticketNo}`,
              message: feedback.title,
              type: "info",
              cta: {
                label: "Ticket ansehen",
                url: `/${submitter.preferences?.language ?? "de"}/feedback/${feedback._id.toString()}`,
              },
              category: "feedback_reply",
              entityType: "feedback",
              entityId: feedback._id.toString(),
              merge: true,
            },
          ]);
        }
      } else if (feedback.assignedTo) {
        const assignee = await User.findById(feedback.assignedTo)
          .select("_id preferences.language")
          .lean();

        if (assignee) {
          await createNotifications([
            {
              userId: assignee._id.toString(),
              title: `Nutzerantwort zu ${feedback.ticketNo}`,
              message: feedback.title,
              type: "info",
              cta: {
                label: "Ticket \u00F6ffnen",
                url: `/${assignee.preferences?.language ?? "de"}/admin/feedback/${feedback._id.toString()}`,
              },
              category: "feedback_reply",
              entityType: "feedback",
              entityId: feedback._id.toString(),
              merge: true,
            },
          ]);
        }
      }
    }

    await syncFeedbackQueueNotifications();

    const hydrated = await findFeedbackById(id);
    const [messages, auditLogs] = await Promise.all([
      findFeedbackMessages(id, isStaff),
      findFeedbackAuditLogs(id, isStaff),
    ]);

    return NextResponse.json({
      feedback: serializeFeedbackItem(hydrated as never, {
        viewerUserId,
        viewerRole,
      }),
      messages: messages.map((message) =>
        serializeFeedbackMessage(message as never, {
          viewerUserId,
          viewerRole,
        })
      ),
      auditLogs: auditLogs.map((entry) => serializeFeedbackAuditLog(entry as never)),
    });
  } catch (err) {
    if (uploadedAttachments.length > 0) {
      await deleteFeedbackAttachments(uploadedAttachments);
    }
    if (createdMessageId) {
      await FeedbackMessage.findByIdAndDelete(createdMessageId);
    }

    console.error("[feedback/[id]/messages POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
