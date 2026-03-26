import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import Link from "next/link";

interface ErrorInfo {
  message: string;
  backUrl: string;
  backLabel: string;
}

function getErrorInfo(
  error: string | undefined,
  lang: string,
  dict: Record<string, string>
): ErrorInfo {
  const defaultBack = {
    backUrl: `/${lang}/login`,
    backLabel: dict["link_back_to_login"] ?? "Zurück zum Login",
  };

  if (!error) {
    return { message: dict["error_default"] ?? "Ein Fehler ist aufgetreten.", ...defaultBack };
  }

  if (error === "OAuthAccountNotLinked") {
    return {
      message: dict["error_account_not_linked"] ?? "Dieser Account ist bereits mit einem anderen Konto verknüpft. Bitte melde dich mit deinem ursprünglichen Konto an oder trenne die Verknüpfung zuerst.",
      backUrl: `/${lang}/account`,
      backLabel: dict["link_back_to_account"] ?? "Zurück zum Account",
    };
  }

  if (error === "OAuthSignin" || error === "OAuthCallback") {
    return { message: dict["error_oauth"] ?? "Problem bei der Anmeldung mit dem externen Anbieter.", ...defaultBack };
  }

  if (error === "CredentialsSignin") {
    return { message: dict["error_credentials"] ?? "Ungültige Anmeldedaten.", ...defaultBack };
  }

  return { message: dict["error_default"] ?? "Ein Fehler ist aufgetreten.", ...defaultBack };
}

export default async function AuthErrorPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { lang } = await params;
  const { error } = await searchParams;
  const dict = await getDictionary(lang as Locale, "auth.error");

  const info = getErrorInfo(error, lang, dict);

  return (
    <Card variant="soft" className="p-8">
      <div className="mb-6 text-center">
        <p className="text-text-secondary text-sm">
          {dict["subtitle"] ?? "Authentifizierungsfehler"}
        </p>
      </div>

      <div className="flex flex-col gap-6 text-center">
        <div className="rounded-lg border border-error/20 bg-error/10 p-4">
          <p className="text-error font-medium">{info.message}</p>
          {error && (
            <p className="text-text-muted text-xs mt-1">
              {dict["error_code"] ?? "Fehlercode"}: {error}
            </p>
          )}
        </div>

        <Link
          href={info.backUrl}
          className="text-pa-green hover:text-pa-green-hover text-sm font-medium"
        >
          {info.backLabel}
        </Link>
      </div>
    </Card>
  );
}
