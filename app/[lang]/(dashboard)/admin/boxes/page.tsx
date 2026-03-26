import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { BoxTable } from "@/components/admin/box-table";

export default async function AdminBoxesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  const adminDict = await getDictionary(lang as Locale, "admin");

  const pageTitle = adminDict["boxes_pageTitle"] ?? "Box Management";
  const pageSubtitle =
    adminDict["boxes_pageSubtitle"] ?? "Create and manage pack boxes.";

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">{pageTitle}</h2>
        <p className="text-text-secondary mt-1 text-sm">{pageSubtitle}</p>
      </div>

      <BoxTable lang={lang} dict={adminDict} />
    </div>
  );
}
