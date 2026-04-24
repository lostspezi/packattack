import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import NewsPost, { type NewsPostType } from "@/models/news-post";
import { deleteNewsImage, uploadNewsImage } from "@/lib/gridfs-news";

const VALID_TYPES: NewsPostType[] = ["release", "event", "community"];
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

function isAdmin(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const user = await User.findById(session.user.id).select("role").lean();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const filter: Record<string, unknown> = {};
    if (status === "draft" || status === "published") {
      filter.status = status;
    }

    const posts = await NewsPost.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      posts: posts.map((p) => ({
        _id: String(p._id),
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt ?? "",
        type: p.type,
        imageId: p.imageId ? String(p.imageId) : null,
        imageAlt: p.imageAlt ?? "",
        status: p.status,
        publishedAt: p.publishedAt,
        authorId: String(p.authorId),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (err) {
    console.error("[admin/news GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const user = await User.findById(session.user.id).select("role").lean();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const form = await req.formData();
    const title = String(form.get("title") ?? "").trim();
    const body = String(form.get("body") ?? "").trim();
    const excerpt = String(form.get("excerpt") ?? "").trim();
    const type = String(form.get("type") ?? "") as NewsPostType;
    const imageAlt = String(form.get("imageAlt") ?? "").trim();
    const status = String(form.get("status") ?? "draft");
    const file = form.get("image");

    if (!title) {
      return NextResponse.json({ error: "title_required" }, { status: 400 });
    }
    if (!body) {
      return NextResponse.json({ error: "body_required" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }
    if (status !== "draft" && status !== "published") {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }

    let uploadedImageId: ObjectId | null = null;
    if (file && typeof file !== "string") {
      const blob = file as File;
      if (!ALLOWED_IMAGE_TYPES.includes(blob.type)) {
        return NextResponse.json({ error: "invalid_image_type" }, { status: 400 });
      }
      if (blob.size > MAX_IMAGE_SIZE) {
        return NextResponse.json({ error: "image_too_large" }, { status: 400 });
      }
      const buf = Buffer.from(await blob.arrayBuffer());
      const result = await uploadNewsImage(buf, blob.type);
      uploadedImageId = result.id;
    }

    try {
      const now = new Date();
      const post = await NewsPost.create({
        title,
        body,
        excerpt,
        type,
        imageAlt,
        imageId: uploadedImageId
          ? new Types.ObjectId(uploadedImageId.toHexString())
          : null,
        status,
        publishedAt: status === "published" ? now : null,
        authorId: session.user.id,
      });

      return NextResponse.json(
        {
          post: {
            ...post.toObject(),
            _id: String(post._id),
            authorId: String(post.authorId),
            imageId: post.imageId ? String(post.imageId) : null,
          },
        },
        { status: 201 }
      );
    } catch (createErr) {
      // Clean up the orphaned image if the post couldn't be created.
      if (uploadedImageId) {
        await deleteNewsImage(uploadedImageId).catch(() => {
          /* best-effort */
        });
      }
      if ((createErr as { code?: number })?.code === 11000) {
        return NextResponse.json(
          { error: "slug_conflict" },
          { status: 409 }
        );
      }
      throw createErr;
    }
  } catch (err) {
    console.error("[admin/news POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
