import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { OrdersList } from "@/components/orders/orders-list";

export default async function OrdersPageRoute({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "orders");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {dict.pageTitle || "Bestellungen"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {dict.pageSubtitle ||
            "Deine Bestellhistorie und Versandstatus."}
        </p>
      </div>
      <OrdersList lang={lang} dict={dict} />
    </div>
  );
}
