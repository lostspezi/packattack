import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/user";
import ConsentLog from "@/models/consent-log";
import PlatformSettings from "@/models/platform-settings";
import { registerSchema } from "@/lib/validations";
import { generateVerificationToken } from "@/lib/tokens";
import { sendTemplateEmail } from "@/lib/mail";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, username, email, password } = parsed.data;
    const lang = (body.lang as string) || "en";

    await connectDB();

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return NextResponse.json(
        { error: "email_taken" },
        { status: 409 }
      );
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return NextResponse.json(
        { error: "username_taken" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      username,
      email,
      password: hashedPassword,
      emailVerified: null,
      role: "user",
    });

    // Get platform settings for consent version
    const settings = await PlatformSettings.findOne().lean();
    const tosVersion = settings?.tosVersion ?? "";
    const privacyVersion = settings?.privacyVersion ?? "";
    const now = new Date();

    // Update user consents
    await User.findByIdAndUpdate(user._id, {
      "consents.tos": { accepted: true, version: tosVersion, acceptedAt: now },
      "consents.privacy": { accepted: true, version: privacyVersion, acceptedAt: now },
    });

    // Log consent
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    await ConsentLog.create([
      {
        userId: user._id,
        type: "tos",
        version: tosVersion,
        action: "accepted",
        ip,
        userAgent,
        createdAt: now,
      },
      {
        userId: user._id,
        type: "privacy",
        version: privacyVersion,
        action: "accepted",
        ip,
        userAgent,
        createdAt: now,
      },
    ]);

    // Generate verification token and send email
    const token = await generateVerificationToken(user._id.toString(), "email_verify");
    const verifyUrl = `${APP_URL}/${lang}/verify-email?token=${token}`;

    try {
      await sendTemplateEmail(email, "verify-email", lang as "de" | "en", {
        name,
        verifyUrl,
      });
    } catch {
      // Non-fatal: user is created, email can be resent
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
