import { Types } from "mongoose";
import { runRedisCommand } from "@/lib/redis";
import {
  FEEDBACK_OPEN_STATUSES,
  FEEDBACK_STAFF_ROLES,
  type FeedbackAuditVisibility,
  type FeedbackMessageAuthorType,
  type FeedbackStatus,
} from "@/lib/feedback-constants";
import type {
  FeedbackActorSummary,
  FeedbackAttachmentSummary,
  FeedbackAuditLogSummary,
  FeedbackItemSummary,
  FeedbackMessageSummary,
} from "@/types/feedback";
import FeedbackAuditLog, { type IFeedbackAuditLog } from "@/models/feedback-audit-log";
import FeedbackItem, { type IFeedbackAttachment, type IFeedbackItem } from "@/models/feedback-item";
import FeedbackMessage, { type IFeedbackMessage } from "@/models/feedback-message";
import Notification from "@/models/notification";
import User from "@/models/user";

interface NotificationInput {
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  cta?: { label: string; url: string } | null;
  category?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  merge?: boolean;
}

interface SerializeOptions {
  viewerUserId?: string | null;
  viewerRole?: string | null;
}

interface AuditLogInput {
  feedbackId: string;
  actorUserId?: string | null;
  actorType: FeedbackMessageAuthorType;
  action: string;
  message: string;
  visibility?: FeedbackAuditVisibility;
  field?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown> | null;
}

function unreadKey(userId: string) {
  return `notifications:unread:${userId}`;
}

function toDateString(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isImageAttachment(contentType: string): boolean {
  return contentType.startsWith("image/");
}

function serializeFeedbackAttachment(attachment: IFeedbackAttachment): FeedbackAttachmentSummary {
  return {
    attachmentId: attachment.attachmentId,
    filename: attachment.filename,
    contentType: attachment.contentType,
    size: attachment.size,
    uploadedAt: attachment.uploadedAt.toISOString(),
    isImage: isImageAttachment(attachment.contentType),
    url: `/api/feedback/attachments/${attachment.attachmentId}`,
  };
}

export function isFeedbackStaff(role?: string | null): boolean {
  return FEEDBACK_STAFF_ROLES.includes((role ?? "") as never);
}

export function isFeedbackOpen(status: FeedbackStatus): boolean {
  return FEEDBACK_OPEN_STATUSES.includes(status);
}

export function normalizeFeedbackTags(tags: string[] = []): string[] {
  const seen = new Set<string>();

  return tags
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter((tag) => tag.length > 0)
    .filter((tag) => {
      if (seen.has(tag)) return false;
      seen.add(tag);
      return true;
    })
    .slice(0, 8);
}

export function generateFeedbackTicketNo(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FB-${timestamp}-${suffix}`;
}

function extractReferencedUserId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;

  const doc = value as {
    _id?: { toString(): string };
    id?: string;
    toString?: () => string;
  };

  if (doc._id) {
    return doc._id.toString();
  }

  if (typeof doc.id === "string" && doc.id.length > 0) {
    return doc.id;
  }

  if (typeof doc.toString === "function" && doc.toString !== Object.prototype.toString) {
    const stringValue = doc.toString();
    return stringValue === "[object Object]" ? "" : stringValue;
  }

  return "";
}

export function canEditFeedbackItem(
  feedback: Pick<IFeedbackItem, "submitterUserId" | "status">,
  viewerUserId?: string | null,
  viewerRole?: string | null
): boolean {
  if (!viewerUserId) return false;
  if (isFeedbackStaff(viewerRole)) return true;
  return extractReferencedUserId(feedback.submitterUserId) === viewerUserId && feedback.status !== "closed";
}

export function canReplyToFeedback(
  feedback: Pick<IFeedbackItem, "submitterUserId" | "status">,
  viewerUserId?: string | null,
  viewerRole?: string | null
): boolean {
  if (!viewerUserId) return false;
  if (isFeedbackStaff(viewerRole)) return feedback.status !== "closed";
  return extractReferencedUserId(feedback.submitterUserId) === viewerUserId && feedback.status !== "closed";
}

export function canEditFeedbackMessage(
  message: Pick<IFeedbackMessage, "authorUserId">,
  viewerUserId?: string | null,
  viewerRole?: string | null
): boolean {
  if (!viewerUserId) return false;
  if (isFeedbackStaff(viewerRole)) return true;
  return extractReferencedUserId(message.authorUserId) === viewerUserId;
}

function toActorSummary(value: unknown): FeedbackActorSummary | null {
  if (!value) return null;

  const actor = value as {
    _id?: { toString(): string };
    id?: string;
    name?: string;
    username?: string | null;
    email?: string | null;
    role?: string;
    preferences?: { language?: string };
  };

  const id = actor._id?.toString() ?? actor.id ?? "";
  if (!id) return null;

  return {
    id,
    name: actor.name ?? actor.username ?? actor.email ?? "User",
    username: actor.username ?? null,
    email: actor.email ?? null,
    role: actor.role,
    language: actor.preferences?.language,
  };
}

export function serializeFeedbackItem(
  feedback: IFeedbackItem & {
    submitterUserId: unknown;
    assignedTo: unknown;
  },
  options: SerializeOptions = {}
): FeedbackItemSummary {
  return {
    id: feedback._id.toString(),
    ticketNo: feedback.ticketNo,
    kind: feedback.kind,
    title: feedback.title,
    description: feedback.description,
    status: feedback.status,
    waitingOn: feedback.waitingOn,
    priority: feedback.priority,
    severity: feedback.severity,
    areaTags: feedback.areaTags ?? [],
    issueTags: feedback.issueTags ?? [],
    submitter: toActorSummary(feedback.submitterUserId),
    assignedTo: toActorSummary(feedback.assignedTo),
    visibility: feedback.visibility,
    source: feedback.source,
    context: {
      route: feedback.context?.route ?? null,
      locale: feedback.context?.locale ?? "de",
      userAgent: feedback.context?.userAgent ?? null,
      viewportWidth: feedback.context?.viewportWidth ?? null,
      viewportHeight: feedback.context?.viewportHeight ?? null,
      releaseId: feedback.context?.releaseId ?? null,
      objectType: feedback.context?.objectType ?? null,
      objectId: feedback.context?.objectId ?? null,
    },
    attachments: (feedback.attachments ?? []).map(serializeFeedbackAttachment),
    createdAt: feedback.createdAt.toISOString(),
    updatedAt: feedback.updatedAt.toISOString(),
    lastActivityAt: feedback.lastActivityAt.toISOString(),
    firstResponseAt: toDateString(feedback.firstResponseAt),
    closedAt: toDateString(feedback.closedAt),
    reopenCount: feedback.reopenCount ?? 0,
    canEdit: canEditFeedbackItem(feedback, options.viewerUserId, options.viewerRole),
    canReply: canReplyToFeedback(feedback, options.viewerUserId, options.viewerRole),
    isStaffView: isFeedbackStaff(options.viewerRole),
  };
}

export function serializeFeedbackMessage(
  message: IFeedbackMessage & { authorUserId: unknown },
  options: SerializeOptions = {}
): FeedbackMessageSummary {
  return {
    id: message._id.toString(),
    body: message.body,
    isInternal: message.isInternal,
    authorType: message.authorType,
    author: toActorSummary(message.authorUserId),
    attachments: (message.attachments ?? []).map(serializeFeedbackAttachment),
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
    editedAt: toDateString(message.editedAt),
    editCount: message.editCount ?? 0,
    canEdit: canEditFeedbackMessage(message, options.viewerUserId, options.viewerRole),
  };
}

export function serializeFeedbackAuditLog(
  entry: IFeedbackAuditLog & { actorUserId: unknown }
): FeedbackAuditLogSummary {
  return {
    id: entry._id.toString(),
    action: entry.action,
    message: entry.message,
    actorType: entry.actorType,
    actor: toActorSummary(entry.actorUserId),
    visibility: entry.visibility,
    field: entry.field ?? null,
    createdAt: entry.createdAt.toISOString(),
    before: entry.before ?? null,
    after: entry.after ?? null,
  };
}

export async function logFeedbackAudit({
  feedbackId,
  actorUserId = null,
  actorType,
  action,
  message,
  visibility = "public",
  field = null,
  before = null,
  after = null,
  metadata = null,
}: AuditLogInput): Promise<void> {
  await FeedbackAuditLog.create({
    feedbackId,
    actorUserId,
    actorType,
    action,
    message,
    visibility,
    field,
    before,
    after,
    metadata,
  });
}

export async function createNotifications(inputs: NotificationInput[]): Promise<void> {
  const notifications = inputs.filter((item) => item.userId);
  if (notifications.length === 0) return;

  const affectedUsers = [...new Set(notifications.map((item) => item.userId))];

  const merged = notifications.filter((item) => item.merge);
  const direct = notifications.filter((item) => !item.merge);

  if (direct.length > 0) {
    await Notification.insertMany(
      direct.map((item) => ({
        userId: item.userId,
        title: item.title,
        message: item.message,
        type: item.type,
        cta: item.cta ?? null,
        category: item.category ?? null,
        entityType: item.entityType ?? null,
        entityId: item.entityId ?? null,
        read: false,
      }))
    );
  }

  if (merged.length > 0) {
    await Promise.all(
      merged.map(async (item) => {
        const filter = {
          userId: item.userId,
          category: item.category ?? null,
          entityType: item.entityType ?? null,
          entityId: item.entityId ?? null,
        };

        await Notification.findOneAndDelete(filter);

        await Notification.create({
          userId: item.userId,
          title: item.title,
          message: item.message,
          type: item.type,
          cta: item.cta ?? null,
          category: item.category ?? null,
          entityType: item.entityType ?? null,
          entityId: item.entityId ?? null,
          read: false,
        });
      })
    );
  }

  await runRedisCommand<void>(
    "feedback:invalidate-unread",
    undefined,
    async (redis) => {
      await Promise.all(
        affectedUsers.map(async (userId) => {
          await redis.del(unreadKey(userId));
          const count = await Notification.countDocuments({ userId, read: false });
          await redis.set(unreadKey(userId), count, "EX", 60);
          await redis.publish(`notifications:${userId}`, JSON.stringify({ unreadCount: count }));
        })
      );
    }
  );
}

export async function syncFeedbackQueueNotifications(): Promise<void> {
  const staffUsers = await User.find({ role: { $in: FEEDBACK_STAFF_ROLES } })
    .select("_id preferences.language")
    .lean();

  if (staffUsers.length === 0) return;

  const overdueBefore = new Date(Date.now() - 36 * 60 * 60 * 1000);

  const [newCount, waitingOnStaffCount, overdueCount] = await Promise.all([
    FeedbackItem.countDocuments({ status: "new" }),
    FeedbackItem.countDocuments({ status: "waiting", waitingOn: "staff" }),
    FeedbackItem.countDocuments({
      status: { $in: FEEDBACK_OPEN_STATUSES },
      lastActivityAt: { $lte: overdueBefore },
    }),
  ]);

  const attentionCount = newCount + waitingOnStaffCount + overdueCount;
  const userIds = staffUsers.map((user) => user._id.toString());

  if (attentionCount === 0) {
    await Notification.deleteMany({
      userId: { $in: userIds },
      category: "feedback_queue_attention",
      entityType: "feedback_queue",
      entityId: "global",
    });
    await runRedisCommand<void>(
      "feedback:clear-queue-unread",
      undefined,
      async (redis) => {
        await Promise.all(
          userIds.map(async (userId) => {
            await redis.del(unreadKey(userId));
            const count = await Notification.countDocuments({ userId, read: false });
            await redis.set(unreadKey(userId), count, "EX", 60);
            await redis.publish(`notifications:${userId}`, JSON.stringify({ unreadCount: count }));
          })
        );
      }
    );
    return;
  }

  const title = overdueCount > 0
    ? "Feedback-Ticket braucht Aufmerksamkeit"
    : "Offene Feedback-Tickets warten auf Pr\u00FCfung";

  // Route staff directly to one actionable ticket so the CTA matches its label.
  const [overdueTicket, newTicket, waitingTicket] = await Promise.all([
    FeedbackItem.findOne({
      status: { $in: FEEDBACK_OPEN_STATUSES },
      lastActivityAt: { $lte: overdueBefore },
    })
      .sort({ lastActivityAt: 1 })
      .select("_id")
      .lean(),
    FeedbackItem.findOne({ status: "new" })
      .sort({ createdAt: 1 })
      .select("_id")
      .lean(),
    FeedbackItem.findOne({ status: "waiting", waitingOn: "staff" })
      .sort({ lastActivityAt: 1 })
      .select("_id")
      .lean(),
  ]);

  const targetTicketId = overdueTicket?._id ?? newTicket?._id ?? waitingTicket?._id;

  const message = [
    newCount > 0 ? `${newCount} neu` : null,
    waitingOnStaffCount > 0 ? `${waitingOnStaffCount} wartend` : null,
    overdueCount > 0 ? `${overdueCount} \u00FCberf\u00E4llig` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  await createNotifications(
    staffUsers.map((user) => ({
      userId: user._id.toString(),
      title,
      message,
      type: overdueCount > 0 ? "warning" : "info",
      cta: {
        label: "Ticket \u00F6ffnen",
        url: targetTicketId
          ? `/${user.preferences?.language ?? "de"}/admin/feedback/${targetTicketId.toString()}`
          : `/${user.preferences?.language ?? "de"}/admin/feedback`,
      },
      category: "feedback_queue_attention",
      entityType: "feedback_queue",
      entityId: "global",
      merge: true,
    }))
  );
}

export function getFeedbackPainScore(input: {
  priority: string;
  severity: string;
  reopenCount?: number;
}): number {
  const priorityScore = {
    low: 1,
    medium: 2,
    high: 3,
    urgent: 4,
  }[input.priority] ?? 1;

  const severityScore = {
    cosmetic: 1,
    minor: 2,
    major: 3,
    critical: 4,
  }[input.severity] ?? 1;

  return priorityScore * severityScore + (input.reopenCount ?? 0);
}

export async function findFeedbackById(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;

  return FeedbackItem.findById(id)
    .populate("submitterUserId", "name username email role preferences.language")
    .populate("assignedTo", "name username email role preferences.language")
    .lean();
}

export async function findFeedbackMessages(feedbackId: string, includeInternal: boolean) {
  const query = includeInternal ? { feedbackId } : { feedbackId, isInternal: false };

  return FeedbackMessage.find(query)
    .sort({ createdAt: 1 })
    .populate("authorUserId", "name username email role preferences.language")
    .lean();
}

export async function findFeedbackAuditLogs(feedbackId: string, includeInternal: boolean) {
  const query = includeInternal ? { feedbackId } : { feedbackId, visibility: "public" };

  return FeedbackAuditLog.find(query)
    .sort({ createdAt: -1 })
    .populate("actorUserId", "name username email role preferences.language")
    .lean();
}
