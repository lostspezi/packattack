import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRarities } from "@/lib/justtcg";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const game = searchParams.get("game");

  if (!game) {
    return NextResponse.json({ error: "game parameter required" }, { status: 400 });
  }

  try {
    const rarities = await getRarities(game);

    if (rarities === null) {
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }

    return NextResponse.json({ rarities });
  } catch (err) {
    console.error("[justtcg/rarities GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
