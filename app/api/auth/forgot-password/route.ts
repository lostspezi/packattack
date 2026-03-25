import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { forgotPasswordSchema } from "@/lib/validations";
import { generateVerificationToken } from "@/lib/tokens";
import { sendTemplateEmail } from "@/lib/mail";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      // Still return success to not leak whether email exists
      return NextResponse.json({ success: true });
    }

    const { email } = parsed.data;
    const lang = (body.lang as string) || "en";

    await connectDB();

    const user = await User.findOne({ email }).select("+password");

    // Only send reset email for credentials users (those with a password)
    if (user && user.password) {
      const token = await generateVerificationToken(user._id.toString(), "pwd_reset");
      const resetUrl = `${APP_URL}/${lang}/reset-password?token=${token}`;

      try {
        await sendTemplateEmail(email, "reset-password", lang as "de" | "en", {
          name: user.name,
          resetUrl,
        });
      } catch {
        // Non-fatal
      }
    }

    // Always return success — never reveal whether an account exists
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
