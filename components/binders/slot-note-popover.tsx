"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";

interface SlotNotePopoverProps {
  open: boolean;
  onClose: () => void;
  binderSlug: string;
  pageIndex: number;
  slotPosition: number;
  initialNote: string | null;
  cardName: string;
  isDe: boolean;
  onSaved: (next: string | null) => void;
  onRemoveCard: () => void;
}

export function SlotNotePopover({
  open,
  onClose,
  binderSlug,
  pageIndex,
  slotPosition,
  initialNote,
  cardName,
  isDe,
  onSaved,
  onRemoveCard,
}: SlotNotePopoverProps) {
  const [value, setValue] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue(initialNote ?? "");
  }, [initialNote, open]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function save() {
    const trimmed = value.trim();
    const nextNote = trimmed.length === 0 ? null : trimmed;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/binders/${binderSlug}/slots/note?pageIdx=${pageIndex}&slot=${slotPosition}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: nextNote }),
        },
      );
      if (res.ok) {
        onSaved(nextNote);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-90 flex items-center justify-center p-4 bg-black/40">
      <div
        ref={popoverRef}
        className="bg-surface-elevated border border-border rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-primary line-clamp-1">
              {cardName}
            </p>
            <p className="text-xs text-text-muted">
              {isDe ? "Notiz für diesen Slot" : "Note for this slot"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-secondary"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={200}
          rows={3}
          placeholder={
            isDe
              ? "z. B. mein erster Charizard, aus Battle vs. Max"
              : "e.g. my first Charizard, from battle vs. Max"
          }
          className="w-full bg-white/3 border border-white/8 text-text-primary rounded-[10px] px-3 py-2 outline-none focus:border-pa-green/35 text-sm"
        />
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>{value.length}/200</span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => {
              onRemoveCard();
              onClose();
            }}
            className="text-error hover:text-error/80 inline-flex items-center gap-1.5 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            {isDe ? "Karte zurück ins Inventar" : "Card back to inventory"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-pa-green text-bg font-bold text-sm px-4 py-1.5 rounded-lg hover:bg-pa-green-hover disabled:opacity-60 inline-flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isDe ? "Speichern" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
