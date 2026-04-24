import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import PushSubscription from "@/models/push-subscription";

interface SubscribeBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  userAgent?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as SubscribeBody;
    const endpoint = body.endpoint;
    const p256dh = body.keys?.p256dh;
    const authKey = body.keys?.auth;

    if (!endpoint || !p256dh || !authKey) {
      return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
    }

    await connectDB();

    // Owner is set on insert only — once a subscription exists, its userId
    // cannot be reassigned by another authenticated user posting the same endpoint.
    const updated = await PushSubscription.findOneAndUpdate(
      { endpoint, userId: session.user.id },
      {
        $set: {
          endpoint,
          keys: { p256dh, auth: authKey },
          userAgent: body.userAgent ?? "",
        },
        $setOnInsert: { userId: session.user.id },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).catch((err: unknown) => {
      // Duplicate key on endpoint while owned by someone else: refuse.
      if ((err as { code?: number })?.code === 11000) return null;
      throw err;
    });

    if (!updated) {
      return NextResponse.json({ error: "endpoint_owned" }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[push/subscribe POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get("endpoint");
    if (!endpoint) {
      return NextResponse.json({ error: "endpoint_required" }, { status: 400 });
    }

    await connectDB();
    await PushSubscription.deleteOne({
      endpoint,
      userId: session.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[push/subscribe DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
