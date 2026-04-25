import { NewBinderWizard } from "@/components/binders/new-binder-wizard";

export default async function NewBinderPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return <NewBinderWizard lang={lang} />;
}
