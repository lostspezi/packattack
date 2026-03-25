"use client";

import React, { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";

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

  const roleOptions: SelectOption[] = ALL_ROLES.map((r) => {
    const isElevated = r === "admin" || r === "super_admin";
    const isOptionDisabled = isElevated && sessionUserRole !== "super_admin";
    return { label: r, value: r, disabled: isOptionDisabled };
  });

  async function handleChange(newRole: string) {
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
      onRoleChange(userId, newRole as Role);
    } catch {
      toast({ type: "error", title: "Network error", message: "Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Select
      options={roleOptions}
      value={currentRole}
      onChange={handleChange}
      size="sm"
      disabled={isDisabled}
    />
  );
}
