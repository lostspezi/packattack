import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";

const ERROR_MESSAGES: Record<string, { de: string; en: string }> = {
  OAuthAccountNotLinked: {
    de: "Dieser Account ist bereits mit einem anderen Konto verknüpft. Bitte melde dich mit deinem ursprünglichen Konto an.",
    en: "This account is already linked to another user. Please sign in with your original account.",
  },
  OAuthSignin: {
    de: "Problem bei der Anmeldung mit dem externen Anbieter.",
    en: "There was a problem signing in with the provider.",
  },
  OAuthCallback: {
    de: "Problem bei der Anmeldung mit dem externen Anbieter.",
    en: "There was a problem signing in with the provider.",
  },
  CredentialsSignin: {
    de: "Ungültige Anmeldedaten.",
    en: "Invalid credentials.",
  },
};

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { lang } = await params;
  const { error } = await searchParams;
  const dict = await getDictionary(lang as Locale, "auth.login");

  const errorMessage = error
    ? ERROR_MESSAGES[error]?.[lang as "de" | "en"] ?? ERROR_MESSAGES[error]?.en ?? (lang === "de" ? "Ein Fehler ist aufgetreten." : "An error occurred.")
    : null;

  return (
    <Card variant="soft" className="p-5 sm:p-8">
      {/* Error message */}
      {errorMessage && (
        <div className="mb-6 rounded-lg border border-error/20 bg-error/10 p-3">
          <p className="text-error text-sm text-center">{errorMessage}</p>
          {error === "OAuthAccountNotLinked" && (
            <p className="text-center mt-2">
              <Link href={`/${lang}/account`} className="text-pa-green text-xs font-medium hover:text-pa-green-hover">
                {lang === "de" ? "Zur Account-Verwaltung" : "Go to Account Settings"}
              </Link>
            </p>
          )}
        </div>
      )}

      {/* Subtitle */}
      <div className="mb-6 text-center">
        <p className="text-text-secondary text-sm">
          {dict["subtitle"] ?? "Welcome back"}
        </p>
      </div>

      {/* OAuth buttons */}
      <div className="mb-6">
        <OAuthButtons dict={dict} />
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
