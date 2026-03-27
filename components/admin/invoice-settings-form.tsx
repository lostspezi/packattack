"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";

interface InvoiceSettingsFormProps {
  dict: Record<string, string>;
}

export function InvoiceSettingsForm({ dict }: InvoiceSettingsFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    street: "",
    zip: "",
    city: "",
    country: "Deutschland",
    taxId: "",
    taxRate: 19,
    email: "",
    phone: "",
    website: "",
    invoicePrefix: "PA",
    footerDe: "",
    footerEn: "",
    iban: "",
    bic: "",
    bankName: "",
  });

  useEffect(() => {
    fetch("/api/admin/invoice-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setForm({
            companyName: data.companyName || "",
            street: data.companyAddress?.street || "",
            zip: data.companyAddress?.zip || "",
            city: data.companyAddress?.city || "",
            country: data.companyAddress?.country || "Deutschland",
            taxId: data.taxId || "",
            taxRate: data.taxRate ?? 19,
            email: data.email || "",
            phone: data.phone || "",
            website: data.website || "",
            invoicePrefix: data.invoicePrefix || "PA",
            footerDe: data.footerText?.de || "",
            footerEn: data.footerText?.en || "",
            iban: data.bankDetails?.iban || "",
            bic: data.bankDetails?.bic || "",
            bankName: data.bankDetails?.bankName || "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      companyName: form.companyName,
      companyAddress: {
        street: form.street,
        zip: form.zip,
        city: form.city,
        country: form.country,
      },
      taxId: form.taxId,
      taxRate: form.taxRate,
      email: form.email,
      phone: form.phone || null,
      website: form.website || null,
      invoicePrefix: form.invoicePrefix,
      footerText:
        form.footerDe || form.footerEn
          ? { de: form.footerDe, en: form.footerEn }
          : null,
      bankDetails:
        form.iban
          ? { iban: form.iban, bic: form.bic, bankName: form.bankName }
          : null,
    };

    try {
      const res = await fetch("/api/admin/invoice-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast({
          type: "success",
          title: dict.settingsSaved || "Einstellungen gespeichert",
        });
      } else {
        const data = await res.json();
        toast({
          type: "error",
          title: dict.error || "Fehler",
          message: data.error,
        });
      }
    } catch {
      toast({ type: "error", title: "Fehler" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-text-secondary text-center py-8">
        {dict.loading || "Laden..."}
      </div>
    );
  }

  const inputClass =
    "w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-pa-green focus:outline-none";
  const labelClass = "text-text-secondary text-xs mb-1 block";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Company Info */}
      <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <h3 className="text-white font-bold text-sm">
          {dict.companyInfo || "Firmendaten"}
        </h3>
        <div>
          <label className={labelClass}>
            {dict.companyName || "Firmenname"}
          </label>
          <input
            className={inputClass}
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className={labelClass}>{dict.street || "Straße"}</label>
            <input
              className={inputClass}
              value={form.street}
              onChange={(e) => setForm({ ...form, street: e.target.value })}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{dict.zip || "PLZ"}</label>
            <input
              className={inputClass}
              value={form.zip}
              onChange={(e) => setForm({ ...form, zip: e.target.value })}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{dict.city || "Stadt"}</label>
            <input
              className={inputClass}
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{dict.country || "Land"}</label>
            <input
              className={inputClass}
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>USt-IdNr</label>
            <input
              className={inputClass}
              value={form.taxId}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
              placeholder="DE123456789"
              required
            />
          </div>
          <div>
            <label className={labelClass}>
              {dict.taxRate || "Steuersatz"} (%)
            </label>
            <input
              type="number"
              className={inputClass}
              value={form.taxRate}
              onChange={(e) =>
                setForm({ ...form, taxRate: parseFloat(e.target.value) || 0 })
              }
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>E-Mail</label>
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{dict.phone || "Telefon"}</label>
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Bank Details */}
      <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <h3 className="text-white font-bold text-sm">
          {dict.bankDetails || "Bankdaten"} ({dict.optional || "optional"})
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>IBAN</label>
            <input
              className={inputClass}
              value={form.iban}
              onChange={(e) => setForm({ ...form, iban: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>BIC</label>
            <input
              className={inputClass}
              value={form.bic}
              onChange={(e) => setForm({ ...form, bic: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>{dict.bankName || "Bank"}</label>
            <input
              className={inputClass}
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Invoice Config */}
      <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <h3 className="text-white font-bold text-sm">
          {dict.invoiceConfig || "Rechnungskonfiguration"}
        </h3>
        <div>
          <label className={labelClass}>
            {dict.invoicePrefix || "Rechnungspräfix"}
          </label>
          <input
            className={inputClass}
            value={form.invoicePrefix}
            onChange={(e) =>
              setForm({ ...form, invoicePrefix: e.target.value })
            }
            maxLength={10}
            required
          />
          <span className="text-text-muted text-xs mt-0.5 block">
            z.B. "PA" → PA-2026-000001
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Footer (DE)</label>
            <textarea
              className={inputClass}
              value={form.footerDe}
              onChange={(e) => setForm({ ...form, footerDe: e.target.value })}
              rows={2}
            />
          </div>
          <div>
            <label className={labelClass}>Footer (EN)</label>
            <textarea
              className={inputClass}
              value={form.footerEn}
              onChange={(e) => setForm({ ...form, footerEn: e.target.value })}
              rows={2}
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="bg-pa-green text-bg font-bold text-sm px-6 py-2 rounded-lg hover:bg-pa-green-hover transition-colors disabled:opacity-50"
        >
          {saving
            ? dict.saving || "Speichern..."
            : dict.save || "Speichern"}
        </button>
      </div>
    </form>
  );
}
