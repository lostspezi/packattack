import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import NewsPost from "@/models/news-post";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await connectDB();
    const { slug } = await params;

    const post = await NewsPost.findOne({ slug, status: "published" })
      .select("title slug body excerpt type imageId imageAlt publishedAt")
      .lean();

    if (!post) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      _id: String(post._id),
      title: post.title,
      slug: post.slug,
      body: post.body,
      excerpt: post.excerpt ?? "",
      type: post.type,
      imageId: post.imageId ? String(post.imageId) : null,
      imageAlt: post.imageAlt ?? "",
      publishedAt: post.publishedAt,
    });
  } catch (err) {
    console.error("[api/news/[slug] GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
