import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { BattlesList } from "@/components/battles/battles-list";
import { MatchmakingQueue } from "@/components/battles/matchmaking-queue";

export default async function BattlesPageRoute({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "battles");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {dict["pageTitle"] ?? "Battles"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {dict["pageSubtitle"] ?? "Tritt einem Battle bei oder erstelle ein neues."}
        </p>
      </div>
      <MatchmakingQueue lang={lang} dict={dict} />
      <BattlesList lang={lang} dict={dict} />
    </div>
  );
}
