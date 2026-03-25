"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { EmailTemplatePreview } from "@/components/admin/email-template-preview";

interface TemplateListItem {
  slug: string;
  name: string;
  updatedAt: string | null;
}

interface FullTemplate {
  slug: string;
  name: string;
  subject: { de: string; en: string };
  body: { de: string; en: string };
  variables: string[];
  updatedAt: string | null;
}

interface EmailTemplatesManagerProps {
  templates: TemplateListItem[];
}

export function EmailTemplatesManager({
  templates,
}: EmailTemplatesManagerProps) {
  const [selected, setSelected] = useState<string | null>(
    templates[0]?.slug ?? null
  );
  const [template, setTemplate] = useState<FullTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetch(`/api/admin/email-templates/${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then((data: FullTemplate) => setTemplate(data))
      .catch(() => toast({ type: "error", title: "Failed to load template" }))
      .finally(() => setLoading(false));
  }, [selected, toast]);

  function update(path: string, value: string) {
    if (!template) return;
    const parts = path.split(".");
    if (parts.length === 1) {
      setTemplate({ ...template, [parts[0]]: value });
    } else if (parts.length === 2) {
      const [section, lang] = parts;
      if (section === "subject" || section === "body") {
        setTemplate({
          ...template,
          [section]: { ...template[section], [lang]: value },
        });
      }
    }
  }

  async function handleSave() {
    if (!template) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/email-templates/${encodeURIComponent(template.slug)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: template.name,
            subject: template.subject,
            body: template.body,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        toast({ type: "error", title: data.error ?? "Save failed" });
        return;
      }
      const updated: FullTemplate = await res.json();
      setTemplate(updated);
      toast({ type: "success", title: "Template saved" });
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
    <div className="flex flex-col md:flex-row gap-0 bg-surface border border-border rounded-[14px] overflow-hidden min-h-[700px]">
      {/* Left: template list */}
      <div className="w-full md:w-64 md:shrink-0 border-b md:border-b-0 md:border-r border-border flex flex-col md:max-h-[700px]">
        <div className="p-3 border-b border-border">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Templates
          </p>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {templates.length === 0 ? (
            <li className="p-4 text-sm text-text-muted">No templates found.</li>
          ) : (
            templates.map((t) => (
              <li key={t.slug}>
                <button
                  onClick={() => setSelected(t.slug)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors hover:bg-white/4 ${
                    selected === t.slug
                      ? "bg-pa-green/10 text-pa-green border-r-2 border-pa-green"
                      : "text-text-primary"
                  }`}
                >
                  <p className="font-medium truncate">{t.name}</p>
                  <p className="text-xs text-text-muted mt-0.5 truncate font-mono">
                    {t.slug}
                  </p>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Right: editor + preview */}
      <div className="flex-1 p-4 md:p-6 overflow-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-64 text-text-muted text-sm">
            Select a template to edit.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-64 text-text-muted text-sm">
            Loading…
          </div>
        ) : !template ? (
          <div className="flex items-center justify-center h-64 text-text-muted text-sm">
            Failed to load template.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  {template.name}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Last updated: {formatDate(template.updatedAt)}
                </p>
              </div>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="px-4 py-2 bg-pa-green text-black text-sm font-semibold rounded-[10px] hover:bg-pa-green/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">
                Template Name
              </label>
              <Input
                value={template.name}
                onChange={(e) => update("name", e.target.value)}
                className="py-2 text-sm"
              />
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary">
                Subject
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-text-muted mb-1">DE</p>
                  <Input
                    value={template.subject.de}
                    onChange={(e) => update("subject.de", e.target.value)}
                    className="py-2 text-sm"
                    placeholder="German subject…"
                  />
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">EN</p>
                  <Input
                    value={template.subject.en}
                    onChange={(e) => update("subject.en", e.target.value)}
                    className="py-2 text-sm"
                    placeholder="English subject…"
                  />
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary">
                Body (HTML)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-text-muted mb-1">DE</p>
                  <textarea
                    value={template.body.de}
                    onChange={(e) => update("body.de", e.target.value)}
                    rows={12}
                    className="w-full bg-white/4 border border-white/8 text-text-primary text-xs font-mono rounded-[10px] px-3 py-2 outline-none focus:border-pa-green/35 resize-y"
                    placeholder="<p>German HTML body…</p>"
                  />
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">EN</p>
                  <textarea
                    value={template.body.en}
                    onChange={(e) => update("body.en", e.target.value)}
                    rows={12}
                    className="w-full bg-white/4 border border-white/8 text-text-primary text-xs font-mono rounded-[10px] px-3 py-2 outline-none focus:border-pa-green/35 resize-y"
                    placeholder="<p>English HTML body…</p>"
                  />
                </div>
              </div>
            </div>

            {/* Variables reference */}
            {template.variables.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-secondary">
                  Available Variables
                </label>
                <div className="flex flex-wrap gap-2">
                  {template.variables.map((v) => (
                    <span
                      key={v}
                      className="px-2.5 py-1 bg-white/4 border border-border rounded-full text-xs font-mono text-text-muted"
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            <EmailTemplatePreview
              body={template.body}
              variables={template.variables}
            />
          </div>
        )}
      </div>
    </div>
  );
}
