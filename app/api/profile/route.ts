import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { profileSchema } from "@/lib/validations";

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
      name: user.name,
      username: user.username,
      bio: user.bio ?? null,
      socialLinks: user.socialLinks ?? {},
      publicProfile: user.publicProfile ?? false,
      role: user.role,
      image: user.image ?? null,
      coins: user.coins ?? 0,
    });
  } catch (err) {
    console.error("[profile GET]", err);
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
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, username, bio, socialLinks, publicProfile } = parsed.data;

    await connectDB();

    // Check username uniqueness if changed
    const currentUser = await User.findById(session.user.id).lean();
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (username !== currentUser.username) {
      const existingUsername = await User.findOne({
        username,
        _id: { $ne: session.user.id },
      }).lean();
      if (existingUsername) {
        return NextResponse.json(
          { error: "username_taken" },
          { status: 409 }
        );
      }
    }

    const updated = await User.findByIdAndUpdate(
      session.user.id,
      { name, username, bio, socialLinks, publicProfile },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      name: updated.name,
      username: updated.username,
      bio: updated.bio ?? null,
      socialLinks: updated.socialLinks ?? {},
      publicProfile: updated.publicProfile ?? false,
      role: updated.role,
      image: updated.image ?? null,
    });
  } catch (err) {
    console.error("[profile PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
