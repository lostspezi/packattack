import { InventoryOverviewTable } from "@/components/admin/inventory-overview-table";

export default async function AdminInventoryPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {lang === "de" ? "Globales Inventar" : "Global Inventory"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {lang === "de"
            ? "Übersicht aller Shop-Inventare. Bestand kann hier manuell überschrieben werden."
            : "Overview of all shop inventories. Stock can be overridden manually here."}
        </p>
      </div>
      <InventoryOverviewTable lang={lang} />
    </div>
  );
}
