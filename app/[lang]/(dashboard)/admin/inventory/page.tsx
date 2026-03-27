import { ShopInventoryManager } from "@/components/shop/shop-inventory-manager";

export default async function AdminInventoryPage({
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
          {isDe ? "Plattform-Inventar" : "Platform Inventory"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {isDe
            ? "Verwalte den eigenen Kartenbestand der Plattform."
            : "Manage the platform's own card stock."}
        </p>
      </div>
      <ShopInventoryManager lang={lang} />
    </div>
  );
}
