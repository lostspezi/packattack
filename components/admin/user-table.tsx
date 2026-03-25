"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
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

export function UserTable({
  lang,
  dict,
  sessionUserId,
  sessionUserRole,
}: UserTableProps) {
  void lang;
  void dict;

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("");
  const { toast } = useToast();

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
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search by username or email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="py-2 text-sm"
          />
        </div>

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
          className="w-44"
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
          className="w-36"
        />
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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-text-muted text-sm"
                >
                  Loading…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-text-muted text-sm"
                >
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const initial = (user.name || user.username || "?")
                  .charAt(0)
                  .toUpperCase();
                const isOwnUser = user._id === sessionUserId;

                return (
                  <tr
                    key={user._id}
                    className="border-b border-border last:border-0"
                  >
                    {/* Avatar */}
                    <td className="px-4 py-3">
                      {user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.image}
                          alt={user.username}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pa-green/60 to-pa-lila/60 flex items-center justify-center text-sm font-bold text-white">
                          {initial}
                        </div>
                      )}
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
    </div>
  );
}
