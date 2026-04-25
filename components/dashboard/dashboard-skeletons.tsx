import { Card } from "@/components/ui/card";

interface HeroSkeletonProps {
  userName: string;
}

// Static shell that paints immediately so the LCP h1 has content from the
// first byte. The async hero swaps the headline + buttons in once
// getHeroAction resolves.
export function DashboardHeroSkeleton({ userName }: HeroSkeletonProps) {
  return (
    <Card variant="cut" className="p-6 md:p-8 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-gradient-to-br from-pa-lila/30 via-transparent to-pa-green/4 pointer-events-none"
        aria-hidden
      />
      <div className="relative flex flex-col md:flex-row md:items-end gap-6 justify-between">
        <div className="space-y-2">
          <p className="text-text-muted text-xs uppercase tracking-wider font-semibold">
            Hi {userName}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary">
            Willkommen zurück.
          </h1>
          <p className="text-text-secondary text-sm md:text-base max-w-xl">
            Wir suchen gerade deinen besten nächsten Move.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <div className="h-12 w-44 bg-white/6 rounded-[10px] animate-pulse" />
          <div className="h-12 w-32 bg-white/4 rounded-[10px] animate-pulse" />
        </div>
      </div>
    </Card>
  );
}

export function StatsStripSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <Card key={i} variant="soft" className="p-5 animate-pulse">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 space-y-2">
              <div className="h-3 w-16 bg-white/6 rounded" />
              <div className="h-8 w-20 bg-white/8 rounded" />
              <div className="h-3 w-24 bg-white/4 rounded" />
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/4" />
          </div>
          <div className="h-3 w-24 bg-white/6 rounded" />
        </Card>
      ))}
    </div>
  );
}

export function ActivityFeedSkeleton() {
  return (
    <Card variant="soft" className="p-4 animate-pulse">
      <div className="h-4 w-28 bg-white/6 rounded mb-4" />
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/4 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 bg-white/6 rounded" />
              <div className="h-3 w-1/2 bg-white/4 rounded" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function NewsStripSkeleton() {
  return (
    <div>
      <div className="h-6 w-24 bg-white/4 rounded mb-3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} variant="soft" className="p-4 animate-pulse">
            <div className="h-32 bg-white/4 rounded-[10px] mb-3" />
            <div className="h-4 w-3/4 bg-white/4 rounded mb-2" />
            <div className="h-3 w-full bg-white/4 rounded" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1].map((i) => (
        <Card key={i} variant="soft" className="p-4 animate-pulse">
          <div className="h-4 w-24 bg-white/4 rounded mb-3" />
          <div className="h-3 w-full bg-white/4 rounded mb-2" />
          <div className="h-3 w-2/3 bg-white/4 rounded" />
        </Card>
      ))}
    </div>
  );
}

export function BadgesSkeleton() {
  return (
    <Card variant="soft" className="p-5 animate-pulse">
      <div className="h-4 w-32 bg-white/4 rounded mb-3" />
      <div className="flex gap-2">
        <div className="h-6 w-16 bg-white/4 rounded-full" />
        <div className="h-6 w-20 bg-white/4 rounded-full" />
        <div className="h-6 w-14 bg-white/4 rounded-full" />
      </div>
    </Card>
  );
}

export function UpvoteBannerSkeleton() {
  return (
    <Card variant="soft" className="p-4 md:p-5 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 bg-white/4 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 bg-white/4 rounded" />
          <div className="h-3 w-2/3 bg-white/4 rounded" />
        </div>
        <div className="h-9 w-32 bg-white/4 rounded-md shrink-0" />
      </div>
    </Card>
  );
}
