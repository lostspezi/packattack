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
    <Card variant="soft" className="p-8">
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
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-surface px-3 text-text-muted uppercase tracking-wider">
            {dict["divider"] ?? "or"}
          </span>
        </div>
      </div>

      {/* Register form */}
      <RegisterForm dict={dict} lang={lang} />
    </Card>
  );
}
