"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface ChangePasswordFormProps {
  dict: Record<string, string>;
}

export function ChangePasswordForm({ dict }: ChangePasswordFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        type: "error",
        title: dict["error_passwords_mismatch"] ?? "New passwords do not match",
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "password",
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        const errorMap: Record<string, string> = {
          invalid_password: dict["error_invalid_password"] ?? "Current password is incorrect",
          no_password: dict["error_no_password"] ?? "No password set for this account",
        };
        toast({
          type: "error",
          title: (data.error && errorMap[data.error]) || (dict["error_save"] ?? "Failed to update password"),
        });
        return;
      }

      toast({
        type: "success",
        title: dict["success_password_changed"] ?? "Password updated successfully",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={dict["label_current_password"] ?? "Current Password"}
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        required
        autoComplete="current-password"
      />
      <Input
        label={dict["label_new_password"] ?? "New Password"}
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
        minLength={8}
        autoComplete="new-password"
      />
      <Input
        label={dict["label_confirm_password"] ?? "Confirm New Password"}
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        minLength={8}
        autoComplete="new-password"
      />
      <div className="flex">
        <Button type="submit" variant="secondary" size="md" loading={loading} className="w-full md:w-auto">
          {dict["button_update_password"] ?? "Update Password"}
        </Button>
      </div>
    </form>
  );
}
