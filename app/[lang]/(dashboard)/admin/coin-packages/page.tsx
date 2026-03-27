import { getDictionary, Locale } from "@/lib/i18n";
import { CoinPackageManager } from "@/components/admin/coin-package-manager";

export default async function CoinPackagesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "admin");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {dict.coinPackagesTitle || "Münzpakete"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {dict.coinPackagesSubtitle ||
            "Erstelle und verwalte Münzpakete für den Shop."}
        </p>
      </div>
      <CoinPackageManager lang={lang} dict={dict} />
    </div>
  );
}
