"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { BoxForm } from "@/components/admin/box-form";
import type { BoxFormData } from "@/components/admin/box-form";
import { BoxCardManager } from "@/components/admin/box-card-manager";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import type { RarityWeight } from "@/components/admin/rarity-weight-editor";

interface BoxData {
  _id: string;
  name: { de: string; en: string };
  description: { de: string; en: string } | null;
  game: string;
  status: "draft" | "published" | "archived";
  priceInCoins: number;
  cardsPerPack: number;
  totalPacks: number | null;
  rarityWeights: RarityWeight[];
  packsOpened: number;
  cardsCount: number;
  createdAt: string;
}

interface BoxDetailClientProps {
  lang: string;
  dict: Record<string, string>;
  initialBox: BoxData;
}

const STATUS_TRANSITIONS: Record<string, { to: string; label: string; deLabel: string; variant: "primary" | "secondary" | "danger" }> = {
  draft: { to: "published", label: "Publish", deLabel: "Veröffentlichen", variant: "primary" },
  published: { to: "archived", label: "Archive", deLabel: "Archivieren", variant: "secondary" },
  archived: { to: "draft", label: "Restore to Draft", deLabel: "Als Entwurf wiederherstellen", variant: "secondary" },
};

function statusBadgeVariant(status: string) {
  if (status === "published") return "success" as const;
  if (status === "draft") return "warning" as const;
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

  async function handleStatusChange(newStatus: string) {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/admin/boxes/${box._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({
          type: "error",
          title: (body as { error?: string }).error ?? "Failed to change status",
        });
        return;
      }

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

  const transition = STATUS_TRANSITIONS[box.status];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
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
        <div className="flex gap-2 flex-wrap shrink-0">
          {transition && (
            <Button
              type="button"
              variant={transition.variant}
              size="md"
              loading={statusLoading}
              onClick={() => void handleStatusChange(transition.to)}
            >
              {isDe ? transition.deLabel : transition.label}
            </Button>
          )}
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

      {/* Edit form */}
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
          rarityWeights: box.rarityWeights,
        }}
        onSave={(data) => void handleSave(data)}
        loading={saving}
      />

      {/* Card manager */}
      <BoxCardManager
        boxId={box._id}
        game={box.game}
        rarityWeights={box.rarityWeights}
        lang={lang}
        dict={dict}
      />

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
