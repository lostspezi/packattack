# Pack Opening & Coin System — Design Spec

## Context

Admins können Boxen mit gewichteten Karten erstellen. User sollen jetzt Packs öffnen können:
Coins einsetzen, Karten ziehen, pro Karte entscheiden ob claimen oder in Coins umwandeln.
Admins verwalten Coin-Zuweisungen über eine eigene Transaktions-Seite.

---

## Datenmodelle

### `CoinTransaction` (neu)

Jede Coin-Bewegung wird protokolliert.

```
_id: ObjectId
userId: ObjectId (ref: User)
amount: number (positiv = Gutschrift, negativ = Abbuchung) — GANZZAHL
type: "admin_grant" | "admin_deduct" | "pack_purchase" | "card_conversion"
reason: string | null (Admin-Notiz bei manueller Zuweisung)
relatedPullId: ObjectId | null (ref: PackPull, bei card_conversion)
relatedBoxId: ObjectId | null (ref: Box, bei pack_purchase)
performedBy: ObjectId | null (ref: User, bei admin_grant/deduct)
createdAt: Date
```

Index: `userId + createdAt`, `type`

### `PackPull` (neu)

Jede einzelne gezogene Karte.

```
_id: ObjectId
userId: ObjectId (ref: User)
boxId: ObjectId (ref: Box)
cardId: ObjectId (ref: Card)
rarity: string
coinValue: number (internalPrice der Karte zum Zeitpunkt des Pulls) — GANZZAHL
conversionValue: number (coinValue × conversionRate, gerundet) — GANZZAHL
status: "pending" | "claimed" | "converted" | "expired"
claimDeadline: Date (createdAt + box.claimDeadlineHours)
decidedAt: Date | null
packGroupId: string (UUID, gruppiert Karten eines Pack-Openings)
packIndex: number (0-basiert, bei Multi-Pack: welches Pack)
cardIndex: number (0-basiert, Reihenfolge innerhalb des Packs)
ipAddress: string (IP des Users beim Öffnen)
userAgent: string (Browser/Device-Info)
createdAt: Date
```

Index: `userId + status`, `userId + packGroupId`, `claimDeadline + status`, `boxId + createdAt`

### `UserInventory` (neu)

Geclaimte Karten des Users.

```
_id: ObjectId
userId: ObjectId (ref: User)
cardId: ObjectId (ref: Card)
boxId: ObjectId (ref: Box, woher die Karte stammt)
pullId: ObjectId (ref: PackPull)
rarity: string
claimedAt: Date
```

Index: `userId`, `userId + cardId`

### Box-Erweiterung

Zwei neue Felder im Box-Schema:

```
coinConversionRate: number (default: 50, 1–100, Prozent des Coin-Werts bei Umwandlung)
claimDeadlineHours: number (default: 24, 1–168, Stunden zum Entscheiden)
```

### Coins-Regel

**Coins sind IMMER ganze Zahlen.** Überall wo Coins berechnet werden:
- `Math.floor()` bei Coin-Umwandlung (zugunsten der Plattform)
- `Math.round()` niemals — immer abrunden
- Minimum 1 Coin bei Umwandlung (auch wenn Berechnung < 1 ergibt)

---

## User-Flow

### 1. Box-Übersicht (User)

**Route:** `/[lang]/packs`

- Grid/Liste aller veröffentlichten Boxen (status: "published")
- Pro Box: Bild, Name, Spiel, Preis (Coins), Karten/Pack
- Klick → Box-Detail-Seite

### 2. Box-Detail (User)

**Route:** `/[lang]/packs/[id]`

- Box-Infos: Name, Beschreibung, Bild, Spiel
- Statistiken: Preis, Karten/Pack, Rarity-Verteilung (Übersicht, keine exakten %)
- Pack-Anzahl wählen: 1–10 (Buttons oder Input)
- Gesamtpreis anzeigen: `Anzahl × Preis` Coins
- "Pack(s) öffnen" Button
  - Disabled wenn: nicht genug Coins, Box pausiert/archiviert
  - Zeigt aktuellen Coin-Stand

### 3. Pack Opening

**Nach Klick auf "Öffnen":**

1. API-Call: Coins abziehen, Karten ziehen, PackPulls erstellen, Bestand reduzieren
2. Ergebnis-Seite/Modal: Karten einzeln aufdecken

**Kartenaufdeckung (eine nach der anderen):**
- Karte wird angezeigt: Bild, Name, Rarity, Coin-Wert
- Zwei Buttons:
  - **"Claimen"** → Karte geht ins Inventar, Bestand bleibt reduziert
  - **"In Coins umwandeln"** → User bekommt `conversionValue` Coins, Bestand wird wieder erhöht
- Nächste Karte wird aufgedeckt
- Optional: "Später entscheiden" → Karte bleibt pending

**Multi-Pack:** Bei mehreren Packs werden alle Karten hintereinander aufgedeckt (Pack 1 Karte 1, Pack 1 Karte 2, ..., Pack 2 Karte 1, etc.)

### 4. Pending-Karten

**Route:** Im Inventar oder eigener Bereich

- Liste aller pending Karten mit Countdown (Deadline)
- Pro Karte: Claimen oder in Coins umwandeln
- Nach Ablauf: Automatisch in Coins umgewandelt (Cron-Job oder lazy check)

### 5. Inventar

**Route:** `/[lang]/inventory` oder `/[lang]/collection`

- Alle geclaimten Karten des Users
- Gruppiert nach Box oder Spiel
- Kartenbild, Name, Rarity, Herkunft-Box, Claim-Datum

### 6. Pull-Historie

- Alle vergangenen Pack-Openings
- Pro Opening: Datum, Box, Karten mit Status (claimed/converted/expired)

---

## Admin: Coin-Verwaltung

### Admin-Seite: Coins

**Route:** `/[lang]/admin/coins`

**Funktionen:**
1. **User suchen** (Autocomplete nach Name/Email)
2. **Coins zuweisen/abziehen**:
   - Betrag eingeben (ganzzahlig)
   - Grund angeben (Pflichtfeld)
   - "Zuweisen" / "Abziehen" Button
3. **Transaktions-Historie**:
   - Tabelle: Datum, User, Betrag, Typ, Grund, durchgeführt von
   - Filterbar nach User, Typ, Zeitraum

### Sidebar-Eintrag

Neuer Eintrag im Admin-Menü: "Coins" mit `Coins`-Icon

---

## API-Routen

### User-Routen (authentifiziert, kein Admin nötig)

```
GET  /api/packs                    — Veröffentlichte Boxen auflisten
GET  /api/packs/[id]               — Box-Detail für User
POST /api/packs/[id]/open          — Pack(s) öffnen (Coins abziehen, Karten ziehen)
POST /api/pulls/[id]/claim         — Pending-Karte claimen
POST /api/pulls/[id]/convert       — Pending-Karte in Coins umwandeln
GET  /api/pulls                    — Eigene Pulls (Historie + Pending)
GET  /api/inventory                — Eigene geclaimte Karten
```

### Admin-Routen

```
GET  /api/admin/coins/transactions       — Transaktions-Historie (paginiert, filterbar)
POST /api/admin/coins/grant              — Coins zuweisen/abziehen
GET  /api/admin/boxes/[id]/stats         — Box-KPIs (period: 24h|7d|30d|all)
GET  /api/admin/boxes/[id]/pulls         — Pull-Historie pro Box (paginiert, filterbar)
```

---

## Pack-Opening-Logik (Server-seitig)

### `POST /api/packs/[id]/open`

```
Input: { packCount: number (1–10) }

1. Validierung:
   - User authentifiziert
   - Box existiert & status === "published"
   - packCount zwischen 1 und 10
   - Genug Coins: user.coins >= box.priceInCoins × packCount
   - Genug verfügbare Karten (stock > 0) für cardsPerPack × packCount

2. Karten ziehen (gleicher Algorithmus wie Simulation):
   - Nur Karten mit stock > 0
   - Gewichtete Zufallsauswahl (binary search über cumulative weights)
   - cardsPerPack × packCount Karten total
   - WICHTIG: Nach jedem Draw den Stock der gezogenen Karte um 1 reduzieren
     (damit eine Karte mit Stock 1 nicht 2x gezogen wird)

3. Atomare Transaktion:
   - User.coins -= totalCost ($inc: -totalCost)
   - Box.packsOpened += packCount
   - Pro gezogene Karte:
     - Box.cards[].stock -= 1
     - PackPull erstellen (status: "pending")
   - CoinTransaction erstellen (type: "pack_purchase")

4. Response: packGroupId + gezogene Karten (für Frontend-Anzeige)
```

### Stock-Handling bei Decisions

**Claim:**
- PackPull.status → "claimed"
- UserInventory erstellen
- Stock bleibt reduziert (Karte ist beim User)

**Convert:**
- PackPull.status → "converted"
- User.coins += conversionValue
- Box.cards[].stock += 1 (Karte geht zurück in den Pool)
- CoinTransaction erstellen (type: "card_conversion")

**Expired (Deadline abgelaufen):**
- Gleich wie Convert (auto-Conversion)

---

## Deadline-Handling

Zwei Strategien kombiniert:

1. **Lazy Check:** Bei jedem `GET /api/pulls` und `GET /api/inventory` werden abgelaufene pending Pulls automatisch konvertiert.
2. **Cron (optional, später):** Periodischer Job der abgelaufene Pulls konvertiert.

Für den Anfang reicht Lazy Check.

---

## Low-Stock Notifications

Wenn beim Pack-Opening eine Karte unter `minStock` fällt:
- In-App Notification an alle Admins/Super-Admins
- E-Mail an alle Admins/Super-Admins

Wenn Stock auf 0 fällt:
- Nochmal Notification + E-Mail: "Karte X in Box Y ausverkauft"

Nutzt das bestehende Notification-System (`POST /api/notifications/send`) und Email-Template-System.

---

## Admin: Box-KPIs & Pull-Historie

### Box-Detail-Seite (Admin) — neuer Abschnitt

Auf der bestehenden Admin-Box-Detail-Seite wird ein neuer Bereich hinzugefügt mit Live-KPIs und Pull-Historie.

### KPIs pro Box

Berechnet aus `PackPull` + `CoinTransaction` Daten. Zeitfilter: 24h, 7d, 30d, All Time.

| KPI | Berechnung | Beschreibung |
|-----|-----------|-------------|
| **Packs geöffnet** | `Box.packsOpened` bzw. count PackPulls im Zeitraum / cardsPerPack | Gesamtanzahl geöffneter Packs |
| **Umsatz (Coins)** | Summe CoinTransactions type=pack_purchase für Box | Einnahmen durch Pack-Verkäufe |
| **Auszahlungen (Coins)** | Summe CoinTransactions type=card_conversion für Box | Ausgaben durch Coin-Umwandlungen |
| **Marge (Coins)** | Umsatz − Auszahlungen | Plattform-Gewinn in Coins |
| **Marge (%)** | Marge / Umsatz × 100 | Prozentuale Marge |
| **Unique User** | Distinct userId in PackPulls für Box | Wie viele verschiedene User Packs geöffnet haben |
| **Ø Packs pro User** | Packs geöffnet / Unique User | Durchschnitt wie viele Packs ein User öffnet |
| **Claim-Rate (%)** | Claimed / (Claimed + Converted + Expired) × 100 | Wie oft User Karten claimen statt umwandeln |
| **Beliebteste Karte** | Karte mit höchstem Claim-Count | Welche Karte wird am häufigsten geclaimed |
| **Umsatzstärkste Karte** | Karte mit höchstem Coin-Umsatz (Pulls × CoinValue) | Welche Karte generiert am meisten Umsatz |
| **Karten mit Stock 0** | Count cards mit stock === 0 | Ausverkaufte Karten |
| **Karten unter Mindestbestand** | Count cards mit stock <= minStock | Karten die nachbestellt werden müssen |
| **Avg. Pack-Wert** | Summe aller Pull-CoinValues / Packs geöffnet | Durchschnittlicher Wert eines geöffneten Packs |
| **Conversion-Wert vs. Coin-Wert** | Summe conversionValues / Summe coinValues | Zeigt wie viel % des Kartenwerts tatsächlich ausgezahlt wird |

### Zeitreihen-Charts

- **Packs pro Tag** (Balkendiagramm, letzte 30 Tage)
- **Umsatz vs. Auszahlungen pro Tag** (Liniendiagramm, überlagert)
- **Marge pro Tag** (Fläche, grün wenn positiv, rot wenn negativ)

### Pull-Historie (Admin, pro Box)

**Route:** Tab oder eigener Bereich auf Admin-Box-Detail-Seite

Vollständige, filterbare Tabelle aller Pack-Openings:

| Spalte | Beschreibung |
|--------|-------------|
| **Zeitpunkt** | Timestamp des Pack-Openings |
| **User** | Name/Username + Link zum User-Profil |
| **IP-Adresse** | IP des Users beim Öffnen |
| **Pack-Gruppe** | packGroupId (gruppiert Multi-Packs) |
| **Karte** | Kartenname + Bild (Thumbnail) |
| **Rarity** | Rarity der gezogenen Karte |
| **Coin-Wert** | coinValue zum Zeitpunkt des Pulls |
| **Status** | pending / claimed / converted / expired |
| **Entscheidung** | Zeitpunkt + was gewählt wurde |

**Filter:**
- Zeitraum (von–bis)
- User (Autocomplete)
- Status (pending/claimed/converted/expired)
- Rarity
- Karte

**Export:** CSV-Download der gefilterten Daten (optional, später)

### API-Routen (Admin, Box-KPIs)

```
GET /api/admin/boxes/[id]/stats?period=24h|7d|30d|all   — KPIs für eine Box
GET /api/admin/boxes/[id]/pulls?page=1&limit=50&...      — Pull-Historie (paginiert, filterbar)
```

### Globale Admin-KPIs (optional, Dashboard)

Auf der Admin-Übersichtsseite (`/admin`):

| KPI | Beschreibung |
|-----|-------------|
| **Gesamtumsatz (Coins)** | Alle Pack-Purchases über alle Boxen |
| **Gesamte Packs geöffnet** | Alle Boxen zusammen |
| **Aktive User (7d)** | User die in den letzten 7 Tagen ein Pack geöffnet haben |
| **Top-Box** | Box mit dem höchsten Umsatz |
| **Gesamt-Marge** | Umsatz − Auszahlungen über alle Boxen |

---

## Neue Seiten

| Route | Beschreibung | Zugang |
|-------|-------------|--------|
| `/[lang]/packs` | Box-Übersicht für User | Alle authentifizierten User |
| `/[lang]/packs/[id]` | Box-Detail + Pack öffnen | Alle authentifizierten User |
| `/[lang]/inventory` | Geclaimte Karten | Alle authentifizierten User |
| `/[lang]/admin/coins` | Coin-Verwaltung | Admin/Super-Admin |

---

## Navigation-Updates

**User-Navigation (Header + Sidebar):**
- "Packs" aktivieren (bisher "coming soon") → `/packs`
- "Inventar" hinzufügen → `/inventory`

**Admin-Navigation:**
- "Coins" hinzufügen → `/admin/coins`

---

## Box-Form-Erweiterung

Zwei neue Felder in der Admin-Box-Bearbeitung:

| Feld | Beschreibung | Default |
|------|-------------|---------|
| Umwandlungsrate (%) | Wie viel % des Coin-Werts bei Umwandlung | 50 |
| Entscheidungsfrist (h) | Stunden bis auto-Conversion | 24 |

---

## Coin-Integrität

- `User.coins` ist die Single Source of Truth
- Jede Änderung via `$inc` (atomar)
- Jede Änderung erzeugt eine `CoinTransaction`
- Vor Pack-Kauf: `coins >= totalCost` prüfen
- Race Conditions: MongoDB `$inc` + Validierung in einer Operation

---

## Verifikation

1. Admin weist User 100 Coins zu → Transaktion sichtbar in Admin-Coins-Seite
2. User sieht Coin-Stand im Header/Profil
3. User öffnet Box-Übersicht, sieht veröffentlichte Boxen
4. User wählt Box, wählt 2 Packs, sieht Gesamtpreis
5. "Öffnen" → Coins abgezogen, Karten einzeln aufgedeckt
6. Karte 1: Claimen → geht ins Inventar, Bestand in Box reduziert
7. Karte 2: In Coins umwandeln → Coins gutgeschrieben, Bestand erhöht
8. Karte 3: "Später" → pending mit Countdown
9. Pending-Karte nach Deadline → auto-converted, Coins gutgeschrieben
10. Inventar zeigt geclaimte Karten
11. Pull-Historie zeigt alle Openings
12. Admin: Box-KPIs zeigen Umsatz, Marge, Packs geöffnet mit Zeitfilter
13. Admin: Pull-Historie zeigt alle Pulls mit User, IP, Karte, Status
14. Admin: Zeitreihen-Charts für Packs/Tag und Umsatz/Tag
15. IP-Adresse und User-Agent werden bei jedem Pack-Opening gespeichert
