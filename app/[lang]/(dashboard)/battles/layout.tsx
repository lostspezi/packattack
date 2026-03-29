import { Sidebar } from "@/components/layout/sidebar";
import { auth } from "@/lib/auth";
import { getDictionary, type Locale } from "@/lib/i18n";

export default async function BattlesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  const session = await auth();
  const userRole = (session?.user as { role?: string } | undefined)?.role ?? "user";
  const userName = session?.user?.name ?? session?.user?.email ?? "User";
  const userInitial = userName.charAt(0).toUpperCase();

  const [battlesDict] = await Promise.all([
    getDictionary(lang as Locale, "battles"),
  ]);

  return (
    <div className="flex flex-1">
      <Sidebar
        lang={lang}
        dict={{}}
        adminDict={{}}
        dashboardDict={battlesDict}
        userRole={userRole}
        userName={userName}
        userInitial={userInitial}
        mode="battles"
      />
      <main className="flex min-w-0 flex-1 flex-col p-4 md:p-6">{children}</main>
    </div>
  );
}
