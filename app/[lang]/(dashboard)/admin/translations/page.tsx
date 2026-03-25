import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import connectDB from "@/lib/db";
import Translation from "@/models/translation";
import { TranslationsManager } from "@/components/admin/translations-manager";

export default async function AdminTranslationsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  const [adminDict] = await Promise.all([
    getDictionary(lang as Locale, "admin"),
  ]);

  await connectDB();

  const aggregation = await Translation.aggregate([
    { $group: { _id: "$namespace", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const namespaces = aggregation.map((item) => ({
    namespace: item._id as string,
    count: item.count as number,
  }));

  const pageTitle = adminDict["translations_pageTitle"] ?? "Translation Management";
  const pageSubtitle =
    adminDict["translations_pageSubtitle"] ??
    "Manage translation keys across all namespaces.";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">{pageTitle}</h2>
        <p className="text-text-secondary mt-1 text-sm">{pageSubtitle}</p>
      </div>

      <TranslationsManager namespaces={namespaces} />
    </div>
  );
}
