import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActivitySnapshot } from "@/lib/dashboard/activity";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") ?? 20);
    const items = await getActivitySnapshot(session.user.id, {
      limit: Number.isFinite(limit) ? limit : 20,
    });
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[api/dashboard/activity]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
