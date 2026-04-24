import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDashboardStats } from "@/lib/dashboard/stats";
import { getHeroAction } from "@/lib/dashboard/hero-action";
import { getActivitySnapshot } from "@/lib/dashboard/activity";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DashboardStatsStrip } from "@/components/dashboard/dashboard-stats-strip";
import { DashboardNewsStrip } from "@/components/dashboard/dashboard-news-strip";
import { DashboardQuickActions } from "@/components/dashboard/dashboard-quick-actions";
import { DashboardActivityFeed } from "@/components/dashboard/dashboard-activity-feed";
import { DashboardLiveSidebar } from "@/components/dashboard/dashboard-live-sidebar";
import { DashboardBadgesShowcase } from "@/components/dashboard/dashboard-badges-showcase";
import { PushSubscriptionPrompt } from "@/components/dashboard/push-subscription-prompt";
import {
  NewsStripSkeleton,
  SidebarSkeleton,
  BadgesSkeleton,
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

  const [stats, hero, activity] = await Promise.all([
    getDashboardStats(userId),
    getHeroAction(userId),
    getActivitySnapshot(userId, { limit: 10 }),
  ]);

  return (
    <div className="space-y-8" data-tour="dashboard-welcome">
      <DashboardHero lang={lang} userName={userName} hero={hero} />

      <PushSubscriptionPrompt />

      <DashboardStatsStrip stats={stats} />

      <Suspense fallback={<NewsStripSkeleton />}>
        <DashboardNewsStrip lang={lang} limit={3} />
      </Suspense>

      <DashboardQuickActions lang={lang} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DashboardActivityFeed initialItems={activity} />
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
