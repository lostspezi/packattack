import { ShopsTable } from "@/components/admin/shops-table";

export default async function AdminShopsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {lang === "de" ? "Shop-Bewerbungen" : "Shop Applications"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {lang === "de"
            ? "Prüfe und verwalte Shop-Bewerbungen."
            : "Review and manage shop applications."}
        </p>
      </div>
      <ShopsTable lang={lang} />
    </div>
  );
}
