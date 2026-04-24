"use client";

import { Card } from "@/components/ui/card";
import { useMe } from "@/components/layout/me-provider";
import { TitlePicker } from "./title-picker";

export function TitleSection({ lang }: { lang: string }) {
  const me = useMe();
  if (me?.levelSystemActive !== true) return null;
  const isDe = lang === "de";

  return (
    <Card variant="soft" className="p-4 md:p-6">
      <h3 className="text-base font-semibold text-text-primary mb-1">
        {isDe ? "Titel" : "Title"}
      </h3>
      <p className="text-sm text-text-secondary mb-4">
        {isDe
          ? "Wähle einen freigeschalteten Titel, der unter deinem Namen erscheint."
          : "Pick an unlocked title to appear below your name."}
      </p>
      <TitlePicker lang={lang} />
    </Card>
  );
}
