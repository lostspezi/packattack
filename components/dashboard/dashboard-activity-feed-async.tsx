import { getActivitySnapshot } from "@/lib/dashboard/activity";
import { DashboardActivityFeed } from "./dashboard-activity-feed";

interface DashboardActivityFeedAsyncProps {
  userId: string;
  limit?: number;
}

export async function DashboardActivityFeedAsync({ userId, limit = 10 }: DashboardActivityFeedAsyncProps) {
  const items = await getActivitySnapshot(userId, { limit });
  return <DashboardActivityFeed initialItems={items} />;
}
