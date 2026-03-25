import { auth } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { PlatformSettingsForm } from "@/components/admin/platform-settings-form";
import connectDB from "@/lib/db";
import PlatformSettings from "@/models/platform-settings";
import ConsentLog from "@/models/consent-log";

export default async function AdminPlatformPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  const [adminDict] = await Promise.all([
    getDictionary(lang as Locale, "admin"),
  ]);

  const session = await auth();
  void session;

  await connectDB();

  const settings = await PlatformSettings.findOne().lean();

  const tosVersion = settings?.tosVersion ?? "";
  const privacyVersion = settings?.privacyVersion ?? "";

  const [tosCount, privacyCount] = await Promise.all([
    ConsentLog.countDocuments({
      type: "tos",
      version: tosVersion,
      action: "accepted",
    }),
    ConsentLog.countDocuments({
      type: "privacy",
      version: privacyVersion,
      action: "accepted",
    }),
  ]);

  const pageTitle = adminDict["platform_pageTitle"] ?? "Platform Settings";
  const pageSubtitle =
    adminDict["platform_pageSubtitle"] ??
    "Manage TOS and Privacy Policy versions.";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">{pageTitle}</h2>
        <p className="text-text-secondary mt-1 text-sm">{pageSubtitle}</p>
      </div>

      <PlatformSettingsForm
        initial={{
          tosVersion,
          privacyVersion,
          updatedAt: settings?.updatedAt
            ? settings.updatedAt.toISOString()
            : null,
          consentStats: { tos: tosCount, privacy: privacyCount },
        }}
      />
    </div>
  );
}
