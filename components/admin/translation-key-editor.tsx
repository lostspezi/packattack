"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface TranslationKey {
  _id: string;
  namespace: string;
  key: string;
  values: { de: string; en: string };
  updatedAt: string;
}

interface TranslationKeyEditorProps {
  namespace: string | null;
}

export function TranslationKeyEditor({ namespace }: TranslationKeyEditorProps) {
  const [keys, setKeys] = useState<TranslationKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchKeys = useCallback(async () => {
    if (!namespace) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/translations?namespace=${encodeURIComponent(namespace)}`
      );
      if (!res.ok) {
        toast({ type: "error", title: "Failed to load keys" });
        return;
      }
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setLoading(false);
    }
  }, [namespace, toast]);

  useEffect(() => {
    setKeys([]);
    void fetchKeys();
  }, [fetchKeys]);

  function updateLocalKey(
    id: string,
    lang: "de" | "en",
    value: string
  ) {
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
        toast({ type: "error", title: data.error ?? "Save failed" });
        return;
      }
      const updated = await res.json();
      setKeys((prev) =>
        prev.map((k) => (k._id === updated._id ? updated : k))
      );
      toast({ type: "success", title: `Saved "${keyItem.key}"` });
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setSavingKey(null);
    }
  }

  if (!namespace) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        Select a namespace to edit translations.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-text-primary">
          {namespace}{" "}
          <span className="text-sm font-normal text-text-muted">
            ({keys.length} keys)
          </span>
        </h3>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted py-8 text-center">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">
          No keys in this namespace.
        </p>
      ) : (
        <div className="bg-surface border border-border rounded-[14px] overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
            <table className="w-full min-w-full">
              <thead className="sticky top-0 bg-surface z-10">
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-1/3">
                    Key
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    DE
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    EN
                  </th>
                  <th className="px-4 py-2.5 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((keyItem) => {
                  const missingDe = !keyItem.values.de;
                  const missingEn = !keyItem.values.en;
                  const hasMissing = missingDe || missingEn;
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
                      <td className="px-2 py-2 align-middle">
                        <Input
                          value={keyItem.values.de}
                          onChange={(e) =>
                            updateLocalKey(keyItem._id, "de", e.target.value)
                          }
                          onBlur={() => void saveKey(keyItem)}
                          className={`py-1 text-sm ${missingDe ? "border-yellow-400/50" : ""}`}
                          placeholder="German…"
                        />
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <Input
                          value={keyItem.values.en}
                          onChange={(e) =>
                            updateLocalKey(keyItem._id, "en", e.target.value)
                          }
                          onBlur={() => void saveKey(keyItem)}
                          className={`py-1 text-sm ${missingEn ? "border-yellow-400/50" : ""}`}
                          placeholder="English…"
                        />
                      </td>
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
