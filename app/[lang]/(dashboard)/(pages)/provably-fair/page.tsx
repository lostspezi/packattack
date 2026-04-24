import Link from "next/link";
import { Card } from "@/components/ui/card";

export const metadata = {
  title: "Provably Fair — PACKATTACK",
  description:
    "So beweisen wir, dass jeder Pull bei PACKATTACK unverfälscht ist — inklusive Live-Verifier.",
};

interface PageProps {
  params: Promise<{ lang: string }>;
}

export default async function ProvablyFairPage({ params }: PageProps) {
  const { lang } = await params;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold mb-2">Provably Fair</h1>
        <p className="text-text-secondary">
          Jede Karte, die du bei PACKATTACK ziehst, kannst du nachrechnen. Kein Vertrauen nötig —
          du prüfst selbst, ob das Ergebnis stimmt.
        </p>
      </header>

      <Card variant="topline" className="p-6">
        <h2 className="text-xl font-bold mb-3">Wie es funktioniert</h2>
        <p className="mb-3">
          Vor jeder Öffnung committet unser Server auf einen geheimen Server-Seed — du siehst davor nur den
          SHA-256-Hash. Den kannst du nicht vorhersagen, und wir können ihn nach dem Commit nicht mehr
          ändern.
        </p>
        <p className="mb-3">
          Deinen Client-Seed setzt du selbst. Zusammen mit einem hochgezählten Nonce pro Karte und einem
          Hash des Kartenpools zum Zeitpunkt der Öffnung geht alles in die HMAC-SHA512-Funktion. Die ersten
          8 Byte des Ergebnisses sind dein Bucket. Auf den Kartenpool übertragen ergibt das die gezogene
          Karte — deterministisch, nachvollziehbar, nicht manipulierbar.
        </p>
        <p>
          Wenn du möchtest, rotierst du deinen Server-Seed. Dann wird der vorherige Seed enthüllt und du
          kannst alle Pulls aus dieser Ära nachrechnen.
        </p>
      </Card>

      <Card variant="soft" className="p-6">
        <h2 className="text-xl font-bold mb-3">Die Formel</h2>
        <pre className="bg-white/5 rounded-[10px] p-4 font-mono text-sm overflow-x-auto">{`hmac   = HMAC_SHA512(
  key     = serverSeed,             // 64 hex chars, geheim bis rotiert
  message = clientSeed + ":" + nonce + ":" + poolHash
)

bucket = BigInt("0x" + hmac.slice(0, 16))  // erste 8 Bytes
bucket = bucket mod totalWeight            // in [0, totalWeight)
karte  = walk(pool, bucket)                // erste cumulative[i] > bucket`}</pre>
        <p className="text-sm text-text-secondary mt-3">
          Der Code, der das server-seitig ausführt, ist derselbe, der im Verifier in deinem Browser läuft.
          Beide leben in einer Datei — wenn einer lügen würde, flöge es sofort auf.
        </p>
      </Card>

      <Card variant="soft" className="p-6">
        <h2 className="text-xl font-bold mb-3">Einen Pull prüfen</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>
            Öffne deine <Link href={`/${lang}/account/history`} className="text-pa-green">Pull-History</Link> und
            klick bei einer Karte auf <span className="text-pa-green">Verify</span>.
          </li>
          <li>
            Falls der zugehörige Server-Seed schon enthüllt ist, läuft die Prüfung sofort. Falls nicht,
            rotiere deinen Seed auf <Link href={`/${lang}/account/fairness`} className="text-pa-green">Fairness &amp; Seeds</Link> —
            danach kannst du auch ältere Pulls prüfen.
          </li>
          <li>
            Der Verifier rechnet komplett in deinem Browser. Kein Server-Call nach dem initialen Laden.
          </li>
        </ol>
      </Card>

      <Card variant="soft" className="p-6">
        <h2 className="text-xl font-bold mb-3">FAQ</h2>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-bold mb-1">Warum HMAC-SHA512 und nicht SHA-256?</h3>
            <p className="text-text-secondary">
              Mehr Output-Platz. Wir nutzen davon erstmal nur die ersten 8 Byte, aber der Rest bleibt als
              Reserve für zukünftige Outcome-Varianten ohne Algo-Bruch.
            </p>
          </div>
          <div>
            <h3 className="font-bold mb-1">Warum fließt ein Pool-Hash in die HMAC ein?</h3>
            <p className="text-text-secondary">
              Er macht jede Öffnung einzigartig und verhindert, dass wir den Kartenpool zwischen
              Commit und Prüfen tauschen. Der Hash ist die ehrlichste Bindung dafür, weil er
              direkt auf den tatsächlichen Pool zeigt — nicht auf einen beliebigen Zufallswert.
            </p>
          </div>
          <div>
            <h3 className="font-bold mb-1">Kann eure Admin meinen Seed sehen?</h3>
            <p className="text-text-secondary">
              Admins können in Einzelfall-Audits auf aktive Server-Seeds zugreifen — jeder solche Zugriff
              landet in einem Audit-Log, das wir nicht löschen können. Deinen Client-Seed kann niemand
              serverseitig ändern, nur du.
            </p>
          </div>
          <div>
            <h3 className="font-bold mb-1">Was passiert mit alten Pulls nach einer Rotation?</h3>
            <p className="text-text-secondary">
              Sie bleiben prüfbar — der enthüllte Server-Seed ist in deiner Seed-Historie gespeichert. Jeder
              Pull hält fest, auf welchen Seed er sich bezieht.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex gap-3 flex-wrap">
        <Link
          href={`/${lang}/account/history`}
          className="bg-pa-green text-bg font-bold rounded-[10px] px-6 py-3"
        >
          Meine Pull-History
        </Link>
        <Link
          href={`/${lang}/account/fairness`}
          className="bg-white/4 text-text-primary border border-white/8 rounded-[10px] px-6 py-3"
        >
          Seeds verwalten
        </Link>
      </div>
    </div>
  );
}
