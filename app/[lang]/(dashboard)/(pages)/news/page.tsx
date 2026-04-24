import { cache } from "react";
import Link from "next/link";
import connectDB from "@/lib/db";
import NewsPost from "@/models/news-post";
import { NewsCard, type NewsCardData } from "@/components/news/news-card";
import { Card } from "@/components/ui/card";
import { Newspaper } from "lucide-react";

interface NewsIndexPageProps {
  params: Promise<{ lang: string }>;
}

const PAGE_SIZE = 30;

const loadAllPublishedNews = cache(async (): Promise<NewsCardData[]> => {
  try {
    await connectDB();
    const posts = await NewsPost.find({ status: "published" })
      .sort({ publishedAt: -1, _id: -1 })
      .limit(PAGE_SIZE)
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
    console.error("[news index] load failed:", err);
    return [];
  }
});

export default async function NewsIndexPage({ params }: NewsIndexPageProps) {
  const { lang } = await params;
  const items = await loadAllPublishedNews();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">News</h2>
        <p className="text-text-secondary mt-1 text-sm">
          Releases, Events und Updates rund um PACKATTACK.
        </p>
      </div>

      {items.length === 0 ? (
        <Card variant="soft" className="p-8 text-center text-text-secondary">
          <Newspaper className="w-6 h-6 text-text-muted mx-auto mb-2" />
          Noch keine News. Schau später wieder rein.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((post) => (
            <Link key={post._id} href={`/${lang}/news/${post.slug}`} className="block">
              <NewsCard post={post} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
