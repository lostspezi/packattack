import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import FairnessSeed from "@/models/fairness-seed";

/**
 * Full fairness state for the settings/manage page: current client seed,
 * active server seed hash + nonce, and the history of revealed seeds with
 * their activation windows.
 *
 * Never exposes plain server seed values — revealed seeds are fine to show
 * elsewhere (commitment endpoint handles that), but this bird's-eye view
 * only needs hashes.
 */
export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const [user, seeds] = await Promise.all([
      User.findById(userId)
        .select("fairnessClientSeed fairnessInitializedAt")
        .lean(),
      FairnessSeed.find({ userId })
        .select("_id status serverSeedHash nonce activatedAt revealedAt replacedBySeedId")
        .sort({ activatedAt: -1 })
        .lean(),
    ]);

    if (!user) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    const active = seeds.find((s) => s.status === "active") ?? null;
    const revealed = seeds.filter((s) => s.status === "revealed");

    return NextResponse.json({
      clientSeed: user.fairnessClientSeed ?? null,
      initializedAt: user.fairnessInitializedAt ?? null,
      activeSeed: active
        ? {
            id: active._id.toString(),
            serverSeedHash: active.serverSeedHash,
            nonce: active.nonce,
            activatedAt: active.activatedAt,
          }
        : null,
      revealedSeeds: revealed.map((s) => ({
        id: s._id.toString(),
        serverSeedHash: s.serverSeedHash,
        nonce: s.nonce,
        activatedAt: s.activatedAt,
        revealedAt: s.revealedAt,
        replacedBySeedId: s.replacedBySeedId?.toString() ?? null,
      })),
    });
  } catch (err) {
    console.error("[fairness/state GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
