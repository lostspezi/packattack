import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { Archive } from "lucide-react";

export default async function BattlesArchivePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "battles");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {dict["archiveTitle"] ?? "Archiv"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {dict["archiveSubtitle"] ?? "Vergangene Battles durchsuchen und ansehen."}
        </p>
      </div>
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <Archive className="h-16 w-16 text-text-secondary opacity-30" />
        <p className="text-text-secondary">
          {dict["comingSoon"] ?? "Kommt bald."}
        </p>
      </div>
    </div>
  );
}
