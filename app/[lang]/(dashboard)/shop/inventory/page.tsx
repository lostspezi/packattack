import { ShopInventoryManager } from "@/components/shop/shop-inventory-manager";

export default async function ShopInventoryPage({
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
          {isDe ? "Inventar-Verwaltung" : "Inventory Management"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {isDe
            ? "Suche Karten und verwalte deinen Bestand mit Zustand und Netto-Preisen."
            : "Search cards and manage your stock with condition and net prices."}
        </p>
      </div>
      <ShopInventoryManager lang={lang} />
    </div>
  );
}
