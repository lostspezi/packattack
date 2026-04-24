"use client";

import React, { useState } from "react";

interface EmailTemplatePreviewProps {
  body: { de: string; en: string };
  variables: string[];
}

const SAMPLE_DATA: Record<string, string> = {
  username: "MaxPacker",
  name: "Max Packer",
  email: "max@example.com",
  verifyUrl: "https://example.com/verify?token=sample",
  resetUrl: "https://example.com/reset?token=sample",
  loginUrl: "https://example.com/login",
  appName: "PACKATTACK",
  tosUrl: "https://example.com/tos",
  privacyUrl: "https://example.com/privacy",
};

function interpolate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return data[key] ?? `{{${key}}}`;
  });
}

export function EmailTemplatePreview({
  body,
  variables,
}: EmailTemplatePreviewProps) {
  const [lang, setLang] = useState<"de" | "en">("en");

  const sampleData: Record<string, string> = { ...SAMPLE_DATA };
  // Add any extra variables not in sample data
  for (const v of variables) {
    if (!sampleData[v]) {
      sampleData[v] = `[${v}]`;
    }
  }

  const html = interpolate(body[lang] ?? "", sampleData);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-text-secondary">Preview</h4>
        <div className="flex gap-1">
          {(["de", "en"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1 text-xs font-medium rounded-[6px] transition-colors ${
                lang === l
                  ? "bg-pa-green text-black"
                  : "bg-white/4 border border-border text-text-secondary hover:bg-white/8"
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <iframe
        srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;font-family:sans-serif;background:#fff;color:#111;}</style></head><body>${html}</body></html>`}
        sandbox="allow-same-origin"
        className="w-full h-96 border border-border rounded-[10px] bg-white"
        title="Email preview"
      />
    </div>
  );
}
