import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import ShopProfile from "@/models/shop-profile";
import { getLicense } from "@/lib/gridfs-licenses";
import { Readable } from "stream";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();
    const profile = await ShopProfile.findById(id).lean();
    if (!profile?.licenseFileId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await getLicense(profile.licenseFileId);
    if (!result) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webStream = Readable.toWeb(result.stream) as any;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `inline; filename="${result.filename}"`,
      },
    });
  } catch (err) {
    console.error("[admin/shops/[id]/license GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
