import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import ShopProfile from "@/models/shop-profile";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const profile = await ShopProfile.findOne({ user: userId }).lean();
    if (!profile) {
      return NextResponse.json({ profile: null });
    }
    return NextResponse.json({
      profile: {
        _id: profile._id.toString(),
        companyName: profile.companyName,
        status: profile.status,
        rejectReason: profile.rejectReason,
        submittedAt: profile.submittedAt,
        reviewedAt: profile.reviewedAt,
      },
    });
  } catch (err) {
    console.error("[shop/profile GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
