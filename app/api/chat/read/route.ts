import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { ensureGlobalChatRoom, ensureChatReadState, serializeChatReadState, touchChatReadState } from "@/lib/chat";
import { chatReadStateSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = chatReadStateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await connectDB();
    const room = await ensureGlobalChatRoom();
    await ensureChatReadState(room._id, userId);
    const updated = await touchChatReadState(room._id, userId, parsed.data.lastReadVisibleSeq);
    if (!updated) {
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    return NextResponse.json({ readState: serializeChatReadState(updated) });
  } catch (error) {
    console.error("[chat read POST]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
