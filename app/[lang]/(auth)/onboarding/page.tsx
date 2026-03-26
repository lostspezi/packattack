import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { Card } from "@/components/ui/card";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "auth.onboarding");

  const session = await auth();

  let initialName = "";
  let initialUsername = "";
  let initialEmail = "";
  let hasPassword = false;

  if (session?.user?.id) {
    await connectDB();
    const dbUser = await User.findById(session.user.id).lean();

    if (dbUser) {
      initialName = dbUser.name ?? "";
      initialUsername = dbUser.username ?? "";
      initialEmail = dbUser.email ?? "";
      hasPassword = !!dbUser.password;
    }
  }

  return (
    <Card variant="soft" className="p-8">
      <div className="mb-6 text-center">
        <p className="text-text-secondary text-sm">
          {dict["subtitle"] ?? "Please complete your profile to continue"}
        </p>
      </div>

      <OnboardingForm
        dict={dict}
        lang={lang}
        initialName={initialName}
        initialUsername={initialUsername}
        initialEmail={initialEmail}
        hasPassword={hasPassword}
      />
    </Card>
  );
}
