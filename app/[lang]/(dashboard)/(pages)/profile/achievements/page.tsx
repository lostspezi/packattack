import { AchievementsTab } from "@/components/profile/achievements-tab";

export default async function ProfileAchievementsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return <AchievementsTab lang={lang} />;
}
