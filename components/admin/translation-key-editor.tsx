"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface LanguageInfo {
  code: string;
  name: string;
}

interface TranslationKey {
  _id: string;
  namespace: string;
  key: string;
  values: Record<string, string>;
  updatedAt: string;
}

interface TranslationKeyEditorProps {
  namespace: string | null;
}

export function TranslationKeyEditor({ namespace }: TranslationKeyEditorProps) {
  const [keys, setKeys] = useState<TranslationKey[]>([]);
  const [languages, setLanguages] = useState<LanguageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch active languages
  useEffect(() => {
    fetch("/api/admin/languages")
      .then((res) => res.json())
      .then((data: { languages?: { code: string; name: string; isActive: boolean }[] }) => {
        const active = (data.languages ?? []).filter((l) => l.isActive);
        setLanguages(active.map((l) => ({ code: l.code, name: l.name })));
      })
      .catch(() => {
        setLanguages([{ code: "de", name: "Deutsch" }]);
      });
  }, []);

  const fetchKeys = useCallback(async () => {
    if (!namespace) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/translations?namespace=${encodeURIComponent(namespace)}`
      );
      if (!res.ok) {
        toast({ type: "error", title: "Keys konnten nicht geladen werden" });
        return;
      }
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch {
      toast({ type: "error", title: "Netzwerkfehler" });
    } finally {
      setLoading(false);
    }
  }, [namespace, toast]);

  useEffect(() => {
    setKeys([]);
    void fetchKeys();
  }, [fetchKeys]);

  function updateLocalKey(id: string, lang: string, value: string) {
    setKeys((prev) =>
      prev.map((k) =>
        k._id === id
          ? { ...k, values: { ...k.values, [lang]: value } }
          : k
      )
    );
  }

  async function saveKey(keyItem: TranslationKey) {
    if (!namespace) return;
    setSavingKey(keyItem._id);
    try {
      const res = await fetch("/api/admin/translations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namespace,
          key: keyItem.key,
          values: keyItem.values,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ type: "error", title: data.error ?? "Speichern fehlgeschlagen" });
        return;
      }
      const updated = await res.json();
      setKeys((prev) =>
        prev.map((k) => (k._id === updated._id ? updated : k))
      );
      toast({ type: "success", title: `"${keyItem.key}" gespeichert` });
    } catch {
      toast({ type: "error", title: "Netzwerkfehler" });
    } finally {
      setSavingKey(null);
    }
  }

  if (!namespace) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        Wähle einen Namespace, um Übersetzungen zu bearbeiten.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-text-primary">
          {namespace}{" "}
          <span className="text-sm font-normal text-text-muted">
            ({keys.length} Keys)
          </span>
        </h3>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted py-8 text-center">Laden…</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">
          Keine Keys in diesem Namespace.
        </p>
      ) : (
        <div className="bg-surface border border-border rounded-[14px] overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
            <table className="w-full min-w-full">
              <thead className="sticky top-0 bg-surface z-10">
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-1/4">
                    Key
                  </th>
                  {languages.map((lang) => (
                    <th
                      key={lang.code}
                      className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider"
                    >
                      {lang.code.toUpperCase()}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((keyItem) => {
                  const hasMissing = languages.some(
                    (lang) => !keyItem.values[lang.code]
                  );
                  return (
                    <tr
                      key={keyItem._id}
                      className={`border-b border-border last:border-0 ${
                        hasMissing ? "bg-yellow-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 text-xs font-mono text-text-muted align-middle">
                        {keyItem.key}
                        {hasMissing && (
                          <span className="ml-1 text-yellow-400 text-xs">⚠</span>
                        )}
                      </td>
                      {languages.map((lang) => {
                        const missing = !keyItem.values[lang.code];
                        return (
                          <td key={lang.code} className="px-2 py-2 align-middle">
                            <Input
                              value={keyItem.values[lang.code] ?? ""}
                              onChange={(e) =>
                                updateLocalKey(keyItem._id, lang.code, e.target.value)
                              }
                              onBlur={() => void saveKey(keyItem)}
                              className={`py-1 text-sm ${missing ? "border-yellow-400/50" : ""}`}
                              placeholder={`${lang.name}…`}
                            />
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 align-middle">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          loading={savingKey === keyItem._id}
                          onClick={() => void saveKey(keyItem)}
                        >
                          Save
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
