import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";

const ALL_ROLES = ["user", "shop", "moderator", "admin", "super_admin"] as const;
type Role = (typeof ALL_ROLES)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || (sessionRole !== "admin" && sessionRole !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (sessionUserId === id) {
    return NextResponse.json({ error: "Cannot change own role" }, { status: 400 });
  }

  let body: { role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const newRole = body.role as string;

  if (!ALL_ROLES.includes(newRole as Role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Only super_admin can assign admin or super_admin roles
  if (
    (newRole === "admin" || newRole === "super_admin") &&
    sessionRole !== "super_admin"
  ) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    await connectDB();

    const updated = await User.findByIdAndUpdate(
      id,
      { role: newRole },
      { returnDocument: "after" }
    )
      .select("_id name username email role emailVerified image createdAt")
      .lean();

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      _id: updated._id.toString(),
      name: updated.name,
      username: updated.username,
      email: updated.email,
      role: updated.role,
      emailVerified: updated.emailVerified ?? null,
      image: updated.image ?? null,
      createdAt: updated.createdAt,
    });
  } catch (err) {
    console.error("[admin/users/[id]/role PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
