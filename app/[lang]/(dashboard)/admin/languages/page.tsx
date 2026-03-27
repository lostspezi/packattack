import { getDictionary } from "@/lib/i18n";
import { LanguageManager } from "@/components/admin/language-manager";

export default async function AdminLanguagesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const adminDict = await getDictionary(lang, "admin");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {adminDict["languages_pageTitle"] ?? "Sprachverwaltung"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {adminDict["languages_pageSubtitle"] ?? "Verfügbare Sprachen der Plattform verwalten."}
        </p>
      </div>

      <LanguageManager />
    </div>
  );
}
