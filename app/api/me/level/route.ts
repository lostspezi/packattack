import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import {
  isLevelMilestone,
  levelForTotalXp,
  MAX_LEVEL,
  progressInLevel,
  xpForLevelUp,
  xpIntoLevel,
  xpToNextLevel,
} from "@/lib/level/config";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const user = await User.findById(userId)
      .select("level xp lastXpGainAt stats.counters stats.loginStreak")
      .lean<{
        level?: number;
        xp?: number;
        lastXpGainAt?: Date | null;
        stats?: {
          counters?: Record<string, number>;
          loginStreak?: { current?: number; best?: number };
        };
      } | null>();
    if (!user) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const xp = user.xp ?? 0;
    const computedLevel = levelForTotalXp(xp);
    const level = Math.max(user.level ?? 1, computedLevel);

    return NextResponse.json({
      level,
      maxLevel: MAX_LEVEL,
      xp,
      xpIntoLevel: xpIntoLevel(xp),
      xpForLevelUp: level >= MAX_LEVEL ? 0 : xpForLevelUp(level),
      xpToNextLevel: xpToNextLevel(xp),
      progress: progressInLevel(xp),
      isMilestone: isLevelMilestone(level),
      lastXpGainAt: user.lastXpGainAt ?? null,
      counters: user.stats?.counters ?? {},
      loginStreak: user.stats?.loginStreak ?? { current: 0, best: 0 },
    });
  } catch (err) {
    console.error("[me/level GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
