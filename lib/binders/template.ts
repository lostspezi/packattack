import { Types } from "mongoose";
import Card from "@/models/card";
import { makeTemplatePages, type PlainPage } from "@/lib/binders/slot-ops";

export interface TemplateBuildResult {
  pages: PlainPage[];
  expectedCardIds: Types.ObjectId[];
}

/**
 * Loads all master cards for a (game, set) and pre-allocates template pages.
 * Primary sort is cardNumberInSet (ascending, nulls last) so a Pokemon set
 * appears in #001..#102 order; name is the stable tie-breaker for cards
 * without a number yet.
 */
export async function buildTemplatePages(
  game: string,
  set: string,
): Promise<TemplateBuildResult> {
  const cards = await Card.find({ game, set })
    .select("_id name cardNumberInSet")
    .sort({ cardNumberInSet: 1, name: 1 })
    .lean();
  const expectedCardIds = cards.map((c) => c._id as Types.ObjectId);
  const pages = makeTemplatePages(expectedCardIds.map((id) => id.toString()));
  return { pages, expectedCardIds };
}
