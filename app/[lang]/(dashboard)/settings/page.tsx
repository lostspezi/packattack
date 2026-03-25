import { auth } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { SettingsForm } from "@/components/settings/settings-form";
import connectDB from "@/lib/db";
import User from "@/models/user";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  const session = await auth();

  const [settingsDict] = await Promise.all([
    getDictionary(lang as Locale, "settings"),
  ]);

  await connectDB();
  const user = await User.findById(session!.user!.id).lean();

  const initialSettings = {
    language: (user?.preferences?.language ?? "en") as "de" | "en",
    theme: (user?.preferences?.theme ?? "dark") as "dark" | "light",
    notifications: {
      email: user?.preferences?.notifications?.email ?? true,
      browser: user?.preferences?.notifications?.browser ?? true,
    },
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {settingsDict["pageTitle"] ?? "Settings"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {settingsDict["pageSubtitle"] ?? "Manage your preferences and notifications."}
        </p>
      </div>

      <Card variant="soft" className="p-6">
        <SettingsForm
          dict={settingsDict}
          lang={lang}
          initialSettings={initialSettings}
        />
      </Card>
    </div>
  );
}
