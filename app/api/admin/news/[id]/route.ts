import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import NewsPost, { type NewsPostType } from "@/models/news-post";
import { deleteNewsImage, uploadNewsImage } from "@/lib/gridfs-news";
import { notifyNewsPublished } from "@/lib/push/notify-news";
import { detectImageMime } from "@/lib/image-magic-bytes";

const VALID_TYPES: NewsPostType[] = ["release", "event", "community"];
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

function isAdmin(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  await connectDB();
  const user = await User.findById(session.user.id).select("role").lean();
  if (!user || !isAdmin(user.role)) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }

    const post = await NewsPost.findById(id).lean();
    if (!post) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      post: {
        ...post,
        _id: String(post._id),
        authorId: String(post.authorId),
        imageId: post.imageId ? String(post.imageId) : null,
      },
    });
  } catch (err) {
    console.error("[admin/news/[id] GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }

    const post = await NewsPost.findById(id);
    if (!post) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const form = await req.formData();

    const title = form.get("title");
    if (typeof title === "string") {
      const trimmed = title.trim();
      if (!trimmed) {
        return NextResponse.json({ error: "title_required" }, { status: 400 });
      }
      post.title = trimmed;
    }

    const body = form.get("body");
    if (typeof body === "string") {
      const trimmed = body.trim();
      if (!trimmed) {
        return NextResponse.json({ error: "body_required" }, { status: 400 });
      }
      post.body = trimmed;
    }

    const excerpt = form.get("excerpt");
    if (typeof excerpt === "string") {
      post.excerpt = excerpt.trim();
    }

    const type = form.get("type");
    if (typeof type === "string") {
      if (!VALID_TYPES.includes(type as NewsPostType)) {
        return NextResponse.json({ error: "invalid_type" }, { status: 400 });
      }
      post.type = type as NewsPostType;
    }

    const imageAlt = form.get("imageAlt");
    if (typeof imageAlt === "string") {
      post.imageAlt = imageAlt.trim();
    }

    const status = form.get("status");
    let publishTriggered = false;
    if (typeof status === "string") {
      if (status !== "draft" && status !== "published") {
        return NextResponse.json({ error: "invalid_status" }, { status: 400 });
      }
      const wasPublished = post.status === "published";
      post.status = status;
      if (status === "published" && !wasPublished) {
        post.publishedAt = new Date();
        publishTriggered = true;
      }
      if (status === "draft") {
        post.publishedAt = null;
      }
    }

    const removeImage = form.get("removeImage") === "true";
    const file = form.get("image");

    // Track which images need cleanup *after* a successful save:
    // - oldImageId: the image we replaced or removed (delete on success)
    // - newImageId: the freshly uploaded image (delete on save failure)
    const previousImageId = post.imageId
      ? new ObjectId(post.imageId.toHexString())
      : null;

    let newImageId: ObjectId | null = null;

    if (file && typeof file !== "string") {
      const blob = file as File;
      if (!ALLOWED_IMAGE_TYPES.includes(blob.type)) {
        return NextResponse.json({ error: "invalid_image_type" }, { status: 400 });
      }
      if (blob.size > MAX_IMAGE_SIZE) {
        return NextResponse.json({ error: "image_too_large" }, { status: 400 });
      }
      const buf = Buffer.from(await blob.arrayBuffer());
      const sniffed = detectImageMime(buf);
      if (!sniffed) {
        return NextResponse.json({ error: "invalid_image_type" }, { status: 400 });
      }
      const result = await uploadNewsImage(buf, sniffed);
      newImageId = result.id;
      post.imageId = new Types.ObjectId(result.id.toHexString());
    } else if (removeImage) {
      post.imageId = null;
    }

    try {
      await post.save();
    } catch (saveErr) {
      if (newImageId) {
        await deleteNewsImage(newImageId).catch(() => {
          /* best-effort */
        });
      }
      if ((saveErr as { code?: number })?.code === 11000) {
        return NextResponse.json(
          { error: "slug_conflict" },
          { status: 409 }
        );
      }
      throw saveErr;
    }

    // Save succeeded; clean up replaced/removed image now.
    if (previousImageId && (newImageId || removeImage)) {
      await deleteNewsImage(previousImageId).catch(() => {
        /* best-effort */
      });
    }

    if (publishTriggered) {
      // Fire-and-forget broadcast.
      notifyNewsPublished(post).catch((err) => {
        console.error("[admin/news/[id] PATCH] notify failed:", err);
      });
    }

    return NextResponse.json({
      post: {
        ...post.toObject(),
        _id: String(post._id),
        authorId: String(post.authorId),
        imageId: post.imageId ? String(post.imageId) : null,
      },
    });
  } catch (err) {
    console.error("[admin/news/[id] PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }

    const post = await NewsPost.findById(id);
    if (!post) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (post.imageId) {
      await deleteNewsImage(new ObjectId(post.imageId.toHexString()));
    }
    await post.deleteOne();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/news/[id] DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
