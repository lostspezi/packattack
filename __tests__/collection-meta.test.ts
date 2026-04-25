import { describe, it, expect, vi } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: { json: vi.fn() },
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: vi.fn() }));
vi.mock("@/models/pack-pull", () => ({ default: { aggregate: vi.fn() } }));

import { buildCollectionMeta } from "@/app/api/collection/meta/route";

describe("buildCollectionMeta", () => {
  it("builds sorted games, setsByGame, and rarities from aggregation rows", () => {
    const rows = [
      { _id: "pokemon", sets: ["sv1", "swsh1"], rarities: ["Rare", "Common"] },
      { _id: "lorcana", sets: ["tfc"], rarities: ["Common", "Uncommon"] },
    ];
    const meta = buildCollectionMeta(rows);
    expect(meta.games).toEqual(["lorcana", "pokemon"]);
    expect(meta.setsByGame).toEqual({
      lorcana: ["tfc"],
      pokemon: ["sv1", "swsh1"],
    });
    expect(meta.rarities).toEqual(["Common", "Rare", "Uncommon"]);
  });

  it("skips rows where _id is falsy", () => {
    const rows = [
      { _id: "", sets: ["sv1"], rarities: ["Common"] },
      { _id: "pokemon", sets: ["sv1"], rarities: ["Rare"] },
    ];
    const meta = buildCollectionMeta(rows);
    expect(meta.games).toEqual(["pokemon"]);
  });

  it("deduplicates rarities across games", () => {
    const rows = [
      { _id: "pokemon", sets: [], rarities: ["Common", "Rare"] },
      { _id: "lorcana", sets: [], rarities: ["Common"] },
    ];
    const meta = buildCollectionMeta(rows);
    expect(meta.rarities).toEqual(["Common", "Rare"]);
  });
});
