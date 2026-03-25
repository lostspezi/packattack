import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import ConsentLog from "@/models/consent-log";
import PlatformSettings from "@/models/platform-settings";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    await connectDB();

    const settings = await PlatformSettings.findOne().lean();
    const tosVersion = settings?.tosVersion ?? "";
    const privacyVersion = settings?.privacyVersion ?? "";
    const now = new Date();

    await User.findByIdAndUpdate(session.user.id, {
      "consents.tos": { accepted: true, version: tosVersion, acceptedAt: now },
      "consents.privacy": { accepted: true, version: privacyVersion, acceptedAt: now },
    });

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
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[accept-terms]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
