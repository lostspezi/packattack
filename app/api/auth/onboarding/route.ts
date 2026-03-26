import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import ConsentLog from "@/models/consent-log";
import PlatformSettings from "@/models/platform-settings";
import { onboardingSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = onboardingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, username, email, password, dateOfBirth } = parsed.data;

    // Validate age >= 18
    const dob = new Date(dateOfBirth);
    const minAge = new Date();
    minAge.setFullYear(minAge.getFullYear() - 18);
    if (dob > minAge) {
      return NextResponse.json(
        { error: "age_requirement" },
        { status: 400 }
      );
    }

    await connectDB();

    // Check email uniqueness (excluding current user)
    const existingEmail = await User.findOne({ email, _id: { $ne: session.user.id } });
    if (existingEmail) {
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }

    // Check username uniqueness (excluding current user)
    const existingUsername = await User.findOne({ username, _id: { $ne: session.user.id } });
    if (existingUsername) {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }

    const settings = await PlatformSettings.findOne().lean();
    const tosVersion = settings?.tosVersion ?? "";
    const privacyVersion = settings?.privacyVersion ?? "";
    const now = new Date();

    // Build update object — ensure role is set to "user" if not already present
    const updateData: Record<string, unknown> = {
      name,
      username,
      email,
      dateOfBirth: dob,
      onboardingCompleted: true,
      role: "user",
      "consents.tos": { accepted: true, version: tosVersion, acceptedAt: now },
      "consents.privacy": { accepted: true, version: privacyVersion, acceptedAt: now },
      "consents.ageVerification": { accepted: true, acceptedAt: now },
    };

    // Only update password if provided (OAuth users may not have one yet)
    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    // Handle both ObjectId and UUID user IDs from the adapter
    const userId = session.user.id;
    const isObjectId = Types.ObjectId.isValid(userId) && new Types.ObjectId(userId).toString() === userId;

    if (isObjectId) {
      await User.findByIdAndUpdate(userId, updateData, { upsert: true });
    } else {
      // UUID from adapter — find by email and update, or create via upsert
      await User.findOneAndUpdate({ email }, updateData, { upsert: true });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    await ConsentLog.create([
      {
        userId: session.user.id,
        type: "tos",
        version: tosVersion,
        action: "accepted",
        ip,
        userAgent,
        createdAt: now,
      },
      {
        userId: session.user.id,
        type: "privacy",
        version: privacyVersion,
        action: "accepted",
        ip,
        userAgent,
        createdAt: now,
      },
      {
        userId: session.user.id,
        type: "age_verification",
        version: "1.0",
        action: "accepted",
        ip,
        userAgent,
        createdAt: now,
      },
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[onboarding]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
