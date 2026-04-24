import webpush from "web-push";
import connectDB from "@/lib/db";
import PushSubscription, { type IPushSubscription } from "@/models/push-subscription";

let _configured = false;
let _disabled = false;

function configure(): boolean {
  if (_configured) return true;
  if (_disabled) return false;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:no-reply@packattack.gg";

  if (!publicKey || !privateKey) {
    _disabled = true;
    if (process.env.NODE_ENV !== "test") {
      console.warn("[web-push] VAPID keys not set — Web Push is disabled");
    }
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  _configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

interface SendResult {
  attempted: number;
  succeeded: number;
  removed: number;
  failed: number;
}

async function sendToSubscriptions(
  subs: IPushSubscription[],
  payload: PushPayload
): Promise<SendResult> {
  if (!configure() || subs.length === 0) {
    return { attempted: subs.length, succeeded: 0, removed: 0, failed: 0 };
  }

  const json = JSON.stringify(payload);
  const staleEndpoints: string[] = [];
  let succeeded = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          json
        );
        succeeded += 1;
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          staleEndpoints.push(sub.endpoint);
        } else {
          failed += 1;
          console.warn("[web-push] send failed:", status, (err as Error)?.message);
        }
      }
    })
  );

  if (staleEndpoints.length > 0) {
    await PushSubscription.deleteMany({
      endpoint: { $in: staleEndpoints },
    });
  }

  return {
    attempted: subs.length,
    succeeded,
    removed: staleEndpoints.length,
    failed,
  };
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<SendResult> {
  await connectDB();
  const subs = await PushSubscription.find({ userId }).lean();
  return sendToSubscriptions(subs as unknown as IPushSubscription[], payload);
}

export async function sendPushBroadcast(payload: PushPayload): Promise<SendResult> {
  await connectDB();
  const subs = await PushSubscription.find().lean();
  return sendToSubscriptions(subs as unknown as IPushSubscription[], payload);
}

export function isPushConfigured(): boolean {
  return configure();
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}
