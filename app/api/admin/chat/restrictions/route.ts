import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchActiveRestrictions } from "@/lib/chat";
import connectDB from "@/lib/db";
import { adminChatRestrictionsQuerySchema } from "@/lib/validations";
import { isChatStaff } from "@/lib/chat-constants";

function parseNumber(value: string | null | undefined) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  const userRole = session?.user?.role ?? null;
  if (!userId || !isChatStaff(userRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = adminChatRestrictionsQuerySchema.safeParse({
    page: parseNumber(url.searchParams.get("page")),
    limit: parseNumber(url.searchParams.get("limit")),
    status: url.searchParams.get("status") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    return NextResponse.json(await fetchActiveRestrictions(parsed.data));
  } catch (error) {
    console.error("[admin chat restrictions GET]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
