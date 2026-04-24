import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Ledger from "@/components/history/Ledger";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export const metadata = {
  title: "Pull-History — PACKATTACK",
};

export default async function HistoryPage({ params }: PageProps) {
  const { lang } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect(`/${lang}/login?callbackUrl=/${lang}/account/history`);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-4">
      <header>
        <h1 className="text-3xl font-bold mb-2">Pull-History</h1>
        <p className="text-text-secondary">
          Jeder Pull, den du je gezogen hast, chronologisch.{" "}
          <Link href={`/${lang}/provably-fair`} className="text-pa-green">
            Wie funktioniert Verify?
          </Link>
        </p>
      </header>

      <Ledger lang={lang} />
    </div>
  );
}
