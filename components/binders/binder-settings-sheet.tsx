"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { BinderDTO, PlacedCardDTO } from "./binder-editor";
import { BINDER_THEMES, ThemePicker, type ThemeKey } from "./theme-picker";

interface BinderSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  binder: BinderDTO;
  placedCards: PlacedCardDTO[];
  lang: string;
  onUpdated: (next: BinderDTO) => void;
}

export function BinderSettingsSheet({
  open,
  onClose,
  binder,
  placedCards,
  lang,
  onUpdated,
}: BinderSettingsSheetProps) {
  const isDe = lang === "de";
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(binder.name);
  const [description, setDescription] = useState(binder.description);
  const [theme, setTheme] = useState<ThemeKey>(binder.theme as ThemeKey);
  const [coverPackPullId, setCoverPackPullId] = useState<string | null>(
    binder.coverPackPullId,
  );
  const [isPublic, setIsPublic] = useState(binder.isPublic);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast({
        type: "error",
        title: isDe ? "Name darf nicht leer sein." : "Name can't be empty.",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/binders/${binder.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          theme,
          coverPackPullId,
          isPublic,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          type: "error",
          title: isDe ? "Konnte nicht speichern." : "Could not save.",
          message: typeof err.error === "string" ? err.error : undefined,
        });
        return;
      }
      const data = (await res.json()) as { binder: BinderDTO };
      onUpdated(data.binder);
      toast({
        type: "success",
        title: isDe ? "Gespeichert." : "Saved.",
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function deleteBinder() {
    const confirmed = window.confirm(
      isDe
        ? `Binder "${binder.name}" wirklich löschen? Karten gehen zurück in deine Sammlung.`
        : `Delete binder "${binder.name}"? Cards return to your collection.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/binders/${binder.slug}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast({
          type: "error",
          title: isDe ? "Konnte nicht löschen." : "Could not delete.",
        });
        return;
      }
      router.push(`/${lang}/binders`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isDe ? "Einstellungen" : "Settings"}
      size="lg"
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="binder-settings-name"
            className="block text-sm font-medium text-text-secondary"
          >
            {isDe ? "Name" : "Name"}
          </label>
          <input
            id="binder-settings-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="w-full bg-white/3 border border-white/8 text-text-primary rounded-[10px] px-4 py-3 outline-none focus:border-pa-green/35"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="binder-settings-description"
            className="block text-sm font-medium text-text-secondary"
          >
            {isDe ? "Beschreibung" : "Description"}
          </label>
          <textarea
            id="binder-settings-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full bg-white/3 border border-white/8 text-text-primary rounded-[10px] px-4 py-3 outline-none focus:border-pa-green/35"
          />
        </div>

        <div className="space-y-2">
          <span className="block text-sm font-medium text-text-secondary">
            {isDe ? "Theme" : "Theme"}
          </span>
          <ThemePicker value={theme} onChange={setTheme} isDe={isDe} />
        </div>

        <div className="space-y-2">
          <span className="block text-sm font-medium text-text-secondary">
            {isDe ? "Cover" : "Cover"}
          </span>
          <CoverPicker
            placedCards={placedCards}
            value={coverPackPullId}
            onChange={setCoverPackPullId}
            isDe={isDe}
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-start gap-3 p-3 bg-white/3 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="mt-1 accent-pa-green"
            />
            <span className="text-sm">
              <span className="font-medium text-text-primary">
                {isDe ? "Öffentlich" : "Public"}
              </span>
              <span className="block text-xs text-text-muted">
                {isDe
                  ? "Andere können den Binder über einen Link öffnen und in der Galerie entdecken."
                  : "Others can open this binder via link and find it in the gallery."}
              </span>
            </span>
          </label>
          {isPublic && (
            <ShareLinkRow lang={lang} slug={binder.slug} isDe={isDe} />
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <button
            type="button"
            onClick={deleteBinder}
            disabled={deleting}
            className="text-error hover:text-error/80 inline-flex items-center gap-1.5 text-sm disabled:opacity-60"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {isDe ? "Binder löschen" : "Delete binder"}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-text-secondary hover:text-text-primary px-4 py-2"
            >
              {isDe ? "Abbrechen" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="bg-pa-green text-bg font-bold text-sm px-5 py-2 rounded-lg hover:bg-pa-green-hover disabled:opacity-60 inline-flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isDe ? "Speichern" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CoverPicker({
  placedCards,
  value,
  onChange,
  isDe,
}: {
  placedCards: PlacedCardDTO[];
  value: string | null;
  onChange: (next: string | null) => void;
  isDe: boolean;
}) {
  if (placedCards.length === 0) {
    return (
      <p className="text-xs text-text-muted">
        {isDe
          ? "Erst Karten in den Binder legen, dann kannst du eine als Cover wählen."
          : "Place cards in the binder first, then pick one as cover."}
      </p>
    );
  }
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[180px] overflow-y-auto pr-1">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={[
          "aspect-[5/7] rounded-md border bg-white/5 text-[11px] text-text-secondary flex items-center justify-center",
          value === null ? "border-pa-green ring-1 ring-pa-green/40" : "border-white/8",
        ].join(" ")}
      >
        {isDe ? "Kein Cover" : "No cover"}
      </button>
      {placedCards.map((c) => {
        const active = value === c.packPullId;
        return (
          <button
            key={c.packPullId}
            type="button"
            onClick={() => onChange(c.packPullId)}
            className={[
              "aspect-[5/7] rounded-md overflow-hidden bg-black/20 border transition-colors",
              active
                ? "border-pa-green ring-1 ring-pa-green/40"
                : "border-white/8 hover:border-white/20",
            ].join(" ")}
            title={c.name}
          >
            {c.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={c.image}
                alt={c.name}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-white/60 px-1 text-center">
                {c.name}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

void BINDER_THEMES;

function ShareLinkRow({
  lang,
  slug,
  isDe,
}: {
  lang: string;
  slug: string;
  isDe: boolean;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const path = `/${lang}/b/${slug}`;
  const fullUrl =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
  return (
    <div className="bg-white/3 rounded-lg p-3 flex items-center gap-2">
      <input
        type="text"
        readOnly
        value={fullUrl}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 bg-transparent text-xs text-text-secondary outline-none"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(fullUrl);
            setCopied(true);
            toast({
              type: "success",
              title: isDe ? "Link kopiert." : "Link copied.",
            });
            setTimeout(() => setCopied(false), 2000);
          } catch {
            toast({
              type: "error",
              title: isDe
                ? "Konnte nicht kopieren."
                : "Could not copy.",
            });
          }
        }}
        className="text-xs px-3 py-1.5 rounded-md bg-pa-green/15 text-pa-green hover:bg-pa-green/25 inline-flex items-center gap-1.5"
      >
        <Copy className="w-3.5 h-3.5" />
        {copied
          ? isDe
            ? "Kopiert"
            : "Copied"
          : isDe
            ? "Kopieren"
            : "Copy"}
      </button>
    </div>
  );
}
