"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Award, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { UserBadgeManagerModal } from "@/components/admin/user-badge-manager-modal";
import { RoleSelector } from "@/components/admin/role-selector";
import { useToast } from "@/components/ui/toast";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";

type Role = "user" | "shop" | "moderator" | "admin" | "super_admin";

interface AdminUser {
  _id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  emailVerified: string | null;
  image: string | null;
  createdAt: string;
}

interface ApiResponse {
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
}

interface UserTableProps {
  lang: string;
  dict: Record<string, string>;
  sessionUserId: string;
  sessionUserRole: string;
}

const ALL_ROLES: Role[] = ["user", "shop", "moderator", "admin", "super_admin"];
const ADMIN_DELETABLE_ROLES: Role[] = ["user", "shop", "moderator"];

export function UserTable({
  lang,
  dict,
  sessionUserId,
  sessionUserRole,
}: UserTableProps) {
  void dict;

  const isDe = lang === "de";

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("");
  const { toast } = useToast();

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [badgeTarget, setBadgeTarget] = useState<AdminUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      if (verifiedFilter) params.set("verified", verifiedFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        toast({ type: "error", title: "Failed to load users" });
        return;
      }
      const data: ApiResponse = await res.json();
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, verifiedFilter, toast]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // Debounce search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  function handleRoleChange(userId: string, newRole: Role) {
    setUsers((prev) =>
      prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
    );
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString();
    } catch {
      return "—";
    }
  }

  function canDeleteUser(targetRole: Role): boolean {
    if (sessionUserRole === "super_admin") return true;
    if (sessionUserRole === "admin") {
      return ADMIN_DELETABLE_ROLES.includes(targetRole);
    }
    return false;
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget._id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          type: "error",
          title: (data as { error?: string }).error ?? "Failed to delete user",
        });
        return;
      }
      setUsers((prev) => prev.filter((u) => u._id !== deleteTarget._id));
      setTotal((prev) => prev - 1);
      toast({
        type: "success",
        title: isDe
          ? `${deleteTarget.username} wurde gelöscht.`
          : `${deleteTarget.username} has been deleted.`,
      });
      setDeleteTarget(null);
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <div className="w-full sm:flex-1 sm:min-w-[200px]">
          <Input
            placeholder="Search by username or email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="py-2 text-sm"
          />
        </div>

        <div className="flex gap-3">
          {/* Role filter */}
          <Select
            options={[
              { label: "All roles", value: "" },
              ...ALL_ROLES.map((r): SelectOption => ({ label: r, value: r })),
            ]}
            value={roleFilter}
            onChange={(val) => {
              setRoleFilter(val);
              setPage(1);
            }}
            size="md"
            className="flex-1 sm:w-44"
          />

          {/* Verified filter */}
          <Select
            options={[
              { label: "All", value: "" },
              { label: "Verified", value: "true" },
              { label: "Unverified", value: "false" },
            ]}
            value={verifiedFilter}
            onChange={(val) => {
              setVerifiedFilter(val);
              setPage(1);
            }}
            size="md"
            className="flex-1 sm:w-36"
          />
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-text-muted">
        {total} user{total !== 1 ? "s" : ""} found
      </p>

      {/* Table */}
      <div className="w-full overflow-x-auto bg-surface rounded-[14px] border border-border">
        <table className="w-full min-w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-10">
                Avatar
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Username
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Verified
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Registered
              </th>
              <th className="px-4 py-3 w-28" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-text-muted text-sm"
                >
                  Loading…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-text-muted text-sm"
                >
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isOwnUser = user._id === sessionUserId;
                const showDelete = !isOwnUser && canDeleteUser(user.role);

                return (
                  <tr
                    key={user._id}
                    className="border-b border-border last:border-0"
                  >
                    {/* Avatar */}
                    <td className="px-4 py-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={user.image || "/images/default-avatar.png"}
                        alt={user.username || "User"}
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = "/images/default-avatar.png"; }}
                      />
                    </td>

                    {/* Username */}
                    <td className="px-4 py-3 text-sm text-text-primary font-medium">
                      {user.username}
                      {isOwnUser && (
                        <span className="ml-1 text-xs text-text-muted">(you)</span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {user.email}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <RoleSelector
                        currentRole={user.role}
                        userId={user._id}
                        sessionUserRole={sessionUserRole}
                        isOwnUser={isOwnUser}
                        onRoleChange={handleRoleChange}
                      />
                    </td>

                    {/* Verified */}
                    <td className="px-4 py-3">
                      {user.emailVerified ? (
                        <Badge variant="verified">Verified</Badge>
                      ) : (
                        <Badge variant="warning">Unverified</Badge>
                      )}
                    </td>

                    {/* Registered */}
                    <td className="px-4 py-3 text-sm text-text-muted">
                      {formatDate(user.createdAt)}
                    </td>

                    {/* Delete action */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-label={isDe ? "Badges verwalten" : "Manage badges"}
                          onClick={() => setBadgeTarget(user)}
                        >
                          <Award className="w-4 h-4" />
                        </Button>
                        {showDelete && (
                          <Button
                            variant="danger"
                            size="sm"
                            aria-label={isDe ? "Benutzer löschen" : "Delete user"}
                            loading={deleteLoading && deleteTarget?._id === user._id}
                            onClick={() => setDeleteTarget(user)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center pt-2">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => {
          if (!deleteLoading) setDeleteTarget(null);
        }}
        title={isDe ? "Benutzer löschen" : "Delete user"}
        size="sm"
      >
        <p className="text-sm text-text-secondary mb-6">
          {isDe
            ? `Diese Aktion ist unwiderruflich. Alle Daten von ${deleteTarget?.username ?? ""} werden permanent gelöscht.`
            : `This action cannot be undone. All data for ${deleteTarget?.username ?? ""} will be permanently deleted.`}
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            variant="secondary"
            size="sm"
            disabled={deleteLoading}
            onClick={() => setDeleteTarget(null)}
          >
            {isDe ? "Abbrechen" : "Cancel"}
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={deleteLoading}
            onClick={() => void handleDeleteConfirm()}
          >
            {isDe ? "Unwiderruflich löschen" : "Delete permanently"}
          </Button>
        </div>
      </Modal>

      <UserBadgeManagerModal
        open={badgeTarget !== null}
        onClose={() => setBadgeTarget(null)}
        user={
          badgeTarget
            ? {
                id: badgeTarget._id,
                username: badgeTarget.username,
                name: badgeTarget.name,
                email: badgeTarget.email,
              }
            : null
        }
        lang={lang}
      />
    </div>
  );
}
