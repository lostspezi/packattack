import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import connectDB from "@/lib/db";
import PlatformSettings from "@/models/platform-settings";
import { Card } from "@/components/ui/card";
import { AcceptTermsForm } from "@/components/auth/accept-terms-form";

export default async function AcceptTermsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "auth.acceptTerms");

  await connectDB();
  const settings = await PlatformSettings.findOne().lean();
  const tosVersion = settings?.tosVersion ?? "";
  const privacyVersion = settings?.privacyVersion ?? "";

  return (
    <Card variant="soft" className="p-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-wide mb-1">
          <span className="text-pa-green">PACK</span>
          <span className="text-text-primary">ATTACK</span>
          <span className="text-pa-green">.GG</span>
        </h1>
        <p className="text-text-secondary text-sm">
          {dict["subtitle"] ?? "Updated Terms"}
        </p>
      </div>

      <AcceptTermsForm
        dict={dict}
        lang={lang}
        tosVersion={tosVersion}
        privacyVersion={privacyVersion}
      />
    </Card>
  );
}
