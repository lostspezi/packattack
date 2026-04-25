import type { IBinder, IBinderPage, IBinderSlot } from "@/models/binder";

export interface BinderSlotDTO {
  position: number;
  packPullId: string | null;
  expectedCardId: string | null;
  note: string | null;
}

export interface BinderPageDTO {
  title: string | null;
  backgroundId: string | null;
  slots: BinderSlotDTO[];
}

export interface BinderDTO {
  _id: string;
  userId: string;
  slug: string;
  name: string;
  description: string;
  type: "free" | "set-template";
  setTemplate: { game: string; set: string } | null;
  theme: string;
  coverPackPullId: string | null;
  pages: BinderPageDTO[];
  isPublic: boolean;
  publishedAt: string | null;
  likeCount: number;
  viewCount: number;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
}

function serializeSlot(slot: IBinderSlot): BinderSlotDTO {
  return {
    position: slot.position,
    packPullId: slot.packPullId ? slot.packPullId.toString() : null,
    expectedCardId: slot.expectedCardId
      ? slot.expectedCardId.toString()
      : null,
    note: slot.note,
  };
}

function serializePage(page: IBinderPage): BinderPageDTO {
  return {
    title: page.title,
    backgroundId: page.backgroundId,
    slots: page.slots.map(serializeSlot),
  };
}

export function serializeBinder(binder: IBinder): BinderDTO {
  let cardCount = 0;
  for (const page of binder.pages) {
    for (const slot of page.slots) {
      if (slot.packPullId) cardCount += 1;
    }
  }
  return {
    _id: binder._id ? binder._id.toString() : "",
    userId: binder.userId.toString(),
    slug: binder.slug,
    name: binder.name,
    description: binder.description,
    type: binder.type,
    setTemplate: binder.setTemplate
      ? { game: binder.setTemplate.game, set: binder.setTemplate.set }
      : null,
    theme: binder.theme,
    coverPackPullId: binder.coverPackPullId
      ? binder.coverPackPullId.toString()
      : null,
    pages: binder.pages.map(serializePage),
    isPublic: binder.isPublic,
    publishedAt: binder.publishedAt
      ? binder.publishedAt.toISOString()
      : null,
    likeCount: binder.likeCount,
    viewCount: binder.viewCount,
    cardCount,
    createdAt: binder.createdAt.toISOString(),
    updatedAt: binder.updatedAt.toISOString(),
  };
}

export interface BinderSummaryDTO {
  _id: string;
  slug: string;
  name: string;
  description: string;
  type: "free" | "set-template";
  setTemplate: { game: string; set: string } | null;
  theme: string;
  coverPackPullId: string | null;
  isPublic: boolean;
  cardCount: number;
  pageCount: number;
  likeCount: number;
  viewCount: number;
  updatedAt: string;
  createdAt: string;
}

export function serializeBinderSummary(binder: IBinder): BinderSummaryDTO {
  let cardCount = 0;
  for (const page of binder.pages) {
    for (const slot of page.slots) {
      if (slot.packPullId) cardCount += 1;
    }
  }
  return {
    _id: binder._id ? binder._id.toString() : "",
    slug: binder.slug,
    name: binder.name,
    description: binder.description,
    type: binder.type,
    setTemplate: binder.setTemplate
      ? { game: binder.setTemplate.game, set: binder.setTemplate.set }
      : null,
    theme: binder.theme,
    coverPackPullId: binder.coverPackPullId
      ? binder.coverPackPullId.toString()
      : null,
    isPublic: binder.isPublic,
    cardCount,
    pageCount: binder.pages.length,
    likeCount: binder.likeCount,
    viewCount: binder.viewCount,
    updatedAt: binder.updatedAt.toISOString(),
    createdAt: binder.createdAt.toISOString(),
  };
}
