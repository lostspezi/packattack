import { getDictionary, Locale } from "@/lib/i18n";
import { BalancePage } from "@/components/balance/balance-page";

export default async function BalancePageRoute({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "balance");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {dict.pageTitle || "Guthaben"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {dict.pageSubtitle ||
            "Verwalte dein Guthaben und lade Münzen auf."}
        </p>
      </div>
      <BalancePage lang={lang} dict={dict} />
    </div>
  );
}
