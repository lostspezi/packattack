import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { BattleView } from "@/components/battles/battle-view";

export default async function BattlePageRoute({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const dict = await getDictionary(lang as Locale, "battles");
  return <BattleView lang={lang} slug={slug} dict={dict} />;
}
