import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAvatar } from "@/lib/gridfs";
import connectDB from "@/lib/db";
import User from "@/models/user";

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
      // Clean up stale user.image reference
      await connectDB();
      await User.findByIdAndUpdate(session.user.id, { image: null });
      // Redirect to default avatar
      return NextResponse.redirect(new URL("/images/default-avatar.png", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
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
