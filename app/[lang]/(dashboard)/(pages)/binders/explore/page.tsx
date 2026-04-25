import { ExploreView } from "@/components/binders/explore-view";

export default async function ExplorePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return <ExploreView lang={lang} />;
}
