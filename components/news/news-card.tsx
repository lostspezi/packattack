import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon } from "lucide-react";

export type NewsType = "release" | "event" | "community";

export interface NewsCardData {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  type: NewsType;
  imageId: string | null;
  imageAlt: string;
  publishedAt: string | null;
}

const TYPE_LABEL: Record<NewsType, string> = {
  release: "Release",
  event: "Event",
  community: "Community",
};

function badgeVariantForType(type: NewsType) {
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

interface NewsCardProps {
  post: NewsCardData;
  variant?: "default" | "compact";
}

export function NewsCard({ post, variant = "default" }: NewsCardProps) {
  const isCompact = variant === "compact";
  return (
    <Card variant="soft" className={isCompact ? "p-3" : "p-4"}>
      <div className="flex flex-col gap-3 h-full">
        <div
          className={`rounded-[10px] bg-white/4 overflow-hidden ${
            isCompact ? "h-24" : "h-32"
          } flex items-center justify-center`}
        >
          {post.imageId ? (
            // eslint-disable-next-line @next/next/no-img-element -- streamed from GridFS, dynamic dimensions
            <img
              src={`/api/news/images/${post.imageId}`}
              alt={post.imageAlt || post.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="w-8 h-8 text-text-muted" />
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={badgeVariantForType(post.type)}>
            {TYPE_LABEL[post.type]}
          </Badge>
          <span className="text-text-muted text-xs">
            {formatDate(post.publishedAt)}
          </span>
        </div>
        <h3 className="text-text-primary font-semibold text-sm line-clamp-2">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-text-secondary text-xs line-clamp-2">{post.excerpt}</p>
        )}
      </div>
    </Card>
  );
}
