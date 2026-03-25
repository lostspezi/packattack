"use client";

import React, { useState } from "react";
import { useToast } from "@/components/ui/toast";

const ALL_ROLES = ["user", "shop", "moderator", "admin", "super_admin"] as const;
type Role = (typeof ALL_ROLES)[number];

interface RoleSelectorProps {
  currentRole: Role;
  userId: string;
  sessionUserRole: string;
  isOwnUser: boolean;
  onRoleChange: (userId: string, newRole: Role) => void;
}

export function RoleSelector({
  currentRole,
  userId,
  sessionUserRole,
  isOwnUser,
  onRoleChange,
}: RoleSelectorProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isDisabled = isOwnUser || loading;

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value as Role;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          type: "error",
          title: "Failed to update role",
          message: (data as { error?: string }).error ?? "Unknown error",
        });
        return;
      }

      toast({ type: "success", title: "Role updated successfully" });
      onRoleChange(userId, newRole);
    } catch {
      toast({ type: "error", title: "Network error", message: "Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <select
      value={currentRole}
      onChange={handleChange}
      disabled={isDisabled}
      className="bg-white/4 border border-white/8 text-text-primary text-sm rounded-[8px] px-2 py-1 outline-none focus:border-pa-green/35 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {ALL_ROLES.map((r) => {
        const isElevated = r === "admin" || r === "super_admin";
        const isOptionDisabled = isElevated && sessionUserRole !== "super_admin";
        return (
          <option key={r} value={r} disabled={isOptionDisabled}>
            {r}
          </option>
        );
      })}
    </select>
  );
}
