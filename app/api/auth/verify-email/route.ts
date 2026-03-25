import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { verifyToken } from "@/lib/tokens";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body as { token?: string };

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "missing_token" }, { status: 400 });
    }

    await connectDB();

    const userId = await verifyToken(token, "email_verify");
    if (!userId) {
      return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 400 });
    }

    await User.findByIdAndUpdate(userId, { emailVerified: new Date() });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[verify-email]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
