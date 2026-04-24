import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Achievement from "@/models/achievement";
import UserAchievement from "@/models/user-achievement";
import Translation from "@/models/translation";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const [allActive, userRecords] = await Promise.all([
      Achievement.find({ active: true }).sort({ sortOrder: 1, createdAt: 1 }).lean(),
      UserAchievement.find({ userId }).lean(),
    ]);

    const byAchievement = new Map(
      userRecords.map((r) => [r.achievementId.toString(), r]),
    );

    // Translation-Inhalte in einer Runde holen.
    const keys = new Set<string>();
    for (const a of allActive) {
      keys.add(`${a.key}.title`);
      keys.add(`${a.key}.description`);
    }
    const translations = await Translation.find({
      namespace: "achievements",
      key: { $in: Array.from(keys) },
    }).lean();
    const translationMap = new Map<string, Record<string, string>>();
    for (const t of translations) {
      const raw = t.values instanceof Map ? Object.fromEntries(t.values) : (t.values ?? {});
      translationMap.set(t.key, raw as Record<string, string>);
    }

    const items = allActive
      .map((a) => {
        const ua = byAchievement.get(a._id.toString());
        const unlocked = ua?.completed === true;
        // Hidden-Achievements: nur anzeigen, wenn unlocked
        if (a.hidden && !unlocked) return null;
        return {
          _id: String(a._id),
          key: a.key,
          category: a.category,
          iconImageId: a.iconImageId ? String(a.iconImageId) : null,
          titles: translationMap.get(`${a.key}.title`) ?? {},
          descriptions: translationMap.get(`${a.key}.description`) ?? {},
          trigger: a.trigger,
          hasRewards: Array.isArray(a.rewards) && a.rewards.length > 0,
          unlocked,
          unlockedAt: ua?.unlockedAt ?? null,
          progress: ua?.progress ?? 0,
          target: ua?.target ?? null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return NextResponse.json({
      achievements: items,
      unlockedCount: items.filter((i) => i.unlocked).length,
      total: items.length,
    });
  } catch (err) {
    console.error("[me/achievements GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
