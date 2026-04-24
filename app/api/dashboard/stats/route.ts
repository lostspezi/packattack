import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDashboardStats } from "@/lib/dashboard/stats";
import { getHeroAction } from "@/lib/dashboard/hero-action";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [stats, hero] = await Promise.all([
      getDashboardStats(session.user.id),
      getHeroAction(session.user.id),
    ]);
    return NextResponse.json({ stats, hero });
  } catch (err) {
    console.error("[api/dashboard/stats]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
