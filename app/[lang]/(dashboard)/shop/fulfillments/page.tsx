import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ShopFulfillments } from "@/components/shop/shop-fulfillments";

export default async function ShopFulfillmentsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "fulfillments");

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {dict["pageTitle"] ?? "Fulfillment Orders"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {dict["pageSubtitle"] ?? "Manage your assigned shipping orders."}
        </p>
      </div>
      <ShopFulfillments lang={lang} dict={dict} />
    </div>
  );
}
