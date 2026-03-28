import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildAdminUserBadgesResponse } from "@/lib/badges";
import connectDB from "@/lib/db";
import User from "@/models/user";

function isAdminRole(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;

  if (!session?.user || !isAdminRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    const { id } = await params;
    const user = await User.findById(id).select("_id name username email badges").lean();

    if (!user) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    return NextResponse.json(
      await buildAdminUserBadgesResponse({
        user,
      })
    );
  } catch (error) {
    console.error("[admin users badges GET]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
