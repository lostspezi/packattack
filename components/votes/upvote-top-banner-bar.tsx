"use client";

import { ThumbsUp } from "lucide-react";
import { TopBanner } from "@/components/ui/top-banner";

interface Props {
  lang: string;
  campaignId: string;
  title: string;
  question: string;
  dictHeadline: string;
  dictCta: string;
  dictDismiss: string;
}

export function UpvoteTopBannerBar({
  lang,
  campaignId,
  title,
  question,
  dictHeadline,
  dictCta,
  dictDismiss,
}: Props) {
  return (
    <TopBanner
      id={`upvote:${campaignId}`}
      href={`/${lang}/votes/${campaignId}`}
      headline={dictHeadline}
      title={title}
      body={question}
      ctaLabel={dictCta}
      dismissLabel={dictDismiss}
      icon={ThumbsUp}
      tone="green"
      pulse
    />
  );
}
