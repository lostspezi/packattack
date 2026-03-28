import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { AdminOrders } from "@/components/admin/admin-orders";

export default async function AdminOrdersPage({
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
          {adminDict["orders_pageTitle"] ?? "Bestellungen"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {adminDict["orders_pageSubtitle"] ?? "Alle Bestellungen verwalten und Status \u00fcberwachen."}
        </p>
      </div>
      <AdminOrders lang={lang} dict={adminDict} />
    </div>
  );
}
