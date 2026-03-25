import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAvatar } from "@/lib/gridfs";
import connectDB from "@/lib/db";
import User from "@/models/user";

// ---------------------------------------------------------------------------
// GET — serve a user's custom avatar from GridFS
// Without ?userId → serves the authenticated user's avatar
// With ?userId=xxx → serves that user's avatar (public, for admin tables etc.)
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestedUserId = searchParams.get("userId");

  let userId: string;

  if (requestedUserId) {
    // Public access by userId — used in admin tables and user lists
    userId = requestedUserId;
  } else {
    // Authenticated user's own avatar
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = session.user.id;
  }

  try {
    const result = await getAvatar(userId);

    if (!result) {
      if (!requestedUserId) {
        // Only clean up own stale reference
        await connectDB();
        const user = await User.findById(userId).select("image").lean();
        if (user?.image && (user.image as string).startsWith("/api/profile/avatar/file")) {
          await User.findByIdAndUpdate(userId, { image: null });
        }
      }
      return NextResponse.redirect(
        new URL("/images/default-avatar.png", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
      );
    }

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
        "Cache-Control": "public, max-age=300, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[avatar/file GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
