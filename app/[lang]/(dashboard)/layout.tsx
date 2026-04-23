import { redirect } from "next/navigation";
import { ChatDock } from "@/components/chat/chat-dock";
import { Footer } from "@/components/layout/footer";
import { UserHeader } from "@/components/layout/header/user-header";
import { MeProvider } from "@/components/layout/me-provider";
import { PendingPullsGuard } from "@/components/packs/pending-pulls-guard";
import { Packi } from "@/components/packi/packi";
import { PackiProvider } from "@/components/packi/packi-provider";
import { TourProvider } from "@/components/tour/tour-provider";
import { CORE_SOCIAL_STEPS } from "@/lib/tour/steps/core-social";
import { auth } from "@/lib/auth";
import { getActiveLanguages, getDictionary } from "@/lib/i18n";

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

  const [commonDict, chatDict, footerDict, languages] = await Promise.all([
    getDictionary(lang, "common"),
    getDictionary(lang, "chat"),
    getDictionary(lang, "footer"),
    getActiveLanguages(),
  ]);

  const userName = session.user.name ?? session.user.email ?? "User";
  const userRole = (session.user as { role?: string }).role ?? "user";
  const userImage = session.user.image ?? null;

  return (
    <MeProvider>
      <TourProvider steps={CORE_SOCIAL_STEPS}>
        <PackiProvider>
          <div className="flex flex-1 flex-col xl:pr-[420px]" style={{ background: "linear-gradient(135deg, var(--color-pa-lila) 30%, var(--color-pa-blue) 80%)" }}>
            <UserHeader
              lang={lang}
              dict={commonDict}
              languages={languages}
              userName={userName}
              userImage={userImage}
              userRole={userRole}
            />
            <PendingPullsGuard>
              <div className="flex flex-1 flex-col">{children}</div>
            </PendingPullsGuard>
            <ChatDock
              lang={lang}
              dict={chatDict}
              currentUserId={session.user.id}
              userRole={userRole}
            />
            <Footer lang={lang} dict={footerDict} />
            <Packi />
          </div>
        </PackiProvider>
      </TourProvider>
    </MeProvider>
  );
}
