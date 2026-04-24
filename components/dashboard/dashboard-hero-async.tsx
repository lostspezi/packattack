import { getHeroAction } from "@/lib/dashboard/hero-action";
import { DashboardHero } from "./dashboard-hero";

interface DashboardHeroAsyncProps {
  lang: string;
  userId: string;
  userName: string;
}

export async function DashboardHeroAsync({ lang, userId, userName }: DashboardHeroAsyncProps) {
  const hero = await getHeroAction(userId);
  return <DashboardHero lang={lang} userName={userName} hero={hero} />;
}
