import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { changeEmailSchema, changePasswordSchema } from "@/lib/validations";
import { generateVerificationToken } from "@/lib/tokens";
import { sendTemplateEmail } from "@/lib/mail";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { type } = body as { type?: string };

    await connectDB();

    const user = await User.findById(session.user.id).select("+password").lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (type === "email") {
      const parsed = changeEmailSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid input", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const { newEmail, password } = parsed.data;

      // Verify current password
      if (!user.password) {
        return NextResponse.json(
          { error: "no_password" },
          { status: 400 }
        );
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return NextResponse.json(
          { error: "invalid_password" },
          { status: 400 }
        );
      }

      // Check email uniqueness
      const existingEmail = await User.findOne({
        email: newEmail,
        _id: { $ne: session.user.id },
      }).lean();
      if (existingEmail) {
        return NextResponse.json({ error: "email_taken" }, { status: 409 });
      }

      await User.findByIdAndUpdate(session.user.id, {
        email: newEmail,
        emailVerified: null,
      });

      // Send verification email
      const lang = (session.user as { language?: string }).language ?? "en";
      try {
        const token = await generateVerificationToken(session.user.id, "email_verify");
        const verifyUrl = `${APP_URL}/${lang}/verify-email?token=${token}`;
        await sendTemplateEmail(newEmail, "verify-email", lang as "de" | "en", {
          name: user.name,
          verifyUrl,
        });
      } catch {
        // Non-fatal
      }

      return NextResponse.json({ success: true });
    }

    if (type === "password") {
      const parsed = changePasswordSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid input", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const { currentPassword, newPassword } = parsed.data;

      if (!user.password) {
        return NextResponse.json({ error: "no_password" }, { status: 400 });
      }

      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        return NextResponse.json({ error: "invalid_password" }, { status: 400 });
      }

      const hashed = await bcrypt.hash(newPassword, 12);
      await User.findByIdAndUpdate(session.user.id, { password: hashed });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  } catch (err) {
    console.error("[account PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { confirmText } = body as { confirmText?: string };

    if (confirmText !== "DELETE") {
      return NextResponse.json({ error: "confirmation_required" }, { status: 400 });
    }

    await connectDB();

    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();
    const db = client.db();

    const userId = session.user.id;

    // Delete accounts, sessions, notifications — keep consent_log
    await Promise.all([
      db.collection("accounts").deleteMany({ userId }),
      db.collection("sessions").deleteMany({ userId }),
      db.collection("notifications").deleteMany({ userId }),
      db.collection("verificationtokens").deleteMany({ userId }),
    ]);

    await User.findByIdAndDelete(userId);

    await client.close();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[account DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
