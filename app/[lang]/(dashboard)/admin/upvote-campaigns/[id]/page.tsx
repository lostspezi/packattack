import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { UpvoteCampaignDetail } from "@/components/admin/upvote-campaign-detail";

export default async function UpvoteCampaignDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const adminDict = await getDictionary(lang as Locale, "admin");

  return <UpvoteCampaignDetail lang={lang} dict={adminDict} id={id} />;
}
