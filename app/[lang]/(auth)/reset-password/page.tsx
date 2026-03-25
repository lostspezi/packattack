import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { lang } = await params;
  const { token } = await searchParams;
  const dict = await getDictionary(lang as Locale, "auth.resetPassword");

  return (
    <Card variant="soft" className="p-8">
      <div className="mb-6 text-center">
        <p className="text-text-secondary text-sm">
          {dict["subtitle"] ?? "Set New Password"}
        </p>
      </div>

      <ResetPasswordForm dict={dict} lang={lang} token={token ?? ""} />
    </Card>
  );
}
