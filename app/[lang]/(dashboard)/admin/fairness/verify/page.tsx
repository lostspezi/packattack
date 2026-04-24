import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import FreeformVerifier from "@/components/fairness/FreeformVerifier";

function isAdminRole(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

interface PageProps {
  params: Promise<{ lang: string }>;
}

export const metadata = { title: "Freeform-Verifier — PACKATTACK" };

export default async function AdminFreeformVerifyPage({ params }: PageProps) {
  const { lang } = await params;

  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  if (!session?.user || !isAdminRole(role)) {
    redirect(`/${lang}/dashboard`);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-4">
      <header>
        <h1 className="text-3xl font-bold mb-1">Freeform-Verifier</h1>
        <p className="text-text-secondary">
          Beliebige Seeds, Nonce und Pool durchrechnen — für Incident-Analysen. Läuft komplett im
          Browser, keine Daten werden an den Server geschickt.
        </p>
      </header>
      <FreeformVerifier />
    </div>
  );
}
