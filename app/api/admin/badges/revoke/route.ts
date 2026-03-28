import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  buildAdminUserBadgesResponse,
  revokeBadgeFromUser,
} from "@/lib/badges";
import connectDB from "@/lib/db";
import { adminBadgeRevokeSchema } from "@/lib/validations";
import User from "@/models/user";

function isAdminRole(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;

  if (!session?.user || !isAdminRole(sessionUser?.role ?? null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = adminBadgeRevokeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const user = await User.findById(parsed.data.userId)
      .select("_id name username email badges")
      .lean();

    if (!user) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    const badge = await revokeBadgeFromUser({
      userId: parsed.data.userId,
      badgeKey: parsed.data.badgeKey,
      revokedByUserId: sessionUser?.id ?? null,
      revokeReason: parsed.data.revokeReason ?? null,
    });

    if (!badge) {
      return NextResponse.json({ error: "badge_not_found" }, { status: 404 });
    }

    return NextResponse.json(
      await buildAdminUserBadgesResponse({
        user,
      })
    );
  } catch (error) {
    console.error("[admin badges revoke POST]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
