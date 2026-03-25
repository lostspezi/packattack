import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "auth.forgotPassword");

  return (
    <Card variant="soft" className="p-8">
      <div className="mb-6 text-center">
        <p className="text-text-secondary text-sm">
          {dict["subtitle"] ?? "Reset Your Password"}
        </p>
      </div>

      <ForgotPasswordForm dict={dict} lang={lang} />
    </Card>
  );
}
