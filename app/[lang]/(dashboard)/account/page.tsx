import { auth } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { ChangeEmailForm } from "@/components/account/change-email-form";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { LinkedProviders } from "@/components/account/linked-providers";
import { DeleteAccount } from "@/components/account/delete-account";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { MongoClient } from "mongodb";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  const session = await auth();

  const [accountDict] = await Promise.all([
    getDictionary(lang as Locale, "account"),
  ]);

  await connectDB();
  const user = await User.findById(session!.user!.id).select("+password").lean();

  const hasPassword = !!user?.password;
  const currentEmail = user?.email ?? session!.user!.email ?? "";

  // Fetch linked providers via MongoDB native client
  const mongoClient = new MongoClient(process.env.MONGODB_URI!);
  let linkedProviders: Array<{ provider: string; providerAccountId: string }> = [];
  try {
    await mongoClient.connect();
    const db = mongoClient.db();
    const accounts = await db
      .collection("accounts")
      .find({ userId: session!.user!.id })
      .toArray();
    linkedProviders = accounts.map((a) => ({
      provider: String(a.provider),
      providerAccountId: String(a.providerAccountId),
    }));
  } finally {
    await mongoClient.close();
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {accountDict["pageTitle"] ?? "Account"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {accountDict["pageSubtitle"] ?? "Manage your account security and linked providers."}
        </p>
      </div>

      {/* Change Email */}
      <Card variant="soft" className="p-6">
        <h3 className="text-base font-semibold text-text-primary mb-4">
          {accountDict["section_change_email"] ?? "Change Email"}
        </h3>
        <ChangeEmailForm
          dict={accountDict}
          currentEmail={currentEmail}
        />
      </Card>

      {/* Change Password — only if user has a password */}
      {hasPassword && (
        <Card variant="soft" className="p-6">
          <h3 className="text-base font-semibold text-text-primary mb-4">
            {accountDict["section_change_password"] ?? "Change Password"}
          </h3>
          <ChangePasswordForm dict={accountDict} />
        </Card>
      )}

      {/* Linked Providers */}
      <Card variant="soft" className="p-6">
        <h3 className="text-base font-semibold text-text-primary mb-4">
          {accountDict["section_linked_providers"] ?? "Linked Providers"}
        </h3>
        <LinkedProviders
          dict={accountDict}
          lang={lang}
          initialProviders={linkedProviders}
        />
      </Card>

      {/* Danger Zone */}
      <Card variant="soft" className="p-6 border-error/20">
        <h3 className="text-base font-semibold text-error mb-1">
          {accountDict["section_danger_zone"] ?? "Danger Zone"}
        </h3>
        <p className="text-sm text-text-secondary mb-4">
          {accountDict["danger_subtitle"] ?? "Actions here cannot be undone."}
        </p>
        <DeleteAccount dict={accountDict} lang={lang} />
      </Card>
    </div>
  );
}
