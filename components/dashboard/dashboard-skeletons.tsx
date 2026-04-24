import { Card } from "@/components/ui/card";

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
