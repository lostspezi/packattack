import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getChatOnlineUsers } from "@/lib/chat";
import connectDB from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const payload = await getChatOnlineUsers();
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[chat online GET]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
