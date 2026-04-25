import { CollectionView } from "@/components/collection/collection-view";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return <CollectionView lang={lang} />;
}
