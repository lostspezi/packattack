"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";

interface NamespaceItem {
  namespace: string;
  count: number;
}

interface TranslationNamespaceListProps {
  namespaces: NamespaceItem[];
  selected: string | null;
  onSelect: (namespace: string) => void;
}

export function TranslationNamespaceList({
  namespaces,
  selected,
  onSelect,
}: TranslationNamespaceListProps) {
  const [search, setSearch] = useState("");

  const filtered = namespaces.filter((n) =>
    n.namespace.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <Input
          placeholder="Search namespaces…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="py-1.5 text-sm"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-text-muted">No namespaces found.</p>
        ) : (
          <ul>
            {filtered.map((item) => (
              <li key={item.namespace}>
                <button
                  onClick={() => onSelect(item.namespace)}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-sm transition-colors hover:bg-white/4 ${
                    selected === item.namespace
                      ? "bg-pa-green/10 text-pa-green border-r-2 border-pa-green"
                      : "text-text-primary"
                  }`}
                >
                  <span className="font-medium truncate">{item.namespace}</span>
                  <span className="ml-2 text-xs text-text-muted shrink-0">
                    {item.count}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
