import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getAchievementIcon } from "@/lib/gridfs-achievements";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return new NextResponse("Bad Request", { status: 400 });
    }

    const file = await getAchievementIcon(new ObjectId(id));
    if (!file) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const stream = file.stream as unknown as ReadableStream;
    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[api/achievements/images/[id] GET]", err);
    return new NextResponse("Server Error", { status: 500 });
  }
}
