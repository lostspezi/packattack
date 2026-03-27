import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import ShopProfile from "@/models/shop-profile";
import User from "@/models/user";
import Notification from "@/models/notification";
import { Types } from "mongoose";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !adminId || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, rejectReason } = body as {
    action?: "approve" | "reject";
    rejectReason?: string;
  };

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }
  if (action === "reject" && !rejectReason?.trim()) {
    return NextResponse.json({ error: "rejectReason required when rejecting" }, { status: 400 });
  }

  try {
    await connectDB();
    const profile = await ShopProfile.findById(id);
    if (!profile) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    profile.status = action === "approve" ? "approved" : "rejected";
    profile.rejectReason = action === "reject" ? (rejectReason ?? null) : null;
    profile.reviewedBy = new Types.ObjectId(adminId);
    profile.reviewedAt = new Date();
    await profile.save();

    if (action === "approve") {
      await User.findByIdAndUpdate(profile.user, { role: "shop" });
    }

    await Notification.create({
      userId: profile.user.toString(),
      title: action === "approve" ? "Shop-Bewerbung angenommen" : "Shop-Bewerbung abgelehnt",
      message:
        action === "approve"
          ? "Deine Shop-Bewerbung wurde angenommen. Du kannst jetzt dein Inventar verwalten."
          : `Deine Shop-Bewerbung wurde abgelehnt: ${rejectReason}`,
      type: action === "approve" ? "success" : "error",
      cta:
        action === "approve"
          ? { label: "Inventar verwalten", url: `/de/shop/inventory` }
          : undefined,
    });

    return NextResponse.json({ success: true, status: profile.status });
  } catch (err) {
    console.error("[admin/shops/[id] PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
