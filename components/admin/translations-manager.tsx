"use client";

import React, { useState } from "react";
import { TranslationNamespaceList } from "@/components/admin/translation-namespace-list";
import { TranslationKeyEditor } from "@/components/admin/translation-key-editor";

interface NamespaceItem {
  namespace: string;
  count: number;
}

interface TranslationsManagerProps {
  namespaces: NamespaceItem[];
}

export function TranslationsManager({ namespaces }: TranslationsManagerProps) {
  const [selected, setSelected] = useState<string | null>(
    namespaces[0]?.namespace ?? null
  );

  return (
    <div className="flex flex-col md:flex-row gap-0 bg-surface border border-border rounded-[14px] overflow-hidden min-h-[600px]">
      {/* Left panel */}
      <div className="w-full md:w-72 md:shrink-0 border-b md:border-b-0 md:border-r border-border flex flex-col md:max-h-[600px]">
        <TranslationNamespaceList
          namespaces={namespaces}
          selected={selected}
          onSelect={setSelected}
        />
      </div>

      {/* Right panel */}
      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <TranslationKeyEditor namespace={selected} />
      </div>
    </div>
  );
}
