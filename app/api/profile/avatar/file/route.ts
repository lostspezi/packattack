import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAvatar } from "@/lib/gridfs";

// ---------------------------------------------------------------------------
// GET — serve the authenticated user's custom avatar from GridFS
// ---------------------------------------------------------------------------
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await getAvatar(session.user.id);

    if (!result) {
      return NextResponse.json({ error: "No avatar found" }, { status: 404 });
    }

    // Collect the readable stream into a Buffer
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      result.stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      result.stream.on("end", resolve);
      result.stream.on("error", reject);
    });

    const buffer = Buffer.concat(chunks);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=300, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[avatar/file GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
