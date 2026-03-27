"use client";

import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Upload } from "lucide-react";

interface ShopProfileData {
  status: "pending" | "approved" | "rejected";
  companyName: string;
  rejectReason: string | null;
  submittedAt: string;
}

export function ShopApplyForm({ lang }: { lang: string }) {
  const isDe = lang === "de";
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<ShopProfileData | null | undefined>(undefined);
  const [companyName, setCompanyName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSmallBusiness, setIsSmallBusiness] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/shop/profile")
      .then((r) => r.json())
      .then((d: { profile: ShopProfileData | null }) => setProfile(d.profile))
      .catch(() => setProfile(null));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast({
        type: "error",
        title: isDe ? "Bitte Gewerbenachweis hochladen" : "Please upload your business license",
      });
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.append("companyName", companyName);
    fd.append("file", file);
    fd.append("isSmallBusiness", isSmallBusiness ? "true" : "false");
    try {
      const res = await fetch("/api/shop/apply", { method: "POST", body: fd });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast({ type: "error", title: data.error ?? "Fehler" });
      } else {
        toast({
          type: "success",
          title: isDe ? "Bewerbung eingereicht!" : "Application submitted!",
        });
        setProfile({
          status: "pending",
          companyName,
          rejectReason: null,
          submittedAt: new Date().toISOString(),
        });
      }
    } catch {
      toast({ type: "error", title: "Netzwerkfehler" });
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {profile?.status === "rejected" && (
        <div className="rounded-[10px] border border-error/20 bg-error/10 p-3 text-sm text-error">
          {isDe ? "Abgelehnt" : "Rejected"}: {profile.rejectReason}
        </div>
      )}

      <Input
        label={isDe ? "Firmenname" : "Company name"}
        required
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        placeholder={isDe ? "Musterfirma GmbH" : "Acme Corp"}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-text-secondary text-sm font-medium">
          {isDe ? "Gewerbenachweis" : "Business license"}{" "}
          <span className="font-normal text-text-muted">(PDF, PNG, JPG · max 5 MB)</span>
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 bg-white/3 border border-white/8 rounded-[10px] px-4 py-3 text-sm text-text-secondary hover:border-white/16 transition-colors cursor-pointer text-left"
        >
          <Upload className="w-4 h-4 flex-shrink-0 text-text-muted" />
          {file ? (
            <span className="text-text-primary truncate">{file.name}</span>
          ) : (
            <span>{isDe ? "Datei auswählen…" : "Choose file…"}</span>
          )}
        </button>
      </div>

      <Checkbox
        id="isSmallBusiness"
        label={
          isDe
            ? "Ich unterliege der Kleinunternehmerregelung (§19 UStG)"
            : "I am subject to the small business regulation (§19 UStG)"
        }
        checked={isSmallBusiness}
        onCheckedChange={setIsSmallBusiness}
      />

      <Button type="submit" variant="primary" size="md" loading={loading} className="w-full md:w-auto">
        {isDe ? "Bewerbung einreichen" : "Submit application"}
      </Button>
    </form>
  );
}
