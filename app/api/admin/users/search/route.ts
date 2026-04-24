import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";

function isAdmin(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

/**
 * Leichtgewichtiger User-Lookup für Admin-Autocomplete (z.B. Achievement-
 * Manual-Grant). Sucht in username/name/email und liefert maximal 10 Treffer.
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
    if (q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    const users = await User.find({
      $or: [
        { username: { $regex: regex } },
        { name: { $regex: regex } },
        { email: { $regex: regex } },
      ],
    })
      .select("_id username name email image level")
      .limit(10)
      .lean();

    return NextResponse.json({
      users: users.map((u) => ({
        _id: u._id.toString(),
        username: u.username ?? null,
        name: u.name ?? null,
        email: u.email ?? null,
        image: u.image ?? null,
        level: typeof u.level === "number" ? u.level : 1,
      })),
    });
  } catch (err) {
    console.error("[admin/users/search GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
