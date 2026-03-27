"use client";

import React, { useState, useEffect } from "react";

interface ShopProfileData {
  status: "pending" | "approved" | "rejected";
  companyName: string;
  rejectReason: string | null;
  submittedAt: string;
}

export function ShopApplyForm({ lang }: { lang: string }) {
  const isDe = lang === "de";
  const [profile, setProfile] = useState<ShopProfileData | null | undefined>(undefined);
  const [companyName, setCompanyName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/shop/profile")
      .then((r) => r.json())
      .then((d: { profile: ShopProfileData | null }) => setProfile(d.profile))
      .catch(() => setProfile(null));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError(isDe ? "Bitte Gewerbenachweis hochladen" : "Please upload your business license");
      return;
    }
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append("companyName", companyName);
    fd.append("file", file);
    try {
      const res = await fetch("/api/shop/apply", { method: "POST", body: fd });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Fehler");
      } else {
        setSuccess(true);
        setProfile({
          status: "pending",
          companyName,
          rejectReason: null,
          submittedAt: new Date().toISOString(),
        });
      }
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }

  if (profile === undefined) return null;

  if (profile?.status === "approved") {
    return (
      <p className="text-sm text-success">
        {isDe ? "Dein Shop wurde freigeschaltet." : "Your shop has been approved."}
      </p>
    );
  }

  if (profile?.status === "pending") {
    return (
      <p className="text-sm text-text-secondary">
        {isDe
          ? "Deine Bewerbung wird geprüft. Wir melden uns bei dir."
          : "Your application is under review. We'll get back to you."}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {profile?.status === "rejected" && (
        <div className="rounded-lg border border-error/20 bg-error/10 p-3 text-sm text-error">
          {isDe ? "Abgelehnt" : "Rejected"}: {profile.rejectReason}
        </div>
      )}
      {success && (
        <p className="text-sm text-success">
          {isDe ? "Bewerbung eingereicht!" : "Application submitted!"}
        </p>
      )}
      {error && <p className="text-sm text-error">{error}</p>}

      <div className="space-y-1">
        <label className="text-sm font-medium text-text-primary">
          {isDe ? "Firmenname" : "Company name"}
        </label>
        <input
          type="text"
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={isDe ? "Musterfirma GmbH" : "Acme Corp"}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-text-primary">
          {isDe ? "Gewerbenachweis" : "Business license"}{" "}
          <span className="text-text-secondary font-normal">(PDF, PNG, JPG · max 5 MB)</span>
        </label>
        <input
          type="file"
          required
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-text-secondary file:mr-3 file:rounded file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text-primary"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading
          ? isDe ? "Wird gesendet…" : "Submitting…"
          : isDe ? "Bewerbung einreichen" : "Submit application"}
      </button>
    </form>
  );
}
