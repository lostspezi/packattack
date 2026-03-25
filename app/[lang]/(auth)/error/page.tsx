import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Problem bei der Anmeldung",
  OAuthCallback: "Problem bei der Anmeldung",
  OAuthAccountNotLinked: "Problem bei der Anmeldung",
  CredentialsSignin: "Ungültige Anmeldedaten",
};

function getErrorMessage(
  error: string | undefined,
  dict: Record<string, string>
): string {
  if (!error) return dict["error_default"] ?? "Ein Fehler ist aufgetreten";

  if (error === "OAuthSignin" || error === "OAuthCallback" || error === "OAuthAccountNotLinked") {
    return dict["error_oauth"] ?? "Problem bei der Anmeldung";
  }

  if (error === "CredentialsSignin") {
    return dict["error_credentials"] ?? "Ungültige Anmeldedaten";
  }

  return dict["error_default"] ?? "Ein Fehler ist aufgetreten";
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

  const message = getErrorMessage(error, dict);

  return (
    <Card variant="soft" className="p-8">
      <div className="mb-6 text-center">
        <p className="text-text-secondary text-sm">
          {dict["subtitle"] ?? "Authentication Error"}
        </p>
      </div>

      <div className="flex flex-col gap-6 text-center">
        <div className="rounded-lg border border-error/20 bg-error/10 p-4">
          <p className="text-error font-medium">{message}</p>
          {error && (
            <p className="text-text-muted text-xs mt-1">
              {dict["error_code"] ?? "Error"}: {error}
            </p>
          )}
        </div>

        <Link
          href={`/${lang}/login`}
          className="text-pa-green hover:text-pa-green-hover text-sm font-medium"
        >
          {dict["link_back_to_login"] ?? "Back to Login"}
        </Link>
      </div>
    </Card>
  );
}
