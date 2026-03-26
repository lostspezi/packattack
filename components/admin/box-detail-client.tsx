"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BoxForm, BoxFormSaveButton } from "@/components/admin/box-form";
import type { BoxFormData } from "@/components/admin/box-form";
import { BoxCardManager, ValidationRow } from "@/components/admin/box-card-manager";
import type { RarityBreakdownEntry, BoxCard } from "@/components/admin/box-card-manager";
import { PackSimulationButton } from "@/components/admin/pack-simulation-button";
import { BoxStats } from "@/components/admin/box-stats";
import { BoxPullHistory } from "@/components/admin/box-pull-history";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { AlertTriangle, XCircle, Copy } from "lucide-react";
import type { RarityWeight } from "@/components/admin/rarity-weight-editor";
import type { ValidationItem } from "@/lib/box-validation";

interface BoxData {
  _id: string;
  name: { de: string; en: string };
  description: { de: string; en: string } | null;
  game: string;
  status: "draft" | "published" | "paused" | "archived";
  priceInCoins: number;
  cardsPerPack: number;
  totalPacks: number | null;
  rarityWeights: RarityWeight[];
  coinConversionRate: number;
  packsOpened: number;
  cardsCount: number;
  createdAt: string;
}

interface BoxDetailClientProps {
  lang: string;
  dict: Record<string, string>;
  initialBox: BoxData;
}

interface StatusAction {
  to: string;
  label: string;
  deLabel: string;
  variant: "primary" | "secondary" | "danger";
}

const STATUS_ACTIONS: Record<string, StatusAction[]> = {
  draft: [
    { to: "published", label: "Publish", deLabel: "Veröffentlichen", variant: "primary" },
  ],
  published: [
    { to: "paused", label: "Pause", deLabel: "Pausieren", variant: "secondary" },
    { to: "archived", label: "Archive", deLabel: "Archivieren", variant: "danger" },
  ],
  paused: [
    { to: "published", label: "Reactivate", deLabel: "Reaktivieren", variant: "primary" },
    { to: "archived", label: "Archive", deLabel: "Archivieren", variant: "danger" },
  ],
  archived: [
    { to: "draft", label: "Restore to Draft", deLabel: "Als Entwurf wiederherstellen", variant: "secondary" },
  ],
};

function statusBadgeVariant(status: string) {
  if (status === "published") return "success" as const;
  if (status === "draft") return "warning" as const;
  if (status === "paused") return "info" as const;
  return "user" as const;
}

export function BoxDetailClient({ lang, dict, initialBox }: BoxDetailClientProps) {
  void dict;
  const isDe = lang === "de";
  const router = useRouter();
  const { toast } = useToast();

  const [box, setBox] = useState<BoxData>(initialBox);
  const [saving, setSaving] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [dupNameDe, setDupNameDe] = useState("");
  const [dupNameEn, setDupNameEn] = useState("");
  const [validationItems, setValidationItems] = useState<ValidationItem[]>([]);
  const [rarityBreakdown, setRarityBreakdown] = useState<RarityBreakdownEntry[]>([]);
  const [boxCards, setBoxCards] = useState<BoxCard[]>([]);
  const [showPublishWarnings, setShowPublishWarnings] = useState(false);
  const [publishWarnings, setPublishWarnings] = useState<string[]>([]);

  const displayName = isDe
    ? (box.name.de || box.name.en)
    : (box.name.en || box.name.de);

  async function handleSave(data: BoxFormData) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/boxes/${box._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({
          type: "error",
          title: (body as { error?: string }).error ?? "Failed to save box",
        });
        return;
      }

      const updated = await res.json() as BoxData & { _id: unknown; cards?: unknown[] };
      setBox({
        ...box,
        name: updated.name ?? box.name,
        description: updated.description ?? box.description,
        game: updated.game ?? box.game,
        priceInCoins: updated.priceInCoins ?? box.priceInCoins,
        cardsPerPack: updated.cardsPerPack ?? box.cardsPerPack,
        totalPacks: updated.totalPacks ?? box.totalPacks,
        rarityWeights: updated.rarityWeights ?? box.rarityWeights,
      });
      toast({ type: "success", title: isDe ? "Box gespeichert!" : "Box saved!" });
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(newStatus: string, force = false) {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/admin/boxes/${box._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-lang": lang },
        body: JSON.stringify({ status: newStatus, force }),
      });

      const resBody = await res.json().catch(() => ({})) as {
        error?: string;
        warnings?: string[];
        validationResults?: ValidationItem[];
      };

      if (res.status === 422 && resBody.warnings) {
        // Server returned warnings — ask user to confirm
        setPublishWarnings(resBody.warnings);
        setShowPublishWarnings(true);
        return;
      }

      if (!res.ok) {
        toast({
          type: "error",
          title: resBody.error ?? "Failed to change status",
        });
        return;
      }

      setShowPublishWarnings(false);
      setBox((prev) => ({ ...prev, status: newStatus as BoxData["status"] }));
      toast({
        type: "success",
        title: isDe ? `Status geändert: ${newStatus}` : `Status changed to: ${newStatus}`,
      });
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setStatusLoading(false);
    }
  }

  const handleValidationChange = useCallback((items: ValidationItem[]) => {
    setValidationItems(items);
  }, []);

  const handleBreakdownChange = useCallback((breakdown: RarityBreakdownEntry[]) => {
    setRarityBreakdown(breakdown);
  }, []);

  const handleCardsChange = useCallback((cards: BoxCard[]) => {
    setBoxCards(cards);
  }, []);

  const handlePackPriceSuggestion = useCallback((price: number) => {
    setBox((prev) => ({ ...prev, priceInCoins: price }));
    // Also save to API
    fetch(`/api/admin/boxes/${box._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceInCoins: price }),
    }).catch(() => {});
    toast({
      type: "info",
      title: isDe
        ? `Pack-Preis auf ${price} Coins gesetzt`
        : `Pack price set to ${price} coins`,
    });
  }, [box._id, isDe, toast]);

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/boxes/${box._id}`, { method: "DELETE" });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({
          type: "error",
          title: (body as { error?: string }).error ?? "Failed to delete box",
        });
        return;
      }

      toast({
        type: "success",
        title: isDe ? "Box gelöscht." : "Box deleted.",
      });
      router.push(`/${lang}/admin/boxes`);
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  }

  async function handleDuplicate() {
    if (!dupNameDe.trim() || !dupNameEn.trim()) return;
    setDuplicateLoading(true);
    try {
      const res = await fetch(`/api/admin/boxes/${box._id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: { de: dupNameDe.trim(), en: dupNameEn.trim() } }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ type: "error", title: (body as { error?: string }).error ?? "Failed to duplicate" });
        return;
      }
      const data = await res.json() as { _id: string };
      toast({ type: "success", title: isDe ? "Box dupliziert!" : "Box duplicated!" });
      router.push(`/${lang}/admin/boxes/${data._id}`);
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setDuplicateLoading(false);
      setShowDuplicateModal(false);
    }
  }

  function openDuplicateModal() {
    setDupNameDe(`${box.name.de} (Kopie)`);
    setDupNameEn(`${box.name.en} (Copy)`);
    setShowDuplicateModal(true);
  }

  const actions = STATUS_ACTIONS[box.status] ?? [];
  const hasBlockingErrors = (box.status === "draft" || box.status === "paused") && validationItems.some((i) => i.level === "error");

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-text-primary">{displayName}</h2>
            <Badge variant={statusBadgeVariant(box.status)}>{box.status}</Badge>
          </div>
          <p className="text-text-secondary mt-1 text-sm">
            {isDe
              ? `${box.cardsCount} Karten · ${box.packsOpened.toLocaleString()} Packs geöffnet`
              : `${box.cardsCount} cards · ${box.packsOpened.toLocaleString()} packs opened`}
          </p>
        </div>

        {/* Status + delete actions */}
        <div className="flex gap-2 flex-wrap shrink-0 items-start">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={openDuplicateModal}
          >
            <Copy className="w-4 h-4 mr-1.5" />
            {isDe ? "Duplizieren" : "Duplicate"}
          </Button>
          <PackSimulationButton
            cards={boxCards}
            cardsPerPack={box.cardsPerPack}
            priceInCoins={box.priceInCoins}
            lang={lang}
          />
          {actions.map((action) => {
            const isPublish = action.to === "published";
            const blocked = hasBlockingErrors && isPublish;
            return (
              <div key={action.to} className="flex flex-col items-end gap-1">
                <Button
                  type="button"
                  variant={action.variant}
                  size="md"
                  loading={statusLoading}
                  disabled={blocked}
                  onClick={() => void handleStatusChange(action.to)}
                >
                  {isDe ? action.deLabel : action.label}
                </Button>
                {blocked && (
                  <span className="text-[11px] text-red-400 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {isDe ? "Verteilungs-Check beheben" : "Fix distribution errors"}
                  </span>
                )}
              </div>
            );
          })}
          {box.status === "draft" && (
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={() => setShowDeleteModal(true)}
            >
              {isDe ? "Box löschen" : "Delete Box"}
            </Button>
          )}
        </div>
      </div>

      {/* Bento grid: stacked on mobile, 2-column on xl */}
      <div className="xl:grid xl:grid-cols-[1fr_420px] xl:gap-5 space-y-6 xl:space-y-0">
        {/* Left column: Cards (main workspace) */}
        <div className="space-y-6 min-w-0">
          <BoxCardManager
            boxId={box._id}
            game={box.game}
            cardsPerPack={box.cardsPerPack}
            rarityWeights={box.rarityWeights}
            lang={lang}
            dict={dict}
            onValidationChange={handleValidationChange}
            onBreakdownChange={handleBreakdownChange}
            onCardsChange={handleCardsChange}
            onPackPriceSuggestion={handlePackPriceSuggestion}
          />

          {/* Stats + Pull History (below card manager) */}
          <BoxStats boxId={box._id} lang={lang} />
          <BoxPullHistory boxId={box._id} lang={lang} />
        </div>

        {/* Right column: Live panels + Settings (sticky sidebar) */}
        <div className="xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-2rem)] xl:flex xl:flex-col space-y-4 xl:space-y-0">
          {/* Scrollable content */}
          <div className="space-y-4 xl:overflow-y-auto xl:flex-1 xl:min-h-0 xl:scrollbar-thin xl:pb-2">
            {/* Rarity Summary — always visible at top */}
            {rarityBreakdown.length > 0 && (
              <div className="bg-surface border border-border rounded-[14px] p-4 space-y-2.5">
                <h3 className="text-sm font-semibold text-text-primary">
                  {isDe ? "Rarität-Zusammenfassung" : "Rarity Summary"}
                </h3>
                <div className="space-y-2">
                  {rarityBreakdown.map((entry) => (
                    <div key={entry.rarity} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-primary font-medium">{entry.rarity}</span>
                        <span className="text-text-secondary tabular-nums">
                          {entry.percentage < 0.01
                            ? `${entry.percentage.toFixed(4)}%`
                            : entry.percentage < 1
                            ? `${entry.percentage.toFixed(3)}%`
                            : `${entry.percentage.toFixed(2)}%`}
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-pa-green/70 rounded-full transition-all"
                          style={{ width: `${Math.min(100, entry.percentage)}%`, minWidth: entry.percentage > 0 ? "2px" : "0" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-end">
                  <span className="text-[11px] text-text-muted">
                    {isDe ? "Gesamt" : "Total"}: {rarityBreakdown.reduce((a, e) => a + e.percentage, 0).toFixed(2)}%
                  </span>
                </div>
              </div>
            )}

            {/* Distribution Check */}
            {validationItems.length > 0 && (
              <div className="bg-surface border border-border rounded-[14px] p-4 space-y-2.5">
                <h3 className="text-sm font-semibold text-text-primary">
                  {isDe ? "Verteilungs-Check" : "Distribution Check"}
                </h3>
                <div className="space-y-2">
                  {validationItems.map((item, i) => (
                    <ValidationRow key={i} item={item} lang={lang} />
                  ))}
                </div>
              </div>
            )}

            {/* Box settings form */}
            <BoxForm
              lang={lang}
              dict={dict}
              initialData={{
                name: box.name,
                description: box.description ?? { de: "", en: "" },
                game: box.game,
                priceInCoins: box.priceInCoins,
                cardsPerPack: box.cardsPerPack,
                totalPacks: box.totalPacks,
                coinConversionRate: box.coinConversionRate ?? 50,
                rarityWeights: box.rarityWeights,
              }}
              onSave={(data) => void handleSave(data)}
              loading={saving}
            />
          </div>

        </div>
      </div>

      {/* Publish warnings modal */}
      <Modal
        open={showPublishWarnings}
        onClose={() => { if (!statusLoading) setShowPublishWarnings(false); }}
        title={isDe ? "Warnungen vor Veröffentlichung" : "Warnings Before Publishing"}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {isDe
              ? "Die Box hat folgende Warnungen. Möchtest du trotzdem veröffentlichen?"
              : "The box has the following warnings. Do you still want to publish?"}
          </p>
          <div className="space-y-2">
            {publishWarnings.map((w, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-yellow-500/15 bg-yellow-500/5 px-4 py-3"
              >
                <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                <span className="text-[13px] leading-relaxed text-yellow-300">{w}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={statusLoading}
              onClick={() => setShowPublishWarnings(false)}
            >
              {isDe ? "Abbrechen" : "Cancel"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={statusLoading}
              onClick={() => void handleStatusChange("published", true)}
            >
              {isDe ? "Trotzdem veröffentlichen" : "Publish anyway"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Mobile: normal save button in flow */}
      <div className="xl:hidden">
        <BoxFormSaveButton loading={saving} lang={lang} />
      </div>

      {/* Desktop: floating save bar fixed at bottom of viewport */}
      <div className="hidden xl:block fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
        <div className="pointer-events-none h-10 bg-gradient-to-t from-[var(--color-background)] to-transparent" />
        <div className="bg-[var(--color-background)] border-t border-border/50 px-6 py-3 pointer-events-auto">
          <div className="max-w-[320px] ml-auto">
            <BoxFormSaveButton loading={saving} lang={lang} />
          </div>
        </div>
      </div>

      {/* Bottom spacer only on desktop */}
      <div className="hidden xl:block h-16" />

      {/* Duplicate modal */}
      <Modal
        open={showDuplicateModal}
        onClose={() => { if (!duplicateLoading) setShowDuplicateModal(false); }}
        title={isDe ? "Box duplizieren" : "Duplicate Box"}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {isDe
              ? "Erstellt eine Kopie dieser Box mit allen Karten, Gewichten und Einstellungen als neuen Entwurf."
              : "Creates a copy of this box with all cards, weights and settings as a new draft."}
          </p>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-text-muted">
                {isDe ? "Name (Deutsch)" : "Name (German)"}
              </label>
              <Input
                value={dupNameDe}
                onChange={(e) => setDupNameDe(e.target.value)}
                className="py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-text-muted">
                {isDe ? "Name (Englisch)" : "Name (English)"}
              </label>
              <Input
                value={dupNameEn}
                onChange={(e) => setDupNameEn(e.target.value)}
                className="py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={duplicateLoading}
              onClick={() => setShowDuplicateModal(false)}
            >
              {isDe ? "Abbrechen" : "Cancel"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={duplicateLoading}
              disabled={!dupNameDe.trim() || !dupNameEn.trim()}
              onClick={() => void handleDuplicate()}
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              {isDe ? "Duplizieren" : "Duplicate"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => { if (!deleteLoading) setShowDeleteModal(false); }}
        title={isDe ? "Box löschen" : "Delete Box"}
        size="sm"
      >
        <p className="text-sm text-text-secondary mb-6">
          {isDe
            ? `Diese Aktion ist unwiderruflich. Die Box "${displayName}" wird permanent gelöscht.`
            : `This action cannot be undone. The box "${displayName}" will be permanently deleted.`}
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            variant="secondary"
            size="sm"
            disabled={deleteLoading}
            onClick={() => setShowDeleteModal(false)}
          >
            {isDe ? "Abbrechen" : "Cancel"}
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={deleteLoading}
            onClick={() => void handleDelete()}
          >
            {isDe ? "Unwiderruflich löschen" : "Delete permanently"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
