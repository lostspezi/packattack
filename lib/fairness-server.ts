/**
 * Server-only fairness helpers. Import these from API routes — never from
 * client components, since FairnessSeed.serverSeed leaks through some
 * helpers here by design.
 *
 * Split from `lib/fairness.ts` because the crypto primitives there are
 * isomorphic (shared byte-for-byte with the browser verifier), while these
 * helpers touch Mongoose and must stay server-side.
 */

import { Types } from "mongoose";
import FairnessSeed, { type IFairnessSeed } from "@/models/fairness-seed";
import User, { type IUser } from "@/models/user";
import { randomHex, sha256Hex } from "@/lib/fairness";

/**
 * Ensure the user has a client-seed. Called during pack-open auto-init.
 * Returns the seed value (new or existing).
 */
export async function ensureClientSeed(userId: Types.ObjectId | string): Promise<string> {
  const existing = await User.findById(userId).select("fairnessClientSeed").lean<Pick<IUser, "fairnessClientSeed">>();
  if (existing?.fairnessClientSeed) return existing.fairnessClientSeed;

  const seed = randomHex(16);
  // Matches both `fairnessClientSeed: null` and missing-field docs — see
  // MongoDB equality semantics for null.
  await User.updateOne(
    { _id: userId, fairnessClientSeed: null },
    { $set: { fairnessClientSeed: seed, fairnessInitializedAt: new Date() } },
  );
  // Reload in case a concurrent request beat us — the winner's seed is what
  // the user effectively "has".
  const reloaded = await User.findById(userId).select("fairnessClientSeed").lean<Pick<IUser, "fairnessClientSeed">>();
  return reloaded?.fairnessClientSeed ?? seed;
}

export interface ReservedNonce {
  seed: IFairnessSeed;
  nonceStart: number;
}

/**
 * Atomically reserve a contiguous range of `count` nonces on the user's
 * active seed. If no active seed exists, create one (races are resolved via
 * the partial unique index on `{ userId, status: "active" }`).
 *
 * The returned seed includes the plain serverSeed — caller must not leak it.
 */
export async function reserveNonces(
  userId: Types.ObjectId | string,
  count: number,
): Promise<ReservedNonce> {
  if (count <= 0 || !Number.isInteger(count)) {
    throw new Error(`reserveNonces: invalid count ${count}`);
  }

  // Try to advance the existing active seed. returnDocument: "before" gives
  // us the pre-increment nonce, which becomes our reserved nonceStart.
  const prev = await FairnessSeed.findOneAndUpdate(
    { userId, status: "active" },
    { $inc: { nonce: count } },
    { returnDocument: "before" },
  )
    .select("+serverSeed")
    .exec();

  if (prev) {
    return { seed: prev, nonceStart: prev.nonce };
  }

  // No active seed — mint one. Pre-set nonce to `count` so this request owns
  // the [0, count) range without a second round-trip.
  const serverSeed = randomHex(32);
  const serverSeedHash = await sha256Hex(serverSeed);

  try {
    const created = await FairnessSeed.create({
      userId,
      serverSeed,
      serverSeedHash,
      status: "active",
      nonce: count,
      activatedAt: new Date(),
    });
    // FairnessSeed.create() doesn't re-run the select:false hiding, so
    // created.serverSeed is already populated in memory. Return it directly
    // to avoid an extra round-trip.
    return { seed: created, nonceStart: 0 };
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    // Race: another request won the create. Retry the inc.
    const retry = await FairnessSeed.findOneAndUpdate(
      { userId, status: "active" },
      { $inc: { nonce: count } },
      { returnDocument: "before" },
    )
      .select("+serverSeed")
      .exec();
    if (!retry) {
      throw new Error("Fairness seed race unresolved — no active seed after duplicate-key retry");
    }
    return { seed: retry, nonceStart: retry.nonce };
  }
}
