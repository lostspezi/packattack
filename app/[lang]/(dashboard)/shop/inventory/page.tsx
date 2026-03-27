import { ShopInventoryTable } from "@/components/shop/shop-inventory-table";

export default async function ShopInventoryPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const isDe = lang === "de";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {isDe ? "Mein Inventar" : "My Inventory"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {isDe
            ? "Verwalte deinen Kartenbestand. Verfügbare Karten werden automatisch als Ersatz in Boxen verwendet."
            : "Manage your card stock. Available cards are automatically used as substitutes in boxes."}
        </p>
      </div>
      <ShopInventoryTable lang={lang} />
    </div>
  );
}
