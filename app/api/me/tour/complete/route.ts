import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import CoinTransaction from "@/models/coin-transaction";
import { TOUR_REWARD_COINS } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Finalizes the onboarding tour and — on the first-ever completion —
 * grants the one-time coin reward. Idempotent: calling twice does not
 * double-grant. The gate is the `tour.rewardGrantedAt` timestamp, set via
 * a conditional update so two concurrent calls can't both succeed.
 *
 * Response shape:
 *   { reward: 0 | TOUR_REWARD_COINS, coins: number, tour: TourState }
 */
export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  try {
    await connectDB();

    // Atomic grant: only update if rewardGrantedAt is still null.
    const now = new Date();
    const granted = await User.findOneAndUpdate(
      {
        _id: userId,
        "tour.rewardGrantedAt": null,
      },
      {
        $set: {
          "tour.completed": true,
          "tour.rewardGrantedAt": now,
          "tour.skippedAt": null,
        },
        $inc: { coins: TOUR_REWARD_COINS },
      },
      { new: true, select: "coins tour" },
    ).lean();

    if (granted) {
      // First-time completion: write the ledger entry alongside the grant.
      try {
        await CoinTransaction.create({
          userId: new Types.ObjectId(userId),
          amount: TOUR_REWARD_COINS,
          type: "tour_reward",
          reason: "Onboarding tour completion reward",
        });
      } catch (ledgerErr) {
        // The coin grant already landed — losing the ledger row is bad
        // but not worth rolling back. Log loudly and move on.
        console.error("[me/tour/complete ledger]", ledgerErr);
      }

      // Achievement-Once-Event: idempotent, egal ob bereits gefeuert.
      try {
        const { fireOnceEvent } = await import("@/lib/level/grant-xp");
        await fireOnceEvent(userId, "tour_completed");
      } catch (achievementErr) {
        console.error("[me/tour/complete achievement]", achievementErr);
      }

      return NextResponse.json({
        reward: TOUR_REWARD_COINS,
        coins: granted.coins ?? 0,
        tour: serializeTour(granted.tour),
      });
    }

    // Already granted before. Still make sure completed=true for replays.
    const replay = await User.findByIdAndUpdate(
      userId,
      { $set: { "tour.completed": true, "tour.skippedAt": null } },
      { new: true, select: "coins tour" },
    ).lean();

    if (!replay) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      reward: 0,
      coins: replay.coins ?? 0,
      tour: serializeTour(replay.tour),
    });
  } catch (err) {
    console.error("[me/tour/complete POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

function serializeTour(tour: {
  completed?: boolean;
  skippedAt?: Date | null;
  completedSteps?: string[];
  lastPromptAt?: Date | null;
  sessionCountSincePrompt?: number;
  rewardGrantedAt?: Date | null;
} | null | undefined) {
  return {
    completed: tour?.completed ?? false,
    skippedAt: tour?.skippedAt ? new Date(tour.skippedAt).toISOString() : null,
    completedSteps: Array.isArray(tour?.completedSteps)
      ? [...tour.completedSteps]
      : [],
    lastPromptAt: tour?.lastPromptAt
      ? new Date(tour.lastPromptAt).toISOString()
      : null,
    sessionCountSincePrompt: tour?.sessionCountSincePrompt ?? 0,
    rewardGrantedAt: tour?.rewardGrantedAt
      ? new Date(tour.rewardGrantedAt).toISOString()
      : null,
  };
}
