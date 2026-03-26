import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { deleteAvatar } from "@/lib/gridfs";

const ADMIN_DELETABLE_ROLES = ["user", "shop", "moderator"] as const;
type Role = "user" | "shop" | "moderator" | "admin" | "super_admin";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || (sessionRole !== "admin" && sessionRole !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Cannot delete self
  if (sessionUserId === id) {
    return NextResponse.json({ error: "Cannot delete self" }, { status: 403 });
  }

  try {
    await connectDB();

    const targetUser = await User.findById(id).select("role").lean();
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const targetRole = (targetUser as { role: Role }).role;

    // Hierarchy checks
    if (sessionRole === "admin") {
      // admin can only delete user, shop, moderator
      if (!(ADMIN_DELETABLE_ROLES as readonly string[]).includes(targetRole)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    }
    // super_admin can delete anyone except self (already checked above)

    // Nobody can delete a super_admin except another super_admin
    if (targetRole === "super_admin" && sessionRole !== "super_admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { MongoClient, ObjectId } = await import("mongodb");
    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();
    const db = client.db();

    // userId in native collections is stored as ObjectId, not string
    const userOid = new ObjectId(id);

    // Delete accounts, sessions, notifications, verificationtokens — keep consent_log
    await Promise.all([
      db.collection("accounts").deleteMany({ userId: userOid }),
      db.collection("sessions").deleteMany({ userId: userOid }),
      db.collection("notifications").deleteMany({ userId: id }),
      db.collection("verificationtokens").deleteMany({ userId: id }),
    ]);

    // Delete GridFS avatar
    await deleteAvatar(id);

    // Delete user document (both Mongoose and native adapter collection)
    await User.findByIdAndDelete(id);
    // Also try to delete from the native users collection (adapter may store separately)
    await db.collection("users").deleteOne({ _id: userOid });

    await client.close();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/users/[id] DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
