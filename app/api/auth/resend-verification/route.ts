import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { generateVerificationToken } from "@/lib/tokens";
import { sendTemplateEmail } from "@/lib/mail";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const lang = (body.lang as string) || session.user.language || "en";

    await connectDB();

    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: "already_verified" }, { status: 400 });
    }

    const token = await generateVerificationToken(user._id.toString(), "email_verify");
    const verifyUrl = `${APP_URL}/${lang}/verify-email?token=${token}`;

    await sendTemplateEmail(user.email, "verify-email", lang as "de" | "en", {
      name: user.name,
      verifyUrl,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[resend-verification]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
