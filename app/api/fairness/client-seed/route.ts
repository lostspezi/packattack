import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { CLIENT_SEED_PATTERN, isValidClientSeed } from "@/lib/fairness";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Set or change the user's client seed. Takes effect on the next draw; does
 * not invalidate committed pulls — past commitments have the clientSeed
 * value frozen at that point in time.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { clientSeed } = body as { clientSeed?: unknown };
  if (typeof clientSeed !== "string" || !isValidClientSeed(clientSeed)) {
    return NextResponse.json(
      {
        error: "invalid_client_seed",
        message: `Client-Seed muss ${CLIENT_SEED_PATTERN.toString()} matchen.`,
      },
      { status: 400 },
    );
  }

  try {
    // Per-user cap — a stuffed loop of seed flips would bloat the
    // updated-at audit without any legitimate use case.
    const rl = await checkRateLimit({
      bucket: `fairness:client-seed:${userId}`,
      limit: 10,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "rate_limited", retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429, headers: { "retry-after": String(rl.retryAfterSeconds) } },
      );
    }

    await connectDB();
    const res = await User.updateOne(
      { _id: userId },
      {
        $set: {
          fairnessClientSeed: clientSeed,
          fairnessInitializedAt: new Date(),
        },
      },
    );
    if (res.matchedCount === 0) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }
    return NextResponse.json({ clientSeed });
  } catch (err) {
    console.error("[fairness/client-seed POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
