import { BinderListView } from "@/components/binders/binder-list-view";

export default async function BindersPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return <BinderListView lang={lang} />;
}
