import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchCards } from "@/lib/justtcg";

export async function GET(request: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || !["admin", "super_admin", "shop"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;

  const params = {
    game: searchParams.get("game") ?? undefined,
    set: searchParams.get("set") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    page: searchParams.has("page")
      ? Number(searchParams.get("page"))
      : undefined,
    limit: searchParams.has("limit")
      ? Number(searchParams.get("limit"))
      : undefined,
  };

  try {
    const result = await searchCards(params);

    if (result === null) {
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[justtcg/cards GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
