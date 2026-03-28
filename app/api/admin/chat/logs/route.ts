import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchActionLog, ensureGlobalChatRoom } from "@/lib/chat";
import connectDB from "@/lib/db";
import { isChatStaff } from "@/lib/chat-constants";
import { adminChatLogsQuerySchema } from "@/lib/validations";

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
  const parsed = adminChatLogsQuerySchema.safeParse({
    page: parseNumber(url.searchParams.get("page")),
    limit: parseNumber(url.searchParams.get("limit")),
    target: url.searchParams.get("target") ?? undefined,
    actor: url.searchParams.get("actor") ?? undefined,
    actionType: url.searchParams.get("actionType") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const room = await ensureGlobalChatRoom();
    return NextResponse.json(
      await fetchActionLog({
        roomId: room._id,
        ...parsed.data,
        from: parsed.data.from ? new Date(parsed.data.from) : undefined,
        to: parsed.data.to ? new Date(parsed.data.to) : undefined,
        restrictionOnly: true,
      })
    );
  } catch (error) {
    console.error("[admin chat logs GET]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
