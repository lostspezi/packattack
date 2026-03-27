import { getDictionary, Locale } from "@/lib/i18n";
import { InvoiceSettingsForm } from "@/components/admin/invoice-settings-form";

export default async function InvoiceSettingsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "admin");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {dict.invoiceSettingsTitle || "Rechnungseinstellungen"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {dict.invoiceSettingsSubtitle ||
            "Firmendaten und Rechnungskonfiguration für PDF-Rechnungen."}
        </p>
      </div>
      <InvoiceSettingsForm dict={dict} />
    </div>
  );
}
