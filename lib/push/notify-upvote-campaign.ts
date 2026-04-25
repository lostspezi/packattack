import connectDB from "@/lib/db";
import Notification from "@/models/notification";
import PushSubscription, {
  type IPushSubscription,
} from "@/models/push-subscription";
import User from "@/models/user";
import type { IUpvoteCampaign } from "@/models/upvote-campaign";
import { sendPushToSubscriptions } from "@/lib/push/web-push";

const BATCH_SIZE = 500;

interface NotifyResult {
  notificationsCreated: number;
  pushAttempted: number;
  pushSucceeded: number;
  pushRemoved: number;
  pushFailed: number;
}

function pickGerman(value: { de?: string; en?: string } | undefined | null): string {
  return (value?.de ?? value?.en ?? "").trim();
}

function buildBody(question: string): string {
  if (!question) return "Stimme jetzt mit ab.";
  return question.length > 200 ? `${question.slice(0, 199)}…` : question;
}

/**
 * Wird beim Übergang draft -> active aufgerufen. Erzeugt eine DB-Notification
 * für jeden eligiblen User (Push-Opt-In default true) und sendet parallel
 * einen Web-Push an alle deren Subscriptions. Verlinkt direkt auf die
 * Voting-Detail-Page.
 */
export async function notifyUpvoteCampaignActivated(
  campaign: Pick<IUpvoteCampaign, "_id" | "title" | "question">
): Promise<NotifyResult> {
  await connectDB();

  const optInFilter = {
    $or: [
      { "preferences.notifications.browser": true },
      { "preferences.notifications.browser": { $exists: false } },
    ],
  };

  const title = pickGerman(campaign.title) || "Neue Abstimmung";
  const message = buildBody(pickGerman(campaign.question));
  const entityId = String(campaign._id);
  const url = `/votes/${entityId}`;
  const cta = { label: "Jetzt abstimmen", url };

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
      const bwe = err as { insertedDocs?: unknown[]; writeErrors?: unknown[] };
      notificationsCreated += bwe.insertedDocs?.length ?? 0;
      console.error(
        "[notifyUpvoteCampaignActivated] partial insertMany failure:",
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
      title,
      message,
      type: "info",
      cta,
      category: "votes",
      entityType: "upvote_campaign",
      entityId,
    });
    if (buffer.length >= BATCH_SIZE) await flush();
  }
  await flush();

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
    title,
    body: message,
    url,
    tag: `upvote-campaign:${entityId}`,
  });

  return {
    notificationsCreated,
    pushAttempted: pushResult.attempted,
    pushSucceeded: pushResult.succeeded,
    pushRemoved: pushResult.removed,
    pushFailed: pushResult.failed,
  };
}
