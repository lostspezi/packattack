import Link from "next/link";
import { cache } from "react";
import { ArrowRight, Newspaper } from "lucide-react";
import { Card } from "@/components/ui/card";
import connectDB from "@/lib/db";
import NewsPost from "@/models/news-post";
import { NewsCard, type NewsCardData } from "@/components/news/news-card";

interface DashboardNewsStripProps {
  lang: string;
  limit?: number;
}

const loadLatestNews = cache(async (limit: number): Promise<NewsCardData[]> => {
  try {
    await connectDB();
    const posts = await NewsPost.find({ status: "published" })
      .sort({ publishedAt: -1, _id: -1 })
      .limit(limit)
      .select("title slug excerpt type imageId imageAlt publishedAt")
      .lean();

    return posts.map((p) => ({
      _id: String(p._id),
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt ?? "",
      type: p.type,
      imageId: p.imageId ? String(p.imageId) : null,
      imageAlt: p.imageAlt ?? "",
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    }));
  } catch (err) {
    console.error("[dashboard-news-strip] loadLatestNews failed:", err);
    return [];
  }
});

export async function DashboardNewsStrip({ lang, limit = 3 }: DashboardNewsStripProps) {
  const items = await loadLatestNews(limit);

  if (items.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-text-primary">News</h3>
        </div>
        <Card variant="soft" className="p-6 text-center text-text-secondary">
          <Newspaper className="w-6 h-6 text-text-muted mx-auto mb-2" />
          Noch keine News. Schau später wieder rein.
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-text-primary">News</h3>
        <Link
          href={`/${lang}/news`}
          className="text-pa-green text-sm font-medium inline-flex items-center gap-1 hover:underline"
        >
          Alle News <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((post) => (
          <Link
            key={post._id}
            href={`/${lang}/news/${post.slug}`}
            className="block transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-green/40 rounded-[14px]"
          >
            <NewsCard post={post} />
          </Link>
        ))}
      </div>
    </div>
  );
}
