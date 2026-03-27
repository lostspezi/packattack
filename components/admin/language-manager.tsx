"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface LanguageItem {
  _id: string;
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
}

export function LanguageManager() {
  const [languages, setLanguages] = useState<LanguageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [updatingCode, setUpdatingCode] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchLanguages = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/languages");
      if (!res.ok) {
        toast({ type: "error", title: "Sprachen konnten nicht geladen werden" });
        return;
      }
      const data = await res.json();
      setLanguages(data.languages ?? []);
    } catch {
      toast({ type: "error", title: "Netzwerkfehler" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchLanguages();
  }, [fetchLanguages]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;

    setAdding(true);
    try {
      const res = await fetch("/api/admin/languages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: newCode.trim(), name: newName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ type: "error", title: data.error ?? "Fehler beim Hinzufügen" });
        return;
      }

      toast({ type: "success", title: `Sprache "${data.name}" hinzugefügt` });
      setNewCode("");
      setNewName("");
      await fetchLanguages();
    } catch {
      toast({ type: "error", title: "Netzwerkfehler" });
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(lang: LanguageItem) {
    setUpdatingCode(lang.code);
    try {
      const res = await fetch("/api/admin/languages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: lang.code, isActive: !lang.isActive }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ type: "error", title: data.error ?? "Fehler" });
        return;
      }

      await fetchLanguages();
    } catch {
      toast({ type: "error", title: "Netzwerkfehler" });
    } finally {
      setUpdatingCode(null);
    }
  }

  async function setDefault(lang: LanguageItem) {
    if (lang.isDefault) return;
    setUpdatingCode(lang.code);
    try {
      const res = await fetch("/api/admin/languages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: lang.code, isDefault: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ type: "error", title: data.error ?? "Fehler" });
        return;
      }

      toast({ type: "success", title: `${lang.name} ist jetzt die Standardsprache` });
      await fetchLanguages();
    } catch {
      toast({ type: "error", title: "Netzwerkfehler" });
    } finally {
      setUpdatingCode(null);
    }
  }

  async function deleteLang(lang: LanguageItem) {
    if (lang.isDefault) return;
    if (!confirm(`Sprache "${lang.name}" (${lang.code}) wirklich löschen? Alle Übersetzungen für diese Sprache werden entfernt.`)) return;

    setUpdatingCode(lang.code);
    try {
      const res = await fetch("/api/admin/languages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: lang.code }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ type: "error", title: data.error ?? "Fehler beim Löschen" });
        return;
      }

      toast({ type: "success", title: `Sprache "${lang.name}" gelöscht` });
      await fetchLanguages();
    } catch {
      toast({ type: "error", title: "Netzwerkfehler" });
    } finally {
      setUpdatingCode(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-text-muted py-8 text-center">Laden…</p>;
  }

  return (
    <div className="space-y-6">
      {/* Languages table */}
      <div className="bg-surface border border-border rounded-[14px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody>
              {languages.map((lang) => (
                <tr key={lang.code} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-sm font-mono text-text-primary">
                    {lang.code.toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-primary">
                    {lang.name}
                    {lang.isDefault && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-pa-green/10 text-pa-green border border-pa-green/20">
                        Standard
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        lang.isActive
                          ? "bg-green-500/10 text-green-400"
                          : "bg-red-500/10 text-red-400",
                      ].join(" ")}
                    >
                      {lang.isActive ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => toggleActive(lang)}
                        loading={updatingCode === lang.code}
                        disabled={lang.isDefault && lang.isActive}
                      >
                        {lang.isActive ? "Deaktivieren" : "Aktivieren"}
                      </Button>
                      {!lang.isDefault && (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setDefault(lang)}
                            loading={updatingCode === lang.code}
                          >
                            Als Standard
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => deleteLang(lang)}
                            loading={updatingCode === lang.code}
                          >
                            Löschen
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {languages.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-text-muted">
                    Keine Sprachen vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add language form */}
      <div className="bg-surface border border-border rounded-[14px] p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Sprache hinzufügen</h3>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
          <Input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="Code (z.B. en)"
            className="sm:w-32"
            maxLength={5}
          />
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (z.B. English)"
            className="sm:flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={adding}
            disabled={!newCode.trim() || !newName.trim()}
          >
            Hinzufügen
          </Button>
        </form>
      </div>
    </div>
  );
}
