import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { CreateBattleForm } from "@/components/battles/create-battle-form";

export default async function CreateBattlePageRoute({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "battles");

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-text-primary">
        {dict["create_battle"] ?? "Battle erstellen"}
      </h2>
      <CreateBattleForm lang={lang} dict={dict} />
    </div>
  );
}
