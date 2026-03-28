import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { updateFeedbackSchema } from "@/lib/validations";
import FeedbackItem from "@/models/feedback-item";
import User from "@/models/user";
import {
  canEditFeedbackItem,
  createNotifications,
  findFeedbackAuditLogs,
  findFeedbackById,
  findFeedbackMessages,
  getFeedbackPainScore,
  isFeedbackOpen,
  isFeedbackStaff,
  logFeedbackAudit,
  normalizeFeedbackTags,
  serializeFeedbackAuditLog,
  serializeFeedbackItem,
  serializeFeedbackMessage,
  syncFeedbackQueueNotifications,
} from "@/lib/feedback";
import { FEEDBACK_STAFF_ROLES } from "@/lib/feedback-constants";

function extractUserId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const doc = value as { _id?: { toString(): string }; toString?: () => string };
  return doc._id?.toString() ?? doc.toString?.() ?? "";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const viewerUserId = session?.user?.id;
  const viewerRole = (session?.user as { role?: string } | undefined)?.role ?? null;

  if (!viewerUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const feedback = await findFeedbackById(id);
    if (!feedback) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isStaff = isFeedbackStaff(viewerRole);
    const submitterId = extractUserId(feedback.submitterUserId);

    if (!isStaff && submitterId !== viewerUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [messages, auditLogs] = await Promise.all([
      findFeedbackMessages(id, isStaff),
      findFeedbackAuditLogs(id, isStaff),
    ]);

    return NextResponse.json({
      feedback: serializeFeedbackItem(feedback as never, {
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
    console.error("[feedback/[id] GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    const feedback = await FeedbackItem.findById(id);
    if (!feedback) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const submitter = await User.findById(feedback.submitterUserId)
      .select("_id preferences.language")
      .lean();

    const isStaff = isFeedbackStaff(viewerRole);

    if (!isStaff && !canEditFeedbackItem(feedback, viewerUserId, viewerRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const notifications: Array<{
      userId: string;
      title: string;
      message: string;
      type: "info" | "success" | "warning" | "error";
      cta?: { label: string; url: string } | null;
      category?: string | null;
      entityType?: string | null;
      entityId?: string | null;
      merge?: boolean;
    }> = [];

    const now = new Date();
    const update = parsed.data;
    const changedFields: string[] = [];

    if (!isStaff) {
      const allowed = ["title", "description", "kind"] as const;
      const invalidField = Object.keys(update).find(
        (field) => !(allowed as readonly string[]).includes(field)
      );
      if (invalidField) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (update.title !== undefined && update.title !== feedback.title) {
      const before = feedback.title;
      feedback.title = update.title;
      changedFields.push("title");
      await logFeedbackAudit({
        feedbackId: feedback._id.toString(),
        actorUserId: viewerUserId,
        actorType: isStaff ? "staff" : "user",
        action: "ticket_updated",
        field: "title",
        message: "Updated title",
        visibility: "public",
        before,
        after: feedback.title,
      });
    }

    if (update.description !== undefined && update.description !== feedback.description) {
      const before = feedback.description;
      feedback.description = update.description;
      changedFields.push("description");
      await logFeedbackAudit({
        feedbackId: feedback._id.toString(),
        actorUserId: viewerUserId,
        actorType: isStaff ? "staff" : "user",
        action: "ticket_updated",
        field: "description",
        message: "Updated description",
        visibility: "public",
        before,
        after: feedback.description,
      });
    }

    if (update.kind !== undefined && update.kind !== feedback.kind) {
      const before = feedback.kind;
      feedback.kind = update.kind;
      changedFields.push("kind");
      await logFeedbackAudit({
        feedbackId: feedback._id.toString(),
        actorUserId: viewerUserId,
        actorType: isStaff ? "staff" : "user",
        action: "ticket_updated",
        field: "kind",
        message: "Updated ticket type",
        visibility: "public",
        before,
        after: feedback.kind,
      });
    }

    if (isStaff && update.priority !== undefined && update.priority !== feedback.priority) {
      const before = feedback.priority;
      feedback.priority = update.priority;
      changedFields.push("priority");
      await logFeedbackAudit({
        feedbackId: feedback._id.toString(),
        actorUserId: viewerUserId,
        actorType: "staff",
        action: "triage_updated",
        field: "priority",
        message: `Changed priority to ${feedback.priority}`,
        visibility: "internal",
        before,
        after: feedback.priority,
      });
    }

    if (isStaff && update.severity !== undefined && update.severity !== feedback.severity) {
      const before = feedback.severity;
      feedback.severity = update.severity;
      changedFields.push("severity");
      await logFeedbackAudit({
        feedbackId: feedback._id.toString(),
        actorUserId: viewerUserId,
        actorType: "staff",
        action: "triage_updated",
        field: "severity",
        message: `Changed severity to ${feedback.severity}`,
        visibility: "internal",
        before,
        after: feedback.severity,
      });
    }

    if (isStaff && update.areaTags !== undefined) {
      const nextTags = normalizeFeedbackTags(update.areaTags);
      if (JSON.stringify(nextTags) !== JSON.stringify(feedback.areaTags ?? [])) {
        const before = feedback.areaTags ?? [];
        feedback.areaTags = nextTags;
        changedFields.push("areaTags");
        await logFeedbackAudit({
          feedbackId: feedback._id.toString(),
          actorUserId: viewerUserId,
          actorType: "staff",
          action: "triage_updated",
          field: "areaTags",
          message: "Updated area tags",
          visibility: "internal",
          before,
          after: nextTags,
        });
      }
    }

    if (isStaff && update.issueTags !== undefined) {
      const nextTags = normalizeFeedbackTags(update.issueTags);
      if (JSON.stringify(nextTags) !== JSON.stringify(feedback.issueTags ?? [])) {
        const before = feedback.issueTags ?? [];
        feedback.issueTags = nextTags;
        changedFields.push("issueTags");
        await logFeedbackAudit({
          feedbackId: feedback._id.toString(),
          actorUserId: viewerUserId,
          actorType: "staff",
          action: "triage_updated",
          field: "issueTags",
          message: "Updated issue tags",
          visibility: "internal",
          before,
          after: nextTags,
        });
      }
    }

    if (isStaff && update.assignedTo !== undefined) {
      const before = feedback.assignedTo?.toString() ?? null;

      if (update.assignedTo) {
        const assigneeQuery = update.assignedTo.trim();
        const assignee = await User.findOne({
          $or: [
            { username: assigneeQuery },
            { email: assigneeQuery },
            ...(assigneeQuery.match(/^[a-f\d]{24}$/i) ? [{ _id: assigneeQuery }] : []),
          ],
        })
          .select("_id name username email role preferences.language")
          .lean();

        if (!assignee || !FEEDBACK_STAFF_ROLES.includes(assignee.role as never)) {
          return NextResponse.json({ error: "Invalid assignee" }, { status: 400 });
        }

        const nextAssignedTo = assignee._id.toString();
        if (before !== nextAssignedTo) {
          feedback.assignedTo = assignee._id;
          changedFields.push("assignedTo");
          notifications.push({
            userId: assignee._id.toString(),
            title: `Ticket ${feedback.ticketNo} wurde dir zugewiesen`,
            message: feedback.title,
            type: "info",
            cta: {
              label: "Ticket \u00F6ffnen",
              url: `/${assignee.preferences?.language ?? "de"}/admin/feedback/${feedback._id.toString()}`,
            },
            category: "feedback_assignment",
            entityType: "feedback",
            entityId: feedback._id.toString(),
            merge: true,
          });
          await logFeedbackAudit({
            feedbackId: feedback._id.toString(),
            actorUserId: viewerUserId,
            actorType: "staff",
            action: "assigned",
            field: "assignedTo",
            message: "Assigned ticket",
            visibility: "internal",
            before,
            after: nextAssignedTo,
          });
        }
      } else if (before) {
        feedback.assignedTo = null;
        changedFields.push("assignedTo");
        await logFeedbackAudit({
          feedbackId: feedback._id.toString(),
          actorUserId: viewerUserId,
          actorType: "staff",
          action: "unassigned",
          field: "assignedTo",
          message: "Unassigned ticket",
          visibility: "internal",
          before,
          after: null,
        });
      }
    }

    if (isStaff && update.waitingOn !== undefined && update.waitingOn !== feedback.waitingOn) {
      const before = feedback.waitingOn;
      feedback.waitingOn = update.waitingOn;
      changedFields.push("waitingOn");
      await logFeedbackAudit({
        feedbackId: feedback._id.toString(),
        actorUserId: viewerUserId,
        actorType: "staff",
        action: "status_updated",
        field: "waitingOn",
        message: `Waiting now on ${feedback.waitingOn}`,
        visibility: "public",
        before,
        after: feedback.waitingOn,
      });
    }

    if (isStaff && update.status !== undefined && update.status !== feedback.status) {
      const before = feedback.status;
      const wasClosed = feedback.status === "closed";
      const willBeOpen = isFeedbackOpen(update.status);

      feedback.status = update.status;
      changedFields.push("status");

      if (update.status === "closed") {
        feedback.closedAt = now;
        feedback.waitingOn = "none";
        notifications.push({
          userId: feedback.submitterUserId.toString(),
          title: `Ticket ${feedback.ticketNo} wurde geschlossen`,
          message: feedback.title,
          type: "info",
          cta: {
            label: "Ticket ansehen",
            url: `/${submitter?.preferences?.language ?? "de"}/feedback/${feedback._id.toString()}`,
          },
          category: "feedback_status",
          entityType: "feedback",
          entityId: feedback._id.toString(),
          merge: true,
        });
      } else {
        feedback.closedAt = null;
        if (update.status !== "waiting") {
          feedback.waitingOn = "none";
        }
      }

      if (!feedback.firstResponseAt && update.status !== "new") {
        feedback.firstResponseAt = now;
      }

      if (wasClosed && willBeOpen) {
        feedback.reopenCount += 1;
      }

      await logFeedbackAudit({
        feedbackId: feedback._id.toString(),
        actorUserId: viewerUserId,
        actorType: "staff",
        action: "status_updated",
        field: "status",
        message: `Changed status to ${feedback.status}`,
        visibility: "public",
        before,
        after: feedback.status,
      });
    }

    if (changedFields.length === 0) {
      return NextResponse.json({ error: "No changes detected" }, { status: 400 });
    }

    feedback.lastActivityAt = now;
    feedback.painScore = getFeedbackPainScore({
      priority: feedback.priority,
      severity: feedback.severity,
      reopenCount: feedback.reopenCount,
    });

    await feedback.save();

    if (notifications.length > 0) {
      await createNotifications(notifications);
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
    console.error("[feedback/[id] PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
