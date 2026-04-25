import { notFound } from "next/navigation";
import Link from "next/link";
import { Types } from "mongoose";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Binder from "@/models/binder";
import PackPull from "@/models/pack-pull";
import Card from "@/models/card";
import { resolveAccess } from "@/lib/binders/public-access";
import { serializeBinder } from "@/lib/binders/serialize";
import {
  BinderViewer,
} from "@/components/binders/binder-viewer";
import type {
  ExpectedCardDTO,
  PlacedCardDTO,
} from "@/components/binders/binder-editor";

export default async function PublicBinderPage({
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

  await Binder.updateOne({ _id: binder._id }, { $inc: { viewCount: 1 } });

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
  const isDe = lang === "de";

  return (
    <div className="max-w-[1400px] mx-auto w-full px-4 md:px-6 py-6 md:py-8">
      <div className="mb-4">
        <Link
          href={`/${lang}/binders/explore`}
          className="text-sm text-text-secondary hover:text-text-primary inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          {isDe ? "Galerie" : "Gallery"}
        </Link>
      </div>
      <BinderViewer
        binder={dto}
        placedCards={placedCards}
        expectedCards={expectedCards}
        lang={lang}
        viewerId={viewerId}
      />
    </div>
  );
}
