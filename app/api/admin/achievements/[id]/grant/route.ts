import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { grantAchievementManually } from "@/lib/achievements/engine";
import { checkAdminGrantRate } from "@/lib/admin/grant-rate-limit";

function isAdmin(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const user = await User.findById(session.user.id).select("role").lean<{ role?: string } | null>();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id: achievementId } = await params;
    if (!Types.ObjectId.isValid(achievementId)) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }

    const rate = await checkAdminGrantRate(session.user.id);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: "rate_limited",
          limit: rate.limit,
          retryAfterSeconds: rate.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        },
      );
    }

    const body = (await req.json()) as { userId?: string; note?: string };
    const targetUserId = String(body?.userId ?? "").trim();
    if (!Types.ObjectId.isValid(targetUserId)) {
      return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
    }
    const note = typeof body?.note === "string" ? body.note.slice(0, 300) : null;

    const outcome = await grantAchievementManually(
      targetUserId,
      achievementId,
      session.user.id,
      note,
    );
    if (!outcome) {
      return NextResponse.json({ error: "grant_failed" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      achievementKey: outcome.achievementKey,
      wasNewUnlock: outcome.wasNewUnlock,
    });
  } catch (err) {
    console.error("[admin/achievements/[id]/grant POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
