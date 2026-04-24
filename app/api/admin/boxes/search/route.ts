import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import Box from "@/models/box";

function isAdmin(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

/**
 * Admin-Autocomplete für Box-Auswahl in Achievement-Rewards. Liefert
 * standardmäßig nur Boxen mit `isAchievementBox: true`, damit der Reward
 * `unlock_box` keine regulären Storefront-Boxen freischaltet.
 *
 * `?achievementOnly=false` gibt alle Boxen zurück (z.B. für andere Admin-
 * Workflows). Default ist die strikte Variante.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const me = await User.findById(session.user.id).select("role").lean<{ role?: string } | null>();
    if (!me || !isAdmin(me.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const achievementOnly = searchParams.get("achievementOnly") !== "false";

    const filter: Record<string, unknown> = {};
    if (achievementOnly) filter.isAchievementBox = true;
    if (q.length >= 2) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [
        { slug: { $regex: regex } },
        { "name.de": { $regex: regex } },
        { "name.en": { $regex: regex } },
      ];
    }

    const boxes = await Box.find(filter)
      .select("_id slug name image status isAchievementBox")
      .sort({ "name.de": 1 })
      .limit(20)
      .lean();

    return NextResponse.json({
      boxes: boxes.map((b) => ({
        _id: b._id.toString(),
        slug: b.slug,
        name: b.name,
        image: b.image ?? null,
        status: b.status,
        isAchievementBox: Boolean(b.isAchievementBox),
      })),
    });
  } catch (err) {
    console.error("[admin/boxes/search GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
