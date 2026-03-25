"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface PlatformSettingsData {
  tosVersion: string;
  privacyVersion: string;
  updatedAt: string | null;
  consentStats: { tos: number; privacy: number };
}

interface PlatformSettingsFormProps {
  initial: PlatformSettingsData;
}

export function PlatformSettingsForm({ initial }: PlatformSettingsFormProps) {
  const [tosVersion, setTosVersion] = useState(initial.tosVersion);
  const [privacyVersion, setPrivacyVersion] = useState(initial.privacyVersion);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState(initial.consentStats);
  const [updatedAt, setUpdatedAt] = useState(initial.updatedAt);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/platform", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tosVersion, privacyVersion }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ type: "error", title: data.error ?? "Failed to save" });
        return;
      }
      const data = await res.json();
      setUpdatedAt(data.updatedAt ?? null);
      toast({ type: "success", title: "Platform settings saved" });

      // Refresh stats
      const statsRes = await fetch("/api/admin/platform");
      if (statsRes.ok) {
        const refreshed = await statsRes.json();
        setStats(refreshed.consentStats ?? { tos: 0, privacy: 0 });
      }
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  function formatDate(d: string | null) {
    if (!d) return "Never";
    try {
      return new Date(d).toLocaleString();
    } catch {
      return d;
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-surface border border-border rounded-[14px] p-6 space-y-5">
          <h3 className="text-base font-semibold text-text-primary">
            Version Numbers
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">
                Terms of Service Version
              </label>
              <Input
                value={tosVersion}
                onChange={(e) => setTosVersion(e.target.value)}
                placeholder="e.g. 1.0.0"
                className="py-2 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">
                Privacy Policy Version
              </label>
              <Input
                value={privacyVersion}
                onChange={(e) => setPrivacyVersion(e.target.value)}
                placeholder="e.g. 1.0.0"
                className="py-2 text-sm"
              />
            </div>
          </div>

          {updatedAt && (
            <p className="text-xs text-text-muted">
              Last updated: {formatDate(updatedAt)}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-pa-green text-black text-sm font-semibold rounded-[10px] hover:bg-pa-green/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </form>

      {/* Consent Stats */}
      <div className="bg-surface border border-border rounded-[14px] p-6 space-y-4">
        <h3 className="text-base font-semibold text-text-primary">
          Consent Statistics (Current Versions)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/4 rounded-[10px] p-4">
            <p className="text-xs text-text-muted mb-1">
              ToS Acceptances (v{tosVersion || "—"})
            </p>
            <p className="text-2xl font-bold text-text-primary">
              {stats.tos}
            </p>
          </div>
          <div className="bg-white/4 rounded-[10px] p-4">
            <p className="text-xs text-text-muted mb-1">
              Privacy Acceptances (v{privacyVersion || "—"})
            </p>
            <p className="text-2xl font-bold text-text-primary">
              {stats.privacy}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
