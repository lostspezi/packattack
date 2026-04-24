import { getDashboardStats } from "@/lib/dashboard/stats";
import { DashboardStatsStrip } from "./dashboard-stats-strip";

interface DashboardStatsStripAsyncProps {
  lang: string;
  userId: string;
}

export async function DashboardStatsStripAsync({ lang, userId }: DashboardStatsStripAsyncProps) {
  const stats = await getDashboardStats(userId);
  return <DashboardStatsStrip lang={lang} stats={stats} />;
}
