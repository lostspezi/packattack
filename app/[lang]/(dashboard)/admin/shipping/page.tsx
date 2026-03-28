import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ShippingTiersManager } from "@/components/admin/shipping-tiers-manager";

export default async function AdminShippingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const adminDict = await getDictionary(lang as Locale, "admin");

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {adminDict["shipping_pageTitle"] ?? "Versandkosten"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {adminDict["shipping_pageSubtitle"] ?? "Versandkosten-Staffeln nach Land und Kartenanzahl verwalten."}
        </p>
      </div>
      <ShippingTiersManager lang={lang} dict={adminDict} />
    </div>
  );
}
