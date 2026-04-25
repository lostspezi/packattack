import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { UpvoteCampaignTable } from "@/components/admin/upvote-campaign-table";

export default async function AdminUpvoteCampaignsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const adminDict = await getDictionary(lang as Locale, "admin");

  const pageTitle = adminDict["upvoteCampaigns_pageTitle"] ?? "Upvote campaigns";
  const pageSubtitle =
    adminDict["upvoteCampaigns_pageSubtitle"] ?? "Build card votes for the community.";

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">{pageTitle}</h2>
        <p className="text-text-secondary mt-1 text-sm">{pageSubtitle}</p>
      </div>

      <UpvoteCampaignTable lang={lang} dict={adminDict} />
    </div>
  );
}
