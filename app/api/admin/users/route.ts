import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";

function getCreatedAt(user: { _id: unknown; createdAt?: Date | string }): string | null {
  if (user.createdAt) return new Date(user.createdAt as string).toISOString();
  // Extract timestamp from ObjectId if possible
  if (user._id && Types.ObjectId.isValid(String(user._id))) {
    try {
      return new Types.ObjectId(String(user._id)).getTimestamp().toISOString();
    } catch { /* ignore */ }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));
  const search = searchParams.get("search") ?? "";
  const roleFilter = searchParams.get("role") ?? "";
  const verifiedFilter = searchParams.get("verified") ?? "";

  const query: Record<string, unknown> = {};

  if (search) {
    query.$or = [
      { username: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  if (roleFilter) {
    if (roleFilter.includes(",")) {
      query.role = { $in: roleFilter.split(",") };
    } else {
      query.role = roleFilter;
    }
  }

  if (verifiedFilter === "true") {
    query.emailVerified = { $ne: null };
  } else if (verifiedFilter === "false") {
    query.emailVerified = null;
  }

  try {
    await connectDB();

    const [users, total] = await Promise.all([
      User.find(query)
        .select("_id name username email role emailVerified image createdAt")
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      User.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      users: users.map((u) => ({
        _id: u._id.toString(),
        name: u.name,
        username: u.username,
        email: u.email,
        role: u.role,
        emailVerified: u.emailVerified ?? null,
        image: u.image ?? null,
        createdAt: getCreatedAt(u),
      })),
      total,
      page,
      totalPages,
    });
  } catch (err) {
    console.error("[admin/users GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
