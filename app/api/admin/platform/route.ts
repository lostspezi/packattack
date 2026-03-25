import { NextRequest, NextResponse } from "next/server";
import { auth, invalidatePlatformSettingsCache } from "@/lib/auth";
import connectDB from "@/lib/db";
import PlatformSettings from "@/models/platform-settings";
import ConsentLog from "@/models/consent-log";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();

    const settings = await PlatformSettings.findOne().lean();

    if (!settings) {
      return NextResponse.json({
        tosVersion: "",
        privacyVersion: "",
        updatedAt: null,
        consentStats: { tos: 0, privacy: 0 },
      });
    }

    const [tosCount, privacyCount] = await Promise.all([
      ConsentLog.countDocuments({
        type: "tos",
        version: settings.tosVersion,
        action: "accepted",
      }),
      ConsentLog.countDocuments({
        type: "privacy",
        version: settings.privacyVersion,
        action: "accepted",
      }),
    ]);

    return NextResponse.json({
      tosVersion: settings.tosVersion,
      privacyVersion: settings.privacyVersion,
      updatedAt: settings.updatedAt ?? null,
      consentStats: { tos: tosCount, privacy: privacyCount },
    });
  } catch (err) {
    console.error("[admin/platform GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { tosVersion?: string; privacyVersion?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { tosVersion, privacyVersion } = body;

  if (!tosVersion && !privacyVersion) {
    return NextResponse.json(
      { error: "Nothing to update" },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    const update: Record<string, unknown> = {};
    if (tosVersion) update.tosVersion = tosVersion;
    if (privacyVersion) update.privacyVersion = privacyVersion;
    if (userId) update.updatedBy = userId;

    const settings = await PlatformSettings.findOneAndUpdate(
      {},
      { $set: update },
      { upsert: true, new: true }
    ).lean();

    // Invalidate the in-memory cache so the JWT callback picks up the new versions immediately
    invalidatePlatformSettingsCache();

    return NextResponse.json({
      tosVersion: settings?.tosVersion ?? "",
      privacyVersion: settings?.privacyVersion ?? "",
      updatedAt: settings?.updatedAt ?? null,
    });
  } catch (err) {
    console.error("[admin/platform PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
