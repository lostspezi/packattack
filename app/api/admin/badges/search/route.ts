import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Badge from "@/models/badge";
import User from "@/models/user";

function isAdmin(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

/**
 * Admin-Autocomplete für Badge-Auswahl in Achievement-Rewards.
 * Liefert nur active=true Badges. Optionaler `q` für Substring-Suche
 * gegen key/slug/label.
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

    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    const filter: Record<string, unknown> = { active: true };
    if (q.length >= 2) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [
        { key: { $regex: regex } },
        { slug: { $regex: regex } },
        { label: { $regex: regex } },
      ];
    }

    const badges = await Badge.find(filter)
      .select("_id key slug label iconUrl tone")
      .sort({ sortOrder: 1, label: 1 })
      .limit(20)
      .lean();

    return NextResponse.json({
      badges: badges.map((b) => ({
        _id: b._id.toString(),
        key: b.key,
        slug: b.slug,
        label: b.label,
        iconUrl: b.iconUrl ?? null,
        tone: b.tone ?? "neutral",
      })),
    });
  } catch (err) {
    console.error("[admin/badges/search GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
