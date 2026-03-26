"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BoxForm } from "@/components/admin/box-form";
import type { BoxFormData } from "@/components/admin/box-form";
import { useToast } from "@/components/ui/toast";

export default function NewBoxPage() {
  const params = useParams<{ lang: string }>();
  const lang = params.lang ?? "en";
  const isDe = lang === "de";
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);

  async function handleSave(data: BoxFormData) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/boxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({
          type: "error",
          title: (body as { error?: string }).error ?? "Failed to create box",
        });
        return;
      }

      const created: { _id?: string } = await res.json();
      toast({
        type: "success",
        title: isDe ? "Box erstellt!" : "Box created!",
      });
      router.push(`/${lang}/admin/boxes/${created._id ?? ""}`);
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {isDe ? "Neue Box erstellen" : "Create New Box"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {isDe
            ? "Fülle das Formular aus und speichere die Box als Entwurf."
            : "Fill out the form and save the box as a draft."}
        </p>
      </div>

      <BoxForm
        lang={lang}
        dict={{}}
        onSave={(data) => void handleSave(data)}
        loading={loading}
      />
    </div>
  );
}
