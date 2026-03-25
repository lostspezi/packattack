import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { uploadAvatar, deleteAvatar } from "@/lib/gridfs";
import { MongoClient, ObjectId } from "mongodb";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_SIZE = 1 * 1024 * 1024; // 1 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg"];

/**
 * Read PNG dimensions from raw buffer without any external library.
 * PNG: bytes 16-23 contain width (4 bytes) and height (4 bytes).
 */
function getPngDimensions(buf: Buffer): { width: number; height: number } | null {
  // PNG signature: 8 bytes, then IHDR chunk: 4 len + 4 type + 4 width + 4 height
  if (buf.length < 24) return null;
  const sig = buf.slice(0, 8);
  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!sig.equals(pngSig)) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

/**
 * Read JPEG dimensions from raw buffer.
 * Iterates JPEG segments to find SOF markers.
 */
function getJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 2) return null;
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;

  let offset = 2;
  while (offset < buf.length - 1) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1];
    offset += 2;

    // Skip padding 0xff bytes
    if (marker === 0xff) {
      offset--;
      continue;
    }

    // SOI / EOI have no length
    if (marker === 0xd8 || marker === 0xd9) continue;

    if (offset + 2 > buf.length) break;
    const segLen = buf.readUInt16BE(offset);

    // SOF markers: 0xC0–0xC3, 0xC5–0xC7, 0xC9–0xCB, 0xCD–0xCF
    const isSOF =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSOF && offset + 7 <= buf.length) {
      const height = buf.readUInt16BE(offset + 3);
      const width = buf.readUInt16BE(offset + 5);
      return { width, height };
    }

    offset += segLen;
  }
  return null;
}

function getImageDimensions(
  buf: Buffer,
  contentType: string
): { width: number; height: number } | null {
  if (contentType === "image/png") return getPngDimensions(buf);
  if (contentType === "image/jpeg") return getJpegDimensions(buf);
  return null;
}

let _nativeClient: MongoClient | null = null;
function getNativeClient(): MongoClient {
  if (!_nativeClient) {
    _nativeClient = new MongoClient(process.env.MONGODB_URI!);
  }
  return _nativeClient;
}

// ---------------------------------------------------------------------------
// POST — upload custom avatar
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // file is a Blob/File
    const blob = file as File;

    if (!ALLOWED_TYPES.includes(blob.type)) {
      return NextResponse.json(
        { error: "Only PNG and JPG files are allowed" },
        { status: 400 }
      );
    }

    if (blob.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size must be 1MB or less" },
        { status: 400 }
      );
    }

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Dimension check
    const dimensions = getImageDimensions(buffer, blob.type);
    if (dimensions) {
      if (dimensions.width > 500 || dimensions.height > 500) {
        return NextResponse.json(
          { error: "Image must be 500x500 pixels or smaller" },
          { status: 400 }
        );
      }
    }

    const userId = session.user.id;
    const ext = blob.type === "image/png" ? "png" : "jpg";
    const filename = `avatar-${userId}.${ext}`;

    await uploadAvatar(userId, buffer, filename, blob.type);

    // Update user.image to point to the file serving route
    await connectDB();
    await User.findByIdAndUpdate(userId, {
      image: `/api/profile/avatar/file`,
    });

    return NextResponse.json({ success: true, image: `/api/profile/avatar/file` });
  } catch (err) {
    console.error("[avatar POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — select provider avatar (discord | twitch)
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { provider?: string };
    const { provider } = body;

    if (!provider || !["discord", "twitch"].includes(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const userId = session.user.id;

    // Look up the OAuth account for this provider
    const client = getNativeClient();
    await client.connect();
    const db = client.db();

    const account = await db.collection("accounts").findOne({
      userId: new ObjectId(userId),
      provider,
    });

    if (!account) {
      return NextResponse.json(
        { error: "Provider not linked" },
        { status: 404 }
      );
    }

    // Fetch the avatar URL directly from the provider's API
    let providerImage: string | null = null;

    if (provider === "discord") {
      // Discord API: GET /users/@me with Bearer token
      const accessToken = account.access_token as string | undefined;
      if (accessToken) {
        try {
          const res = await fetch("https://discord.com/api/v10/users/@me", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.avatar) {
              const ext = data.avatar.startsWith("a_") ? "gif" : "png";
              providerImage = `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.${ext}?size=256`;
            }
          }
        } catch { /* ignore fetch error */ }
      }
    } else if (provider === "twitch") {
      // Twitch API: GET /users with Bearer token + Client-ID
      const accessToken = account.access_token as string | undefined;
      if (accessToken) {
        try {
          const res = await fetch("https://api.twitch.tv/helix/users", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Client-Id": process.env.TWITCH_CLIENT_ID || "",
            },
          });
          if (res.ok) {
            const data = await res.json();
            providerImage = data.data?.[0]?.profile_image_url ?? null;
          }
        } catch { /* ignore fetch error */ }
      }
    }

    // Fallback: check native users collection for stored image
    if (!providerImage) {
      const nativeUser = await db
        .collection("users")
        .findOne({ _id: new ObjectId(userId) });
      providerImage = (nativeUser?.image as string) ?? null;
    }

    if (!providerImage) {
      return NextResponse.json(
        { error: "No avatar found for this provider. Try re-linking your account." },
        { status: 404 }
      );
    }

    // Delete any existing custom GridFS avatar and update user.image
    await deleteAvatar(userId);
    await connectDB();
    await User.findByIdAndUpdate(userId, { image: providerImage });

    return NextResponse.json({ success: true, image: providerImage });
  } catch (err) {
    console.error("[avatar PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove avatar
// ---------------------------------------------------------------------------
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = session.user.id;

    await deleteAvatar(userId);

    await connectDB();
    await User.findByIdAndUpdate(userId, { image: null });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[avatar DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
