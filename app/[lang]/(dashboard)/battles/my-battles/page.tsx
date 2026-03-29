import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { User } from "lucide-react";

export default async function MyBattlesPage({
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
          {dict["myBattlesTitle"] ?? "Meine Battles"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {dict["myBattlesSubtitle"] ?? "Deine vergangenen und aktiven Battles."}
        </p>
      </div>
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <User className="h-16 w-16 text-text-secondary opacity-30" />
        <p className="text-text-secondary">
          {dict["comingSoon"] ?? "Kommt bald."}
        </p>
      </div>
    </div>
  );
}
