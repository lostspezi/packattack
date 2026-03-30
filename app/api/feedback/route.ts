import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { assertFeedbackSubmissionAllowed, getRequestIpAddress } from "@/lib/feedback-abuse";
import {
  FEEDBACK_ATTACHMENT_MAX_FILES,
  FEEDBACK_ATTACHMENT_MAX_SIZE,
  isAllowedFeedbackAttachmentType,
  uploadFeedbackAttachment,
} from "@/lib/feedback-attachments";
import {
  createFeedbackSchema,
} from "@/lib/validations";
import FeedbackItem from "@/models/feedback-item";
import { FEEDBACK_OPEN_STATUSES } from "@/lib/feedback-constants";
import {
  deleteFeedbackAttachments,
} from "@/lib/feedback-attachments";
import {
  findFeedbackById,
  generateFeedbackTicketNo,
  getFeedbackPainScore,
  isFeedbackStaff,
  logFeedbackAudit,
  normalizeFeedbackTags,
  serializeFeedbackItem,
  syncFeedbackQueueNotifications,
} from "@/lib/feedback";

const LOCAL_FEEDBACK_RATE_LIMIT_BYPASS_EMAILS = new Set(
  (process.env.FEEDBACK_RATE_LIMIT_BYPASS_EMAILS ?? "tester@packattack.gg")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
);

function shouldBypassFeedbackRateLimit(email?: string | null): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (!email) return false;
  return LOCAL_FEEDBACK_RATE_LIMIT_BYPASS_EMAILS.has(email.trim().toLowerCase());
}

interface ParsedFeedbackRequest {
  data: unknown;
  attachments: Array<{
    filename: string;
    contentType: string;
    buffer: Buffer;
  }>;
}

function parseJsonOrNull(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

async function readAttachments(files: FormDataEntryValue[]): Promise<ParsedFeedbackRequest["attachments"]> {
  if (files.length > FEEDBACK_ATTACHMENT_MAX_FILES) {
    throw new Error(`You can upload up to ${FEEDBACK_ATTACHMENT_MAX_FILES} files per ticket.`);
  }

  const attachments: ParsedFeedbackRequest["attachments"] = [];

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

async function parseFeedbackRequest(req: NextRequest): Promise<ParsedFeedbackRequest> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const attachments = await readAttachments(formData.getAll("attachments"));

    return {
      data: {
        kind: formData.get("kind"),
        title: formData.get("title"),
        description: formData.get("description"),
        priority: formData.get("priority") || undefined,
        severity: formData.get("severity") || undefined,
        source: formData.get("source") || undefined,
        areaTags: parseJsonOrNull(formData.get("areaTags")),
        issueTags: parseJsonOrNull(formData.get("issueTags")),
        context: parseJsonOrNull(formData.get("context")),
      },
      attachments,
    };
  }

  const data = await req.json();
  return { data, attachments: [] };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  const userRole = (session?.user as { role?: string } | undefined)?.role ?? null;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));
  const status = searchParams.get("status") ?? "";
  const kind = searchParams.get("kind") ?? "";
  const tab = searchParams.get("tab") === "archive" ? "archive" : "open";
  const skip = (page - 1) * limit;

  try {
    await connectDB();

    const query: Record<string, unknown> = {
      submitterUserId: userId,
    };

    if (tab === "archive") {
      query.status = "closed";
    } else if (status && status !== "closed") {
      query.status = status;
    } else {
      query.status = { $in: FEEDBACK_OPEN_STATUSES };
    }
    if (kind) query.kind = kind;

    const [items, total, openCount, archiveCount] = await Promise.all([
      FeedbackItem.find(query)
        .sort(
          tab === "archive"
            ? { closedAt: -1, lastActivityAt: -1 }
            : { lastActivityAt: -1 }
        )
        .skip(skip)
        .limit(limit)
        .populate("submitterUserId", "name username email role preferences.language")
        .populate("assignedTo", "name username email role preferences.language")
        .lean(),
      FeedbackItem.countDocuments(query),
      FeedbackItem.countDocuments({
        submitterUserId: userId,
        status: { $in: FEEDBACK_OPEN_STATUSES },
      }),
      FeedbackItem.countDocuments({
        submitterUserId: userId,
        status: "closed",
      }),
    ]);

    return NextResponse.json({
      items: items.map((item) =>
        serializeFeedbackItem(item as never, {
          viewerUserId: userId,
          viewerRole: userRole,
        })
      ),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      counts: {
        open: openCount,
        archive: archiveCount,
      },
    });
  } catch (err) {
    console.error("[feedback GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  const userRole = (session?.user as { role?: string } | undefined)?.role ?? null;
  const userEmail = (session?.user as { email?: string | null } | undefined)?.email ?? null;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsedRequest: ParsedFeedbackRequest;
  try {
    parsedRequest = await parseFeedbackRequest(req);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }

  const parsed = createFeedbackSchema.safeParse(parsedRequest.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const bypassRateLimit = shouldBypassFeedbackRateLimit(userEmail);

  if (!bypassRateLimit) {
    const rateLimit = await assertFeedbackSubmissionAllowed({
      userId,
      ipAddress: getRequestIpAddress(req.headers.get("x-forwarded-for")),
      title: parsed.data.title,
      description: parsed.data.description,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json({ error: rateLimit.error ?? "Too many feedback submissions" }, { status: 429 });
    }
  }

  let createdFeedbackId = "";
  let uploadedAttachments: Array<{ attachmentId: string }> = [];

  try {
    await connectDB();

    const visibility = parsed.data.kind === "report_abuse" ? "restricted" : "private";
    const priority = parsed.data.priority ?? (parsed.data.kind === "report_abuse" ? "high" : "medium");
    const severity = parsed.data.severity ?? (parsed.data.kind === "report_abuse" ? "major" : "minor");

    const created = await FeedbackItem.create({
      ticketNo: generateFeedbackTicketNo(),
      submitterUserId: userId,
      kind: parsed.data.kind,
      title: parsed.data.title,
      description: parsed.data.description,
      status: "new",
      waitingOn: "staff",
      priority,
      severity,
      visibility,
      source: parsed.data.source ?? "dashboard",
      areaTags: normalizeFeedbackTags(parsed.data.areaTags ?? []),
      issueTags: normalizeFeedbackTags(parsed.data.issueTags ?? []),
      attachments: [],
      context: {
        route: parsed.data.context?.route ?? null,
        locale: parsed.data.context?.locale ?? session.user.language ?? "de",
        userAgent: parsed.data.context?.userAgent ?? null,
        viewportWidth: parsed.data.context?.viewportWidth ?? null,
        viewportHeight: parsed.data.context?.viewportHeight ?? null,
        releaseId: parsed.data.context?.releaseId ?? null,
        objectType: parsed.data.context?.objectType ?? null,
        objectId: parsed.data.context?.objectId ?? null,
      },
      lastActivityAt: new Date(),
      lastUserReplyAt: new Date(),
      painScore: getFeedbackPainScore({ priority, severity }),
    });

    createdFeedbackId = created._id.toString();

    if (parsedRequest.attachments.length > 0) {
      const storedAttachments = [];

      for (const attachment of parsedRequest.attachments) {
        const stored = await uploadFeedbackAttachment({
          filename: attachment.filename,
          contentType: attachment.contentType as never,
          buffer: attachment.buffer,
          uploadedByUserId: userId,
          feedbackId: createdFeedbackId,
        });
        storedAttachments.push(stored);
      }

      created.attachments = storedAttachments;
      uploadedAttachments = storedAttachments;
      await created.save();
    }

    await logFeedbackAudit({
      feedbackId: created._id.toString(),
      actorUserId: userId,
      actorType: isFeedbackStaff(userRole) ? "staff" : "user",
      action: "created",
      message: `Created ${created.ticketNo}`,
      visibility: "public",
    });

    if (parsedRequest.attachments.length > 0) {
      await logFeedbackAudit({
        feedbackId: created._id.toString(),
        actorUserId: userId,
        actorType: isFeedbackStaff(userRole) ? "staff" : "user",
        action: "attachments_added",
        message: `Added ${parsedRequest.attachments.length} attachment${parsedRequest.attachments.length === 1 ? "" : "s"}`,
        visibility: "public",
      });
    }

    await syncFeedbackQueueNotifications();

    const hydrated = await findFeedbackById(created._id.toString());
    if (!hydrated) {
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    return NextResponse.json(
      {
        feedback: serializeFeedbackItem(hydrated as never, {
          viewerUserId: userId,
          viewerRole: userRole,
        }),
      },
      { status: 201 }
    );
  } catch (err) {
    if (uploadedAttachments.length > 0) {
      await deleteFeedbackAttachments(uploadedAttachments);
    }

    if (createdFeedbackId) {
      await FeedbackItem.findByIdAndDelete(createdFeedbackId);
    }

    console.error("[feedback POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
