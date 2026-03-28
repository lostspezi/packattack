import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { settingsSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const user = await User.findById(session.user.id).lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      language: user.preferences?.language ?? "en",
      theme: user.preferences?.theme ?? "dark",
      notifications: {
        email: user.preferences?.notifications?.email ?? true,
        browser: user.preferences?.notifications?.browser ?? true,
      },
    });
  } catch (err) {
    console.error("[settings GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { language, theme, notifications } = parsed.data;

    await connectDB();
    const updated = await User.findByIdAndUpdate(
      session.user.id,
      {
        "preferences.language": language,
        "preferences.theme": theme,
        "preferences.notifications.email": notifications.email,
        "preferences.notifications.browser": notifications.browser,
      },
      { returnDocument: "after" }
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      language: updated.preferences?.language ?? "en",
      theme: updated.preferences?.theme ?? "dark",
      notifications: {
        email: updated.preferences?.notifications?.email ?? true,
        browser: updated.preferences?.notifications?.browser ?? true,
      },
    });
  } catch (err) {
    console.error("[settings PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
