import { Types } from "mongoose";
import Card from "@/models/card";
import type { CardInput } from "@/lib/admin/upvote-campaign-payload";
import type { IUpvoteCampaignCard } from "@/models/upvote-campaign";

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

/**
 * Macht aus Card-Input-Payload eingefrorene Snapshot-Subdocs. Für `internal`
 * Cards werden Name/Set/Rarity aus der Card-Collection geladen — der Snapshot
 * bleibt stabil, auch wenn das Card-Doc später umbenannt wird oder die
 * externe JustTCG-Karte verschwindet.
 *
 * Wirft, wenn ein angegebenes Card-Doc nicht existiert.
 */
export async function buildCardSnapshots(
  inputs: CardInput[]
): Promise<Omit<IUpvoteCampaignCard, "_id">[]> {
  const internalIds = inputs
    .filter((c): c is Extract<CardInput, { source: "internal" }> => c.source === "internal")
    .map((c) => c.internalCardId);

  const cardDocs = internalIds.length
    ? await Card.find({ _id: { $in: internalIds.map((id) => new Types.ObjectId(id)) } })
        .select("_id justTcgId name game set setName rarity image tcgplayerId")
        .lean()
    : [];

  const cardMap = new Map(cardDocs.map((c) => [c._id.toString(), c]));

  return inputs.map((input) => {
    if (input.source === "internal") {
      const doc = cardMap.get(input.internalCardId);
      if (!doc) throw new Error(`unknown_internal_card:${input.internalCardId}`);
      return {
        source: "internal" as const,
        internalCardId: doc._id,
        justTcgId: doc.justTcgId ?? null,
        name: doc.name,
        game: doc.game,
        set: doc.set,
        setName: doc.setName,
        rarity: doc.rarity,
        image: doc.image ?? null,
        tcgplayerId: doc.tcgplayerId ?? null,
        position: input.position,
      };
    }
    return {
      source: "justtcg" as const,
      internalCardId: null,
      justTcgId: input.justTcgId,
      name: input.name,
      game: input.game,
      set: input.set,
      setName: input.setName,
      rarity: input.rarity,
      image: input.image ?? null,
      tcgplayerId: input.tcgplayerId ?? null,
      position: input.position,
    };
  });
}

export interface CsvExportRow {
  campaign: string;
  card: string;
  voteCount: number;
}

export function toCsvLong(
  campaignTitle: string,
  rows: { cardName: string; voteCount: number; userNames: string[] }[]
): string {
  const header = "campaign,card,voteCount,voters";
  const lines = rows.map((r) => {
    const voters = r.userNames.join("; ");
    return [campaignTitle, r.cardName, String(r.voteCount), voters].map(csvEscape).join(",");
  });
  return [header, ...lines].join("\n");
}

export function toCsvMatrix(
  cardNames: string[],
  userRows: { userName: string; picks: Set<string> }[]
): string {
  const header = ["user", ...cardNames].map(csvEscape).join(",");
  const lines = userRows.map((row) =>
    [row.userName, ...cardNames.map((c) => (row.picks.has(c) ? "1" : "0"))]
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
