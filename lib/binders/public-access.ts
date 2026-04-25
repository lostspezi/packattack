import type { Types } from "mongoose";

export type AccessMode = "owner" | "public-read" | "denied";

export interface AccessSubject {
  userId: Types.ObjectId;
  isPublic: boolean;
}

export function resolveAccess(
  binder: AccessSubject,
  viewerId: string | null,
): AccessMode {
  if (viewerId && binder.userId.toString() === viewerId) return "owner";
  if (binder.isPublic) return "public-read";
  return "denied";
}
