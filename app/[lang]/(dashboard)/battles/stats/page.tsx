import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { BarChart3 } from "lucide-react";

export default async function BattleStatsPage({
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
          {dict["statsTitle"] ?? "Statistiken"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {dict["statsSubtitle"] ?? "Deine Battle-Statistiken und Fortschritte."}
        </p>
      </div>
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <BarChart3 className="h-16 w-16 text-text-secondary opacity-30" />
        <p className="text-text-secondary">
          {dict["comingSoon"] ?? "Kommt bald."}
        </p>
      </div>
    </div>
  );
}
