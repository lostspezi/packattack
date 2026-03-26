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

    // Set a short-lived cookie so proxy.ts skips the emailVerified check on the next request.
    // The JWT won't have the updated value yet, but the proxy will let the user through.
    // On the next JWT refresh cycle, emailVerified will be read from DB correctly.
    const response = NextResponse.json({ success: true });
    response.cookies.set("email-just-verified", "1", {
      maxAge: 60, // 60 seconds — enough time for the redirect + JWT refresh
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
    return response;
  } catch (err) {
    console.error("[verify-email]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
