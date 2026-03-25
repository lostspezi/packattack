"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface ChangeEmailFormProps {
  dict: Record<string, string>;
  currentEmail: string;
}

export function ChangeEmailForm({ dict, currentEmail }: ChangeEmailFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "email", newEmail, password }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        const errorMap: Record<string, string> = {
          email_taken: dict["error_email_taken"] ?? "Email already in use",
          invalid_password: dict["error_invalid_password"] ?? "Incorrect password",
          no_password: dict["error_no_password"] ?? "No password set for this account",
        };
        toast({
          type: "error",
          title: (data.error && errorMap[data.error]) || (dict["error_save"] ?? "Failed to update email"),
        });
        return;
      }

      toast({
        type: "success",
        title: dict["success_email_changed"] ?? "Email updated. Please verify your new email address.",
      });
      setNewEmail("");
      setPassword("");
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
        label={dict["label_current_email"] ?? "Current Email"}
        type="email"
        value={currentEmail}
        readOnly
        className="opacity-60 cursor-not-allowed"
      />
      <Input
        label={dict["label_new_email"] ?? "New Email"}
        type="email"
        value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
        required
        autoComplete="email"
      />
      <Input
        label={dict["label_current_password"] ?? "Current Password"}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
      />
      <div className="flex">
        <Button type="submit" variant="secondary" size="md" loading={loading} className="w-full md:w-auto">
          {dict["button_update_email"] ?? "Update Email"}
        </Button>
      </div>
    </form>
  );
}
