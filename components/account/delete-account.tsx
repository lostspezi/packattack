"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

interface DeleteAccountProps {
  dict: Record<string, string>;
  lang: string;
}

export function DeleteAccount({ dict, lang }: DeleteAccountProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const isConfirmed = confirmText === "DELETE";

  async function handleDelete() {
    if (!isConfirmed) return;
    setLoading(true);

    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        toast({
          type: "error",
          title: data.error ?? (dict["error_delete"] ?? "Failed to delete account"),
        });
        return;
      }

      toast({
        type: "success",
        title: dict["success_deleted"] ?? "Account deleted successfully",
      });

      await signOut({ redirect: false });
      router.push(`/${lang}/login`);
    } catch {
      toast({
        type: "error",
        title: dict["error_unexpected"] ?? "An unexpected error occurred",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-[10px] bg-error/5 border border-error/15">
        <p className="text-sm text-text-secondary">
          {dict["danger_warning"] ??
            "This action is irreversible. All your data will be permanently deleted. Your consent log will be retained as required by law."}
        </p>
      </div>

      <Input
        label={dict["label_confirm_delete"] ?? 'Type "DELETE" to confirm'}
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="DELETE"
      />

      <Button
        type="button"
        variant="danger"
        size="md"
        loading={loading}
        disabled={!isConfirmed}
        onClick={handleDelete}
      >
        {dict["button_delete_account"] ?? "Delete My Account"}
      </Button>
    </div>
  );
}
