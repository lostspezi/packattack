import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import ShopProfile from "@/models/shop-profile";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));

  const query: Record<string, unknown> = {};
  if (status) query.status = status;

  try {
    await connectDB();
    const [profiles, total] = await Promise.all([
      ShopProfile.find(query)
        .populate("user", "name email")
        .populate("reviewedBy", "name")
        .sort({ submittedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ShopProfile.countDocuments(query),
    ]);

    return NextResponse.json({
      profiles: profiles.map((p) => ({
        _id: p._id.toString(),
        companyName: p.companyName,
        status: p.status,
        rejectReason: p.rejectReason,
        licenseFileName: p.licenseFileName,
        submittedAt: p.submittedAt,
        reviewedAt: p.reviewedAt,
        user: p.user,
        reviewedBy: p.reviewedBy,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[admin/shops GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
