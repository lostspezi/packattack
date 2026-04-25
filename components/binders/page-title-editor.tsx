"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

interface PageTitleEditorProps {
  pageIndex: number;
  initialTitle: string | null;
  binderSlug: string;
  isDe: boolean;
  onSaved: (next: string | null) => void;
}

export function PageTitleEditor({
  pageIndex,
  initialTitle,
  binderSlug,
  isDe,
  onSaved,
}: PageTitleEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialTitle ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialTitle ?? "");
  }, [initialTitle]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function commit() {
    const trimmed = value.trim();
    const nextTitle = trimmed.length === 0 ? null : trimmed;
    if (nextTitle === (initialTitle ?? null)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/binders/${binderSlug}/pages/${pageIndex}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: nextTitle }),
        },
      );
      if (res.ok) {
        onSaved(nextTitle);
      } else {
        setValue(initialTitle ?? "");
      }
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        maxLength={60}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setValue(initialTitle ?? "");
            setEditing(false);
          }
        }}
        disabled={saving}
        placeholder={isDe ? "Seitentitel" : "Page title"}
        className="text-sm font-semibold bg-white/5 border border-white/10 text-text-primary rounded-md px-2 py-0.5 outline-none focus:border-pa-green/40 w-40"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-sm font-semibold text-text-secondary hover:text-text-primary inline-flex items-center gap-1 group"
    >
      <span>
        {initialTitle ?? (
          <span className="italic text-text-muted">
            {isDe ? "Seitentitel" : "Page title"}
          </span>
        )}
      </span>
      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
