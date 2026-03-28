import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { OrderDetail } from "@/components/orders/order-detail";

export default async function OrderDetailPageRoute({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const dict = await getDictionary(lang as Locale, "orders");

  return (
    <div className="space-y-6">
      <OrderDetail lang={lang} dict={dict} orderId={id} />
    </div>
  );
}
