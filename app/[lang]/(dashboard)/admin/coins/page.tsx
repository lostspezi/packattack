import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { CoinManager } from "@/components/admin/coin-manager";

export default async function AdminCoinsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "admin");

  void dict;
  const isDe = lang === "de";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {isDe ? "Coin-Verwaltung" : "Coin Management"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {isDe
            ? "Coins an User zuweisen oder abziehen. Alle Transaktionen werden protokolliert."
            : "Grant or deduct coins from users. All transactions are logged."}
        </p>
      </div>

      <CoinManager lang={lang} />
    </div>
  );
}
