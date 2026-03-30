import { auth } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ShoppingBag } from "lucide-react";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  const [dashboardDict] = await Promise.all([
    getDictionary(lang as Locale, "dashboard"),
  ]);

  const session = await auth();
  const userName = session?.user?.name ?? session?.user?.email ?? "User";

  const welcomeTemplate = dashboardDict["welcomeBack"] ?? "Welcome back, {username}";
  const welcomeMessage = welcomeTemplate.replace("{username}", userName);

  const packsOpenedLabel = dashboardDict["packsOpened"] ?? "Packs opened";
  const thisWeekLabel = dashboardDict["thisWeek"] ?? "+0 this week";
  const collectionScoreLabel = dashboardDict["collectionScore"] ?? "Collection Score";
  const collectorLevelLabel = dashboardDict["collectorLevel"] ?? "Collector Level";
  const comingSoonLabel = dashboardDict["comingSoon"] ?? "Coming soon";
  const comingSoonDescLabel = dashboardDict["comingSoonDesc"] ?? "More features are on the way.";
  const packsLabel = dashboardDict["packs"] ?? "Packs";
  const packsDescLabel = dashboardDict["packsDesc"] ?? "Open packs and build your collection.";
  const marketplaceLabel = dashboardDict["marketplace"] ?? "Marketplace";
  const marketplaceDescLabel = dashboardDict["marketplaceDesc"] ?? "Trade and sell your cards.";
  const xpLabel = dashboardDict["xp"] ?? "XP";

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Welcome heading */}
      <div>
        <h2 className="text-2xl font-bold text-text-primary">{welcomeMessage}</h2>
        <p className="text-text-secondary mt-1 text-sm">
          {dashboardDict["welcomeSubtitle"] ?? "Here's an overview of your activity."}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Packs opened — topline */}
        <Card variant="topline" className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            {packsOpenedLabel}
          </p>
          <p className="text-3xl font-bold text-text-primary">0</p>
          <p className="text-xs text-text-muted mt-1">{thisWeekLabel}</p>
        </Card>

        {/* Collection score — accent */}
        <Card variant="accent" className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            {collectionScoreLabel}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-3xl font-bold text-text-primary">0</p>
            <Badge variant="info">—</Badge>
          </div>
        </Card>

        {/* Collector level — cut */}
        <Card variant="cut" className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            {collectorLevelLabel}
          </p>
          <p className="text-3xl font-bold text-pa-green">LVL 1</p>
          {/* XP bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span>0 {xpLabel}</span>
              <span>100 {xpLabel}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/8">
              <div
                className="h-1.5 rounded-full bg-pa-green"
                style={{ width: "0%" }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Coming soon section */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">
          {comingSoonLabel}
        </h3>
        <p className="text-sm text-text-secondary mb-4">{comingSoonDescLabel}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Packs teaser */}
          <Card variant="soft" className="p-5 opacity-60 cursor-not-allowed">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-pa-green/10 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-pa-green" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-text-primary">{packsLabel}</p>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-pa-green/10 text-pa-green border border-pa-green/20">
                    {comingSoonLabel}
                  </span>
                </div>
                <p className="text-xs text-text-muted">{packsDescLabel}</p>
              </div>
            </div>
          </Card>

          {/* Marketplace teaser */}
          <Card variant="soft" className="p-5 opacity-60 cursor-not-allowed">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-pa-green/10 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-5 h-5 text-pa-green" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-text-primary">{marketplaceLabel}</p>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-pa-green/10 text-pa-green border border-pa-green/20">
                    {comingSoonLabel}
                  </span>
                </div>
                <p className="text-xs text-text-muted">{marketplaceDescLabel}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
