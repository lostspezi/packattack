import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSets } from "@/lib/justtcg";

export async function GET(request: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || !["admin", "super_admin", "shop"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const game = request.nextUrl.searchParams.get("game");

  if (!game) {
    return NextResponse.json(
      { error: "Missing required query parameter: game" },
      { status: 400 }
    );
  }

  try {
    const sets = await getSets(game);

    if (sets === null) {
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }

    return NextResponse.json({ sets });
  } catch (err) {
    console.error("[justtcg/sets GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
