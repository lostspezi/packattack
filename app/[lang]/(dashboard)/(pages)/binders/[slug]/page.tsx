import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Binder from "@/models/binder";
import PackPull from "@/models/pack-pull";
import Card from "@/models/card";
import { resolveAccess } from "@/lib/binders/public-access";
import { serializeBinder } from "@/lib/binders/serialize";
import {
  BinderEditor,
  type ExpectedCardDTO,
  type PlacedCardDTO,
} from "@/components/binders/binder-editor";
import { BinderViewer } from "@/components/binders/binder-viewer";

export default async function BinderSlugPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const session = await auth();
  const viewerId =
    (session?.user as { id?: string } | undefined)?.id ?? null;

  await connectDB();
  const binder = await Binder.findOne({ slug });
  if (!binder) notFound();

  const access = resolveAccess(binder, viewerId);
  if (access === "denied") notFound();

  const placedPullIds = new Set<string>();
  const expectedCardIds = new Set<string>();
  for (const page of binder.pages) {
    for (const slot of page.slots) {
      if (slot.packPullId) placedPullIds.add(slot.packPullId.toString());
      if (slot.expectedCardId) {
        expectedCardIds.add(slot.expectedCardId.toString());
      }
    }
  }

  const placedPulls = placedPullIds.size
    ? await PackPull.find({
        _id: {
          $in: Array.from(placedPullIds).map((id) => new Types.ObjectId(id)),
        },
      })
        .select("_id cardId createdAt")
        .lean()
    : [];

  const cardIds = new Set<string>();
  for (const p of placedPulls) cardIds.add(p.cardId.toString());
  for (const id of expectedCardIds) cardIds.add(id);

  const cards = cardIds.size
    ? await Card.find({
        _id: {
          $in: Array.from(cardIds).map((id) => new Types.ObjectId(id)),
        },
      })
        .select("_id name game set setName rarity image")
        .lean()
    : [];
  const cardMap = new Map(cards.map((c) => [c._id.toString(), c]));

  const placedCards: PlacedCardDTO[] = placedPulls
    .map((p) => {
      const c = cardMap.get(p.cardId.toString());
      if (!c) return null;
      return {
        packPullId: p._id.toString(),
        cardId: c._id.toString(),
        name: c.name,
        game: c.game,
        set: c.set,
        setName: c.setName,
        rarity: c.rarity,
        image: c.image ?? null,
        createdAt: p.createdAt.toISOString(),
      };
    })
    .filter((x): x is PlacedCardDTO => x !== null);

  const expectedCards: ExpectedCardDTO[] = Array.from(expectedCardIds)
    .map((id) => cardMap.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      cardId: c._id.toString(),
      name: c.name,
      game: c.game,
      set: c.set,
      setName: c.setName,
      rarity: c.rarity,
      image: c.image ?? null,
    }));

  const dto = serializeBinder(binder);

  if (access === "owner") {
    return (
      <BinderEditor
        initialBinder={dto}
        placedCards={placedCards}
        expectedCards={expectedCards}
        lang={lang}
      />
    );
  }

  return (
    <BinderViewer
      binder={dto}
      placedCards={placedCards}
      expectedCards={expectedCards}
      lang={lang}
      viewerId={viewerId}
    />
  );
}
