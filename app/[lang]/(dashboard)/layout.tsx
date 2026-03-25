import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { UserHeader } from "@/components/layout/user-header";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect(`/${lang}/login`);
  }

  const commonDict = await getDictionary(lang as Locale, "common");

  const userName = session.user.name ?? session.user.email ?? "User";
  const userInitial = userName.charAt(0).toUpperCase();
  const userRole = (session.user as { role?: string }).role ?? "user";

  return (
    <div className="min-h-screen bg-bg">
      <UserHeader
        lang={lang}
        dict={commonDict}
        userName={userName}
        userInitial={userInitial}
        userRole={userRole}
      />
      <div className="flex-1">{children}</div>
    </div>
  );
}
