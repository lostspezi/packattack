import { Types } from "mongoose";
import Card from "@/models/card";
import Box from "@/models/box";
import type { ItemInput } from "@/lib/admin/upvote-campaign-payload";
import type { IUpvoteCampaignItem } from "@/models/upvote-campaign";

export type AdminGate =
  | { ok: true; userId: string; role: "admin" | "super_admin" }
  | { ok: false; status: 401 | 403 };

export function gateAdmin(session: unknown): AdminGate {
  const s = session as { user?: { id?: string; role?: string } } | null;
  const userId = s?.user?.id;
  const role = s?.user?.role;
  if (!s?.user || !userId) return { ok: false, status: 401 };
  if (role !== "admin" && role !== "super_admin") return { ok: false, status: 403 };
  return { ok: true, userId, role };
}

type ItemSnapshot = Omit<IUpvoteCampaignItem, "_id">;

/**
 * Turns API payload items into immutable subdoc snapshots. For internal
 * cards and boxes the display fields are loaded from the source document
 * so the snapshot stays stable even if the source is later renamed or
 * removed. JustTCG cards and free-form options keep what the admin typed.
 */
export async function buildItemSnapshots(inputs: ItemInput[]): Promise<ItemSnapshot[]> {
  const internalCardIds = inputs.flatMap((i) =>
    i.kind === "card" && i.source === "internal" && i.internalCardId
      ? [i.internalCardId]
      : []
  );

  const boxIds = inputs.flatMap((i) => (i.kind === "box" ? [i.boxId] : []));

  const cardDocs = internalCardIds.length
    ? await Card.find({ _id: { $in: internalCardIds.map((id) => new Types.ObjectId(id)) } })
        .select("_id justTcgId name game set setName rarity image tcgplayerId")
        .lean()
    : [];
  const cardMap = new Map(cardDocs.map((c) => [c._id.toString(), c]));

  const boxDocs = boxIds.length
    ? await Box.find({ _id: { $in: boxIds.map((id) => new Types.ObjectId(id)) } })
        .select("_id slug name image game")
        .lean()
    : [];
  const boxMap = new Map(boxDocs.map((b) => [b._id.toString(), b]));

  const empty = { de: "", en: "" };

  return inputs.map((input) => {
    if (input.kind === "card") {
      if (input.source === "internal") {
        const doc = cardMap.get(input.internalCardId!);
        if (!doc) throw new Error(`unknown_internal_card:${input.internalCardId}`);
        return {
          kind: "card" as const,
          label: { de: doc.name, en: doc.name },
          description: empty,
          image: doc.image ?? null,
          position: input.position,
          source: "internal" as const,
          internalCardId: doc._id,
          justTcgId: doc.justTcgId ?? null,
          game: doc.game,
          set: doc.set,
          setName: doc.setName,
          rarity: doc.rarity,
          tcgplayerId: doc.tcgplayerId ?? null,
          boxId: null,
          boxSlug: null,
        };
      }
      return {
        kind: "card" as const,
        label: { de: input.name!, en: input.name! },
        description: empty,
        image: input.image ?? null,
        position: input.position,
        source: "justtcg" as const,
        internalCardId: null,
        justTcgId: input.justTcgId!,
        game: input.game!,
        set: input.set!,
        setName: input.setName!,
        rarity: input.rarity!,
        tcgplayerId: input.tcgplayerId ?? null,
        boxId: null,
        boxSlug: null,
      };
    }

    if (input.kind === "box") {
      const doc = boxMap.get(input.boxId);
      if (!doc) throw new Error(`unknown_box:${input.boxId}`);
      return {
        kind: "box" as const,
        label: doc.name,
        description: empty,
        image: doc.image ?? null,
        position: input.position,
        source: null,
        internalCardId: null,
        justTcgId: null,
        game: doc.game ?? null,
        set: null,
        setName: null,
        rarity: null,
        tcgplayerId: null,
        boxId: doc._id,
        boxSlug: doc.slug ?? null,
      };
    }

    return {
      kind: "option" as const,
      label: input.label,
      description: input.description ?? empty,
      image: input.image ?? null,
      position: input.position,
      source: null,
      internalCardId: null,
      justTcgId: null,
      game: null,
      set: null,
      setName: null,
      rarity: null,
      tcgplayerId: null,
      boxId: null,
      boxSlug: null,
    };
  });
}

export function toCsvLong(
  campaignTitle: string,
  rows: { itemLabel: string; voteCount: number; userNames: string[] }[]
): string {
  const header = "campaign,item,voteCount,voters";
  const lines = rows.map((r) => {
    const voters = r.userNames.join("; ");
    return [campaignTitle, r.itemLabel, String(r.voteCount), voters].map(csvEscape).join(",");
  });
  return [header, ...lines].join("\n");
}

export function toCsvMatrix(
  itemLabels: string[],
  userRows: { userName: string; picks: Set<string> }[]
): string {
  const header = ["user", ...itemLabels].map(csvEscape).join(",");
  const lines = userRows.map((row) =>
    [row.userName, ...itemLabels.map((c) => (row.picks.has(c) ? "1" : "0"))]
      .map(csvEscape)
      .join(",")
  );
  return [header, ...lines].join("\n");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
