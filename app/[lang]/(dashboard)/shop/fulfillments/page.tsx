import { ShopFulfillments } from "@/components/shop/shop-fulfillments";

export default async function ShopFulfillmentsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const isDe = lang === "de";

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {isDe ? "Versandauftr\u00e4ge" : "Fulfillment Orders"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {isDe
            ? "Verwalte deine zugewiesenen Versandauftr\u00e4ge."
            : "Manage your assigned shipping orders."}
        </p>
      </div>
      <ShopFulfillments lang={lang} />
    </div>
  );
}
