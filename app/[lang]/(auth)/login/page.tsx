import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, "auth.login");

  return (
    <Card variant="soft" className="p-5 sm:p-8">
      {/* Subtitle */}
      <div className="mb-6 text-center">
        <p className="text-text-secondary text-sm">
          {dict["subtitle"] ?? "Welcome back"}
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

      {/* Login form */}
      <LoginForm dict={dict} lang={lang} />
    </Card>
  );
}
