"use client";

import { useState, useEffect, useCallback, type CSSProperties, type PointerEvent } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Edit2, Trash2, ArrowUpDown, GripVertical } from "lucide-react";
import { CoinPackageForm } from "./coin-package-form";
import { useToast } from "@/components/ui/toast";

interface CoinPackageData {
  _id: string;
  name: { de: string; en: string };
  baseCoins: number;
  bonusCoins: number;
  priceEurCents: number;
  isActive: boolean;
  sortOrder: number;
  icon: string | null;
  highlightLabel: { de: string; en: string } | null;
  stripePriceId: string | null;
}

interface CoinPackageManagerProps {
  lang: string;
  dict: Record<string, string>;
}

interface SortablePackageRowProps {
  pkg: CoinPackageData;
  lang: string;
  dict: Record<string, string>;
  savingOrder: boolean;
  onEdit: (pkg: CoinPackageData) => void;
  onDelete: (id: string) => void;
}

function SortablePackageRow({
  pkg,
  lang,
  dict,
  savingOrder,
  onEdit,
  onDelete,
}: SortablePackageRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: pkg._id,
    disabled: savingOrder,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: isDragging ? "relative" : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={[
        "border-b border-border last:border-0 transition-colors touch-none",
        isDragging ? "bg-surface-elevated/80" : "",
        savingOrder ? "cursor-wait" : "cursor-grab active:cursor-grabbing",
      ].join(" ")}
    >
      <td className="p-3 text-text-secondary">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-text-muted" />
          <span>{pkg.sortOrder}</span>
        </div>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <span>{pkg.icon || "🪙"}</span>
          <span className="text-white font-medium">
            {lang === "en" ? pkg.name.en : pkg.name.de}
          </span>
        </div>
      </td>
      <td className="p-3 text-right text-white font-mono">{pkg.baseCoins}</td>
      <td className="p-3 text-right text-pa-green font-mono">
        {pkg.bonusCoins > 0 ? `+${pkg.bonusCoins}` : "-"}
      </td>
      <td className="p-3 text-right text-white font-mono">
        {(pkg.priceEurCents / 100).toFixed(2)} €
      </td>
      <td className="p-3 text-center">
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            pkg.isActive
              ? "bg-pa-green/10 text-pa-green"
              : "bg-error/10 text-error"
          }`}
        >
          {pkg.isActive ? dict.active || "Aktiv" : dict.inactive || "Inaktiv"}
        </span>
      </td>
      <td className="p-3 text-center">
        <span
          className={`text-xs ${
            pkg.stripePriceId ? "text-pa-green" : "text-warning"
          }`}
        >
          {pkg.stripePriceId ? "✓" : "⚠"}
        </span>
      </td>
      <td className="p-3 text-right">
        <div className="flex justify-end gap-2">
          <button
            disabled={savingOrder}
            onPointerDown={(event: PointerEvent<HTMLButtonElement>) =>
              event.stopPropagation()
            }
            onClick={() => onEdit(pkg)}
            className="text-text-secondary hover:text-white transition-colors disabled:opacity-50"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          {pkg.isActive && (
            <button
              disabled={savingOrder}
              onPointerDown={(event: PointerEvent<HTMLButtonElement>) =>
                event.stopPropagation()
              }
              onClick={() => onDelete(pkg._id)}
              className="text-text-secondary hover:text-error transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function CoinPackageManager({ lang, dict }: CoinPackageManagerProps) {
  const { toast } = useToast();
  const [packages, setPackages] = useState<CoinPackageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingOrder, setSavingOrder] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState<CoinPackageData | null>(
    null
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coin-packages");
      const data = await res.json();
      setPackages(Array.isArray(data) ? data : []);
    } catch {
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  async function handleDelete(id: string) {
    if (!confirm(dict.confirmDeactivate || "Paket wirklich deaktivieren?"))
      return;

    const res = await fetch(`/api/admin/coin-packages/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast({
        type: "success",
        title: dict.packageDeactivated || "Paket deaktiviert",
      });
      fetchPackages();
    }
  }

  function handleEdit(pkg: CoinPackageData) {
    setEditingPackage(pkg);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingPackage(null);
    fetchPackages();
  }

  async function persistSortOrder(
    nextPackages: CoinPackageData[],
    previousPackages: CoinPackageData[]
  ) {
    setSavingOrder(true);
    try {
      const res = await fetch("/api/admin/coin-packages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderedIds: nextPackages.map((pkg) => pkg._id),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to persist order");
      }

      toast({
        type: "success",
        title: dict.orderSaved || "Sortierung gespeichert",
      });
    } catch {
      setPackages(previousPackages);
      toast({
        type: "error",
        title: dict.error || "Fehler",
        message:
          dict.orderSaveFailed ||
          "Sortierung konnte nicht gespeichert werden.",
      });
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || savingOrder) {
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) {
      return;
    }

    const previousPackages = [...packages];
    const fromIndex = packages.findIndex((pkg) => pkg._id === activeId);
    const targetIndex = packages.findIndex((pkg) => pkg._id === overId);

    if (fromIndex < 0 || targetIndex < 0) {
      return;
    }

    const reordered = arrayMove(packages, fromIndex, targetIndex);

    const withUpdatedOrder = reordered.map((pkg, index) => ({
      ...pkg,
      sortOrder: index,
    }));

    setPackages(withUpdatedOrder);
    await persistSortOrder(withUpdatedOrder, previousPackages);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          disabled={savingOrder}
          onClick={() => {
            setEditingPackage(null);
            setShowForm(true);
          }}
          className="bg-pa-green text-bg font-bold text-sm px-4 py-2 rounded-lg hover:bg-pa-green-hover transition-colors flex items-center gap-2 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {dict.newPackage || "Neues Paket"}
        </button>
      </div>

      {showForm && (
        <CoinPackageForm
          lang={lang}
          dict={dict}
          editData={editingPackage}
          onClose={handleFormClose}
        />
      )}

      {savingOrder && (
        <p className="text-xs text-text-secondary">
          {dict.savingOrder || "Sortierung wird gespeichert..."}
        </p>
      )}

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => void handleDragEnd(event)}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary text-xs uppercase">
                <th className="text-left p-3">
                  <div className="flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3" /> {dict.order || "#"}
                  </div>
                </th>
                <th className="text-left p-3">{dict.name || "Name"}</th>
                <th className="text-right p-3">{dict.coins || "Münzen"}</th>
                <th className="text-right p-3">{dict.bonus || "Bonus"}</th>
                <th className="text-right p-3">{dict.price || "Preis"}</th>
                <th className="text-center p-3">{dict.status || "Status"}</th>
                <th className="text-center p-3">{dict.stripe || "Stripe"}</th>
                <th className="text-right p-3">{dict.actions || "Aktionen"}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-text-secondary">
                    {dict.loading || "Laden..."}
                  </td>
                </tr>
              ) : packages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-text-secondary">
                    {dict.noPackages || "Keine Pakete vorhanden."}
                  </td>
                </tr>
              ) : (
                <SortableContext
                  items={packages.map((pkg) => pkg._id)}
                  strategy={verticalListSortingStrategy}
                >
                  {packages.map((pkg) => (
                    <SortablePackageRow
                      key={pkg._id}
                      pkg={pkg}
                      lang={lang}
                      dict={dict}
                      savingOrder={savingOrder}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </SortableContext>
              )}
            </tbody>
          </table>
        </DndContext>
      </div>
    </div>
  );
}
