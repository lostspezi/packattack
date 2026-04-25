import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardHeroAsync } from "@/components/dashboard/dashboard-hero-async";
import { DashboardStatsStripAsync } from "@/components/dashboard/dashboard-stats-strip-async";
import { DashboardNewsStrip } from "@/components/dashboard/dashboard-news-strip";
import { DashboardQuickActions } from "@/components/dashboard/dashboard-quick-actions";
import { DashboardProgressionCard } from "@/components/dashboard/dashboard-progression-card";
import { DashboardActivityFeedAsync } from "@/components/dashboard/dashboard-activity-feed-async";
import { DashboardLiveSidebar } from "@/components/dashboard/dashboard-live-sidebar";
import { DashboardBadgesShowcase } from "@/components/dashboard/dashboard-badges-showcase";
import { PushSubscriptionPrompt } from "@/components/dashboard/push-subscription-prompt";
import { UpvoteBanner } from "@/components/votes/upvote-banner";
import {
  ActivityFeedSkeleton,
  BadgesSkeleton,
  DashboardHeroSkeleton,
  NewsStripSkeleton,
  SidebarSkeleton,
  StatsStripSkeleton,
  UpvoteBannerSkeleton,
} from "@/components/dashboard/dashboard-skeletons";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${lang}/login`);
  }

  const userId = session.user.id;
  const userName = session.user.name ?? session.user.email ?? "Sammler";

  return (
    <div className="space-y-8" data-tour="dashboard-welcome">
      <PushSubscriptionPrompt />

      <Suspense fallback={<DashboardHeroSkeleton userName={userName} />}>
        <DashboardHeroAsync lang={lang} userId={userId} userName={userName} />
      </Suspense>

      <Suspense fallback={<UpvoteBannerSkeleton />}>
        <UpvoteBanner lang={lang} userId={userId} />
      </Suspense>

      <Suspense fallback={<StatsStripSkeleton />}>
        <DashboardStatsStripAsync lang={lang} userId={userId} />
      </Suspense>

      <Suspense fallback={<NewsStripSkeleton />}>
        <DashboardNewsStrip lang={lang} limit={3} />
      </Suspense>

      <DashboardQuickActions lang={lang} />

      <DashboardProgressionCard lang={lang} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Suspense fallback={<ActivityFeedSkeleton />}>
            <DashboardActivityFeedAsync userId={userId} limit={10} />
          </Suspense>
        </div>
        <div className="lg:col-span-1">
          <Suspense fallback={<SidebarSkeleton />}>
            <DashboardLiveSidebar lang={lang} userId={userId} />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<BadgesSkeleton />}>
        <DashboardBadgesShowcase userId={userId} />
      </Suspense>
    </div>
  );
}
