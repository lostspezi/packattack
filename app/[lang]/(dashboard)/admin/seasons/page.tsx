import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { SeasonsManager } from "@/components/admin/seasons-manager";

export default async function AdminSeasonsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const adminDict = await getDictionary(lang as Locale, "admin");

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Battle Seasons</h2>
        <p className="text-text-secondary mt-1 text-sm">
          Seasons verwalten — Nummer, Zeitraum und Status pflegen.
        </p>
      </div>
      <SeasonsManager lang={lang} dict={adminDict} />
    </div>
  );
}
