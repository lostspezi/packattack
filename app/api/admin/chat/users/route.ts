import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchModeratedUsers } from "@/lib/chat";
import connectDB from "@/lib/db";
import { isChatStaff } from "@/lib/chat-constants";
import { adminChatUserSearchSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  const userRole = session?.user?.role ?? null;
  if (!userId || !isChatStaff(userRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = adminChatUserSearchSchema.safeParse({
    q: url.searchParams.get("q") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    return NextResponse.json(await fetchModeratedUsers(parsed.data.q));
  } catch (error) {
    console.error("[admin chat users GET]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
