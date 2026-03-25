import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { AdminStats } from "@/components/admin/admin-stats";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  const adminDict = await getDictionary(lang as Locale, "admin");

  const pageTitle = adminDict["pageTitle"] ?? "Admin Dashboard";
  const pageSubtitle = adminDict["pageSubtitle"] ?? "Overview of platform stats.";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">{pageTitle}</h2>
        <p className="text-text-secondary mt-1 text-sm">{pageSubtitle}</p>
      </div>

      <AdminStats />
    </div>
  );
}
