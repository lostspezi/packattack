import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveBadgeDefinitions } from "@/lib/badges";
import connectDB from "@/lib/db";

function isAdminRole(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;

  if (!session?.user || !isAdminRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    return NextResponse.json({ badges: await getActiveBadgeDefinitions() });
  } catch (error) {
    console.error("[admin badges GET]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
