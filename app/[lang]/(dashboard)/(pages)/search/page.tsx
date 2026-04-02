import { Search } from "lucide-react";
import { getDictionary } from "@/lib/i18n";

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { lang } = await params;
  const { q: rawQ } = await searchParams;
  const q = rawQ?.slice(0, 200);
  const dict = await getDictionary(lang, "common");

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
        <Search className="h-8 w-8 text-text-muted" />
      </div>
      {q ? (
        <>
          <h1 className="text-xl font-semibold text-text-primary">
            {dict["search_results_for"] ?? "Suchergebnisse für"} &ldquo;{q}&rdquo;
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {dict["search_coming_soon"] ?? "Die Suchfunktion wird bald verfügbar sein."}
          </p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold text-text-primary">
            {dict["search"] ?? "Suche"}
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {dict["search_empty_hint"] ?? "Gib einen Suchbegriff ein, um Packs, Battles und mehr zu finden."}
          </p>
        </>
      )}
    </div>
  );
}
