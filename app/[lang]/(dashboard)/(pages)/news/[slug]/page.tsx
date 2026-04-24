import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import connectDB from "@/lib/db";
import NewsPost, { type NewsPostType } from "@/models/news-post";
import { Badge } from "@/components/ui/badge";
import { renderNewsMarkdown } from "@/lib/news/markdown";

interface NewsDetailPageProps {
  params: Promise<{ lang: string; slug: string }>;
}

interface DetailPost {
  _id: string;
  title: string;
  slug: string;
  body: string;
  excerpt: string;
  type: NewsPostType;
  imageId: string | null;
  imageAlt: string;
  publishedAt: string | null;
}

const TYPE_LABEL: Record<NewsPostType, string> = {
  release: "Release",
  event: "Event",
  community: "Community",
};

function badgeVariantForType(type: NewsPostType) {
  if (type === "release") return "info";
  if (type === "event") return "warning";
  return "user";
}

function formatDate(value: string | null): string {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

const loadPost = cache(async (slug: string): Promise<DetailPost | null> => {
  try {
    await connectDB();
    const post = await NewsPost.findOne({ slug, status: "published" })
      .select("title slug body excerpt type imageId imageAlt publishedAt")
      .lean();
    if (!post) return null;
    return {
      _id: String(post._id),
      title: post.title,
      slug: post.slug,
      body: post.body,
      excerpt: post.excerpt ?? "",
      type: post.type,
      imageId: post.imageId ? String(post.imageId) : null,
      imageAlt: post.imageAlt ?? "",
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    };
  } catch (err) {
    console.error("[news detail] load failed:", err);
    return null;
  }
});

export async function generateMetadata({ params }: NewsDetailPageProps) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) return { title: "News" };
  return {
    title: `${post.title} · PACKATTACK News`,
    description: post.excerpt || undefined,
  };
}

export default async function NewsDetailPage({ params }: NewsDetailPageProps) {
  const { lang, slug } = await params;
  const post = await loadPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="space-y-6 max-w-3xl">
      <Link
        href={`/${lang}/news`}
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="w-4 h-4" /> Alle News
      </Link>

      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant={badgeVariantForType(post.type)}>
            {TYPE_LABEL[post.type]}
          </Badge>
          {post.publishedAt && (
            <span className="text-text-muted text-sm">
              {formatDate(post.publishedAt)}
            </span>
          )}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-text-primary">
          {post.title}
        </h1>
        {post.excerpt && (
          <p className="text-lg text-text-secondary">{post.excerpt}</p>
        )}
      </header>

      {post.imageId && (
        <div className="rounded-[14px] overflow-hidden border border-white/8 bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element -- streamed from GridFS, dynamic dimensions */}
          <img
            src={`/api/news/images/${post.imageId}`}
            alt={post.imageAlt || post.title}
            className="w-full h-auto block"
          />
        </div>
      )}

      <div className="space-y-3">{renderNewsMarkdown(post.body, post._id)}</div>
    </article>
  );
}
