import { redirect } from "next/navigation";
import { getDefaultLocale } from "@/lib/i18n";

export default async function RootPage() {
  const defaultLocale = await getDefaultLocale();
  redirect(`/${defaultLocale}/dashboard`);
}
