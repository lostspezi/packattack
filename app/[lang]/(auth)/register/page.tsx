import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { RegisterForm } from "@/components/auth/register-form";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "auth.register");

  return (
    <Card variant="soft" className="p-5 sm:p-8">
      {/* Logo + subtitle */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-wide mb-1">
          <span className="text-pa-green">PACK</span>
          <span className="text-text-primary">ATTACK</span>
          <span className="text-pa-green">.GG</span>
        </h1>
        <p className="text-text-secondary text-sm">
          {dict["subtitle"] ?? "Create your account"}
        </p>
      </div>

      {/* OAuth buttons */}
      <div className="mb-6">
        <OAuthButtons />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-muted uppercase tracking-wider">
          {dict["divider"] ?? "or"}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Register form */}
      <RegisterForm dict={dict} lang={lang} />
    </Card>
  );
}
