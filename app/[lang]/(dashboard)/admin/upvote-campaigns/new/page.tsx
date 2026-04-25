import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { UpvoteCampaignForm } from "@/components/admin/upvote-campaign-form";

export default async function NewUpvoteCampaignPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const adminDict = await getDictionary(lang as Locale, "admin");

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {adminDict["upvoteCampaigns_create"] ?? "Create campaign"}
        </h2>
      </div>
      <UpvoteCampaignForm lang={lang} dict={adminDict} mode="create" />
    </div>
  );
}
