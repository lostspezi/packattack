import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { buildChatAdminOverview } from "@/lib/chat";
import { isChatStaff } from "@/lib/chat-constants";
import User from "@/models/user";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  const userRole = session?.user?.role ?? null;
  if (!userId || !isChatStaff(userRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const user = await User.findById(userId).lean();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(await buildChatAdminOverview(user as never));
  } catch (error) {
    console.error("[admin chat GET]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
