# Godpack — Manueller Testplan

Branch: `feature/godpack` (8 Phasen + 1 Fix-Commit, alles ohne Co-Author-Footer).
Status: typecheck ✓, lint:fix ohne neue Issues in den geänderten Dateien.

> Ziel: ein einmal in ~10.000 Pack-Pulls auftretender Godpack-Drop, der einem zufälligen aktiven Opener 5 unique Karten ≥ 20 Coins aus dem Franchise gibt, fancy animiert wird und das Event live an alle anderen User broadcastet.

## Vorbereitung

1. **Branch checkouten und installieren**
   ```bash
   git checkout feature/godpack
   npm install
   ```
2. **Mongo-Setup**: Replica Set ist für die Provably-Fair-Pfade ohnehin nötig. Counter-Singleton wird beim ersten Pack-Open automatisch upserted (Default `nextTriggerAt = randomInt(9500, 10500)`).
3. **Dev-Server starten**: `npm run dev`
4. **Zwei Browser** vorbereiten (z. B. Chrome regulärer Profil + Inkognito), bei beiden mit unterschiedlichen Test-Usern eingeloggt.

## A. Smoke-Tests (ohne Trigger)

| # | Schritt | Erwartung |
|---|---------|-----------|
| A1 | Eine published Box öffnen, 1 Pack | Animation läuft normal. Cards werden sequentiell revealed. Keine cosmic-Banner. Keine `godpack`-Felder im Network-Response. |
| A2 | Multi-Open (z. B. 5 Packs) | 5 × `cardsPerPack` Karten. Keine cosmic-Reveal. PackPull-Einträge in DB ohne `isGodpack: true`. |
| A3 | Reduced-Motion in DevTools an, 1 Pack öffnen | Skip-Animation, sofort zur Pull-History (`PendingPullsGuard`). Keine Regression. |

Erwartete DB-Effekte:
- `godpackcounters` hat 1 Doc, `totalPacksOpened` ist nach diesen Tests = Summe der gerade geöffneten Packs.
- `nextTriggerAt` ist unverändert (irgendwo bei 9500–10500 + bisherige Trigger-Advances).

## B. Trigger erzwingen (Dev-Tooling)

Counter manuell auf den Trigger setzen, um den Godpack-Pfad zu erleben:

```js
// Mongo-Shell oder MongoDB Compass
use packattack
db.godpackcounters.updateOne({}, { $set: { totalPacksOpened: 9999, nextTriggerAt: 10000 } })
```

Anschließend mit User-A eine reguläre Box öffnen (1 Pack):

| # | Schritt | Erwartung |
|---|---------|-----------|
| B1 | User A öffnet 1 Pack einer beliebigen published Box | Cosmic-Pre-Reveal startet (~2,6 s, "DU WURDEST AUSERWÄHLT × {GAME} GODPACK"). Danach Pack-Ripping → Card-Reveal mit ★ GODPACK ★ Header. Alle 5 Karten ≥ 20 Coins (Network-Response `godpack.totalCoinValue ≥ 100`). |
| B2 | Während B1 läuft: User B (anderer Browser, Dashboard offen) | Banner-Toast oben "★ {Username} zieht GERADE ein GODPACK — {Game}" für ~8 s. Erscheint NICHT bei User A selbst. |
| B3 | User A klickt "Weiter zur Übersicht" | POST `/api/godpacks/{eventId}/reveal`. Bei User B erscheint im Chat eine System-Message mit allen 5 Karten als Galaxy-Card. |
| B4 | DB-Inspektion | `godpackevents`: 1 Doc mit 5 cards, `revealedAt` gesetzt, `chatMessageId` gesetzt. `packpulls`: 5 Docs mit `isGodpack: true`, gleicher `godpackEventId`, `godpackPosition` 1..5. `packopencommitments`: 2 Docs (`kind: "regular"` + `kind: "godpack"`), beide mit demselben `serverSeedId`. |
| B5 | Pull-History (`/{lang}/pulls` oder MyPulls-Widget) | Karten aus B1 zeigen das ★ GP-Badge. |

## C. Multi-Open trifft Trigger mittendrin

```js
db.godpackcounters.updateOne({}, { $set: { totalPacksOpened: 9995, nextTriggerAt: 9999 } })
```

User A öffnet 10 Packs.

| # | Erwartung |
|---|-----------|
| C1 | 9 reguläre Packs + 1 Godpack. Counter danach: `totalPacksOpened = 10005`, `nextTriggerAt` neu im Bucket. |
| C2 | Godpack landet auf `packIndex = 9999 - 9995 - 1 = 3` (= 4. Pack der Multi-Open, 0-basiert). |
| C3 | Reveal-Stack zeigt alle 50 Karten + 5 Godpack-Karten gemeinsam. ★ GODPACK ★ Header sichtbar. |
| C4 | DB: 50 reguläre PackPulls (`isGodpack: false`) + 5 godpack PackPulls (`isGodpack: true`). PackOpenCommitments mit getrennten Nonce-Ranges (`regular: [n, n+50)`, `godpack: [n+50, n+55)`). |

## D. Race-Test (zwei User gleichzeitig)

```js
db.godpackcounters.updateOne({}, { $set: { totalPacksOpened: 9999, nextTriggerAt: 10000 } })
```

User A und User B im selben Augenblick `Open` klicken (z. B. via DevTools Snippet, das `fetch("/api/packs/{slug}/open", ...)` zeitgleich abfeuert).

| # | Erwartung |
|---|-----------|
| D1 | Genau einer der beiden bekommt `godpack: { ... }` in der Response. |
| D2 | DB: `godpackevents` enthält genau 1 neuen Eintrag. |
| D3 | `nextTriggerAt` ist nach beiden Calls eindeutig advanced (kein "Trigger stuck" mehr). |

## E. Pool-Insufficient-Edge

Test-Franchise vorbereiten, in dem (a) keine Karte ≥ 20 Coins existiert UND (b) weniger als 5 Karten ≥ 10 Coins existieren. Dazu eine kleine Test-Box im Admin anlegen mit 3 Cheap-Karten.

```js
db.godpackcounters.updateOne({}, { $set: { totalPacksOpened: 9999, nextTriggerAt: 10000 } })
```

User A öffnet 1 Pack der Test-Box.

| # | Erwartung |
|---|-----------|
| E1 | Reguläres Pack-Result, kein cosmic-Reveal (Response `godpack: null`). |
| E2 | Counter danach: `totalPacksOpened = 10000`, `nextTriggerAt = 10001` (retract auf next pull). |
| E3 | User B (anderes Franchise mit großem Pool) öffnet jetzt 1 Pack → bekommt das Godpack. |

## F. Provably-Fair-Audit

| # | Schritt | Erwartung |
|---|---------|-----------|
| F1 | Nach einem Godpack-Pull: aus DB `serverSeed` aus `fairnessseeds` entnehmen (sobald Seed rotated wurde) und `clientSeed` aus User-Doc | Mit dem existing Verifier `lib/fairness.ts:replayDraws()` lokal die Karten neu berechnen — sowohl reguläre als auch Godpack. |
| F2 | `poolSnapshot` der beiden Commitments | Bei `kind: "regular"` matcht der Box-Pool, bei `kind: "godpack"` matcht der Franchise-Pool (sortiert nach cardId asc, Stock=1 pro Karte, weight=1000). |
| F3 | `poolHash` neu berechnen aus `poolSnapshot` | matched mit dem im Commitment gespeicherten `poolHash`. |

## G. Counter-Persistence

| # | Schritt | Erwartung |
|---|---------|-----------|
| G1 | Server stoppen, Counter-Doc unverändert lassen, Server starten | Nächster Open setzt nahtlos auf altem Stand auf. |
| G2 | `godpackcounters` Collection droppen, ein Pack öffnen | Counter wird mit Defaults erstellt: `totalPacksOpened = packCount`, `nextTriggerAt = randomInt(9500..10500)`. |

## H. UX-/Accessibility-Spotchecks

| # | Schritt | Erwartung |
|---|---------|-----------|
| H1 | Pre-Reveal Build-up bei Tastatur-Nav | Skip-Button bleibt erreichbar (Top-Right). Timer von 2,6 s läuft sauber durch. |
| H2 | Toast bei mehrfach gleichzeitigem Trigger im selben Browser | Mehrere Toasts stacken vertikal mit `layout`-Animation. |
| H3 | Sound aus / niedrige Volume | Pre-Reveal feuert dennoch, aber stumm. |
| H4 | Mobil (responsive) | Toast bleibt unter 100% Breite, Pre-Reveal-Title skaliert (`text-3xl sm:text-5xl`). |

## I. Was ich nicht testen konnte (Codebase ist nicht live)

- **End-to-End Live-Streaming**: Redis Pub/Sub + SSE wurde nicht aus einem laufenden Browser durchgespielt (mein Sandbox kennt keine UI-Session).
- **Browser-Reveal-Performance**: Cosmic-Animation könnte auf low-end Mobile schwächeln; bitte messen mit Chrome DevTools FPS-Meter (Ziel: ≥ 30 fps während Build-up).
- **Reveal-Acknowledge auf Skip**: Aktuell fired das Acknowledge auch beim Skip — andere User sehen die Chat-Message dann womöglich VOR dem User selbst gut zurechtkommt. Bewusst akzeptiert: der Pull ist fair und der Public-Hype gehört der Plattform, nicht der User-Geduld. Bitte UX-Feedback nach erstem Real-Drop einholen.

## Bekannte offene Punkte

1. **Sound für Cosmic-Phase**: Nur "epic" wird abgespielt, kein dedizierter Cosmic-Drone. Polish-Folge-PR.
2. **Mobile-Performance**: Pre-Reveal nutzt 12 SVG-Strahlen mit Rotation + 2 Backdrop-Layern. Bei schwachen Geräten ggf. fallback ohne Strahlen.
3. **Provably-Fair-UI im Verify-Page**: Funktioniert mit dem regulären Commitment; für die Godpack-Commitment-Verlinkung im UI ggf. prüfen, ob `commitmentId` aus `result.godpack.fairnessProof.commitmentId` korrekt durchgereicht wird (Card-Reveal-Stack tut das schon).

## Test-Reihenfolge-Empfehlung

A → B → C → D → E → F → G → H. Block A reicht für ein "wir können es deployen mit Feature-Flag off". Blocks B–E sind die Kern-Funktion. F ist optional aber stark empfohlen vor erstem realen Drop. G/H sind Härtung.
