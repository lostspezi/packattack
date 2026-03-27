import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import ShopProfile from "@/models/shop-profile";
import User from "@/models/user";
import Notification from "@/models/notification";
import { uploadLicense } from "@/lib/gridfs-licenses";
import { shopApplySchema } from "@/lib/validations";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const companyName = formData.get("companyName");
    const file = formData.get("file");
    const isSmallBusiness = formData.get("isSmallBusiness") === "true";

    const parsed = shopApplySchema.safeParse({ companyName });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Gewerbenachweis ist erforderlich" }, { status: 400 });
    }

    const blob = file as File;
    if (!ALLOWED_TYPES.includes(blob.type)) {
      return NextResponse.json(
        { error: "Nur PDF, PNG oder JPG erlaubt" },
        { status: 400 }
      );
    }
    if (blob.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Datei darf maximal 5 MB groß sein" },
        { status: 400 }
      );
    }

    await connectDB();

    const existing = await ShopProfile.findOne({ user: userId });
    if (existing) {
      if (existing.status === "approved") {
        return NextResponse.json({ error: "Bereits freigeschaltet" }, { status: 400 });
      }
      if (existing.status === "pending") {
        return NextResponse.json({ error: "Bewerbung bereits eingereicht" }, { status: 400 });
      }
      // If rejected, allow re-application
      await ShopProfile.deleteOne({ user: userId });
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const ext = blob.type === "application/pdf" ? "pdf" : blob.type === "image/png" ? "png" : "jpg";
    const filename = `license-${userId}.${ext}`;

    const fileId = await uploadLicense(userId, buffer, filename, blob.type);

    const profile = await ShopProfile.create({
      user: userId,
      companyName: parsed.data.companyName,
      status: "pending",
      isSmallBusiness,
      licenseFileId: fileId,
      licenseFileName: filename,
      submittedAt: new Date(),
    });

    // Notify all admins
    const admins = await User.find({ role: { $in: ["admin", "super_admin"] } })
      .select("_id")
      .lean();
    for (const admin of admins) {
      await Notification.create({
        userId: admin._id.toString(),
        title: "Neue Shop-Bewerbung",
        message: `${parsed.data.companyName} hat eine Shop-Bewerbung eingereicht.`,
        type: "info",
        cta: { label: "Bewerbung prüfen", url: `/de/admin/shops` },
      });
    }

    return NextResponse.json({ success: true, profileId: profile._id.toString() }, { status: 201 });
  } catch (err) {
    console.error("[shop/apply POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
