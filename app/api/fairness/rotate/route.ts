import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import FairnessSeed from "@/models/fairness-seed";
import PackOpenSession from "@/models/pack-open-session";
import { randomHex, sha256Hex } from "@/lib/fairness";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Rotate the user's active server seed. The current active seed is flipped
 * to "revealed" (its serverSeed is returned so the user can verify past
 * pulls), and a fresh seed is minted with nonce=0 as the new active seed.
 *
 * Blocked while a PackOpenSession is pending so a rotation can't collide
 * with an in-flight draw's nonce reservation.
 */
export async function POST() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Rotate is a user-initiated rare action. Cap at 10/hour per user so
    // a hostile session can't bloat the user's seed chain or audit log.
    const rl = await checkRateLimit({
      bucket: `fairness:rotate:${userId}`,
      limit: 10,
      windowSeconds: 3600,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "rate_limited", retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429, headers: { "retry-after": String(rl.retryAfterSeconds) } },
      );
    }

    await connectDB();

    const pending = await PackOpenSession.findOne({ userId }).select("_id").lean();
    if (pending) {
      return NextResponse.json(
        {
          error: "FAIRNESS_ROTATE_LOCKED",
          message: "Rotate blocked: pending pack-open session.",
        },
        { status: 409 },
      );
    }

    // Flip the currently active seed to revealed. select("+serverSeed") so
    // we can return the plain seed to the user for historical verification.
    const now = new Date();
    const oldSeed = await FairnessSeed.findOneAndUpdate(
      { userId, status: "active" },
      { $set: { status: "revealed", revealedAt: now } },
      { returnDocument: "after" },
    )
      .select("+serverSeed")
      .exec();

    if (!oldSeed) {
      // No active seed yet — just mint one. This happens if the user hits
      // rotate before they've opened any pack (auto-init never ran).
      const serverSeed = randomHex(32);
      const serverSeedHash = await sha256Hex(serverSeed);
      const created = await FairnessSeed.create({
        userId,
        serverSeed,
        serverSeedHash,
        status: "active",
        nonce: 0,
        activatedAt: now,
      });
      return NextResponse.json({
        revealedServerSeed: null,
        newServerSeedHash: created.serverSeedHash,
        activatedAt: created.activatedAt,
      });
    }

    // Mint the replacement. Two documented race outcomes:
    //   (a) A concurrent pack-open auto-init saw our flipped (revealed) seed
    //       and created its own fresh active seed. Our create then hits
    //       E11000, we adopt the existing active as the replacement — the
    //       chain oldSeed → adoptedSeed is still a truthful rotation record
    //       because adoptedSeed IS the seed now governing the user's rolls.
    //   (b) Two simultaneous rotate requests: only one `findOneAndUpdate`
    //       returns the active seed (the other returns null and falls into
    //       the "no active seed" branch). The winner creates, the loser
    //       mints a second seed that wins E11000 — the loser's response
    //       mislabels `revealedServerSeed: null`, which is cosmetic rather
    //       than corrupting. Rate-limit the endpoint when we touch UI.
    const serverSeed = randomHex(32);
    const serverSeedHash = await sha256Hex(serverSeed);

    let newSeed;
    try {
      newSeed = await FairnessSeed.create({
        userId,
        serverSeed,
        serverSeedHash,
        status: "active",
        nonce: 0,
        activatedAt: now,
      });
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
      newSeed = await FairnessSeed.findOne({ userId, status: "active" }).exec();
      if (!newSeed) {
        throw new Error("Rotate race unresolved — no active seed after E11000");
      }
    }

    await FairnessSeed.updateOne(
      { _id: oldSeed._id },
      { $set: { replacedBySeedId: newSeed._id } },
    );

    return NextResponse.json({
      revealedServerSeed: oldSeed.serverSeed,
      revealedServerSeedHash: oldSeed.serverSeedHash,
      newServerSeedHash: newSeed.serverSeedHash,
      activatedAt: newSeed.activatedAt,
    });
  } catch (err) {
    console.error("[fairness/rotate POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
