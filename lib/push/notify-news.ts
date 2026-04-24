import connectDB from "@/lib/db";
import Notification from "@/models/notification";
import PushSubscription, {
  type IPushSubscription,
} from "@/models/push-subscription";
import User from "@/models/user";
import type { INewsPost } from "@/models/news-post";
import { sendPushToSubscriptions } from "@/lib/push/web-push";

const BROADCAST_URL = "/dashboard";
const BATCH_SIZE = 500;

interface NotifyResult {
  notificationsCreated: number;
  pushAttempted: number;
  pushSucceeded: number;
  pushRemoved: number;
  pushFailed: number;
}

function buildNotificationCta(post: Pick<INewsPost, "type">) {
  if (post.type === "release") return { label: "Was ist neu?", url: BROADCAST_URL };
  if (post.type === "event") return { label: "Event ansehen", url: BROADCAST_URL };
  return { label: "Mehr erfahren", url: BROADCAST_URL };
}

function buildExcerpt(post: Pick<INewsPost, "excerpt" | "body">): string {
  const source = post.excerpt?.trim() || post.body.replace(/[#*_`>\[\]()]/g, " ").trim();
  return source.length > 200 ? `${source.slice(0, 199)}…` : source;
}

export async function notifyNewsPublished(
  post: Pick<INewsPost, "_id" | "title" | "type" | "excerpt" | "body">
): Promise<NotifyResult> {
  await connectDB();

  const optInFilter = {
    $or: [
      { "preferences.notifications.browser": true },
      { "preferences.notifications.browser": { $exists: false } },
    ],
  };

  const message = buildExcerpt(post);
  const cta = buildNotificationCta(post);
  const entityId = String(post._id);

  // Phase A: stream eligible users, insert Notifications in batches.
  // Accumulate IDs along the way so Phase B can filter PushSubscriptions
  // without a second User query.
  const userCursor = User.find(optInFilter).select("_id").lean().cursor();
  const eligibleUserIds = new Set<string>();

  let buffer: {
    userId: unknown;
    title: string;
    message: string;
    type: string;
    cta: typeof cta;
    category: string;
    entityType: string;
    entityId: string;
  }[] = [];
  let notificationsCreated = 0;

  const flush = async () => {
    if (buffer.length === 0) return;
    try {
      const inserted = await Notification.insertMany(buffer, { ordered: false });
      notificationsCreated += inserted.length;
    } catch (err) {
      const bwe = err as {
        insertedDocs?: unknown[];
        writeErrors?: unknown[];
      };
      notificationsCreated += bwe.insertedDocs?.length ?? 0;
      console.error(
        "[notifyNewsPublished] partial insertMany failure:",
        bwe.writeErrors?.length ?? "unknown",
        "errors"
      );
    }
    buffer = [];
  };

  for await (const user of userCursor) {
    eligibleUserIds.add(String(user._id));
    buffer.push({
      userId: user._id,
      title: post.title,
      message,
      type: "info",
      cta,
      category: "news",
      entityType: "news_post",
      entityId,
    });
    if (buffer.length >= BATCH_SIZE) {
      await flush();
    }
  }
  await flush();

  // Phase B: query only the subscriptions belonging to eligible users.
  if (eligibleUserIds.size === 0) {
    return {
      notificationsCreated,
      pushAttempted: 0,
      pushSucceeded: 0,
      pushRemoved: 0,
      pushFailed: 0,
    };
  }

  const subs = (await PushSubscription.find({
    userId: { $in: [...eligibleUserIds] },
  }).lean()) as unknown as IPushSubscription[];

  const pushResult = await sendPushToSubscriptions(subs, {
    title: post.title,
    body: message,
    url: BROADCAST_URL,
    tag: `news:${entityId}`,
  });

  return {
    notificationsCreated,
    pushAttempted: pushResult.attempted,
    pushSucceeded: pushResult.succeeded,
    pushRemoved: pushResult.removed,
    pushFailed: pushResult.failed,
  };
}
