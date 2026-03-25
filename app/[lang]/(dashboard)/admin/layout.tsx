import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (role !== "admin" && role !== "super_admin") {
    redirect(`/${lang}/dashboard`);
  }

  return <>{children}</>;
}
