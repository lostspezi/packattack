import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGames } from "@/lib/justtcg";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || !["admin", "super_admin", "shop"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const games = await getGames();

    if (games === null) {
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }

    return NextResponse.json({ games });
  } catch (err) {
    console.error("[justtcg/games GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
