import { redirect } from "next/navigation";

export default async function LangRoot({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  redirect(`/${lang}/login`);
}
