"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
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
  const [newKeyName, setNewKeyName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDe, setNewDe] = useState("");
  const [newEn, setNewEn] = useState("");
  const [addingKey, setAddingKey] = useState(false);
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
    setShowAddForm(false);
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

  async function handleAddKey(e: React.FormEvent) {
    e.preventDefault();
    if (!namespace || !newKeyName.trim()) return;
    setAddingKey(true);
    try {
      const res = await fetch("/api/admin/translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namespace,
          key: newKeyName.trim(),
          values: { de: newDe, en: newEn },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ type: "error", title: data.error ?? "Failed to add key" });
        return;
      }
      const created = await res.json();
      setKeys((prev) => [...prev, created]);
      setNewKeyName("");
      setNewDe("");
      setNewEn("");
      setShowAddForm(false);
      toast({ type: "success", title: `Added "${created.key}"` });
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setAddingKey(false);
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
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="px-3 py-1.5 bg-pa-green text-black text-xs font-semibold rounded-[8px] hover:bg-pa-green/85 transition-colors"
        >
          + Add key
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddKey}
          className="bg-surface border border-border rounded-[12px] p-4 space-y-3"
        >
          <h4 className="text-sm font-medium text-text-secondary">New Translation Key</h4>
          <Input
            placeholder="Key name (e.g. greeting_title)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="py-1.5 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">DE</label>
              <Input
                placeholder="German"
                value={newDe}
                onChange={(e) => setNewDe(e.target.value)}
                className="py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">EN</label>
              <Input
                placeholder="English"
                value={newEn}
                onChange={(e) => setNewEn(e.target.value)}
                className="py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addingKey || !newKeyName.trim()}
              className="px-3 py-1.5 bg-pa-green text-black text-xs font-semibold rounded-[8px] hover:bg-pa-green/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingKey ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 bg-white/4 border border-border text-text-secondary text-xs rounded-[8px] hover:bg-white/8 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-text-muted py-8 text-center">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">
          No keys in this namespace.
        </p>
      ) : (
        <div className="bg-surface border border-border rounded-[14px] overflow-hidden">
          <div className="overflow-y-auto max-h-[600px]">
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
                        <button
                          onClick={() => void saveKey(keyItem)}
                          disabled={savingKey === keyItem._id}
                          className="px-2.5 py-1 bg-white/4 border border-border text-text-secondary text-xs rounded-[6px] hover:bg-white/8 transition-colors disabled:opacity-50"
                        >
                          {savingKey === keyItem._id ? "…" : "Save"}
                        </button>
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
