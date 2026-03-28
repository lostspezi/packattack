# Versand- & Reservierungssystem — Dokumentation

## Konzept

Das Versand- und Reservierungssystem ersetzt das alte permanente Karteninventar (`/claimed`). Jede geclaimte Karte landet jetzt in einem **6-Stunden-Warenkorb** statt in einer dauerhaften Sammlung. Innerhalb dieser Frist muss der User den Versand abschließen — sonst werden die Karten automatisch in Coins umgewandelt.

**Kernprinzip:** Kein dauerhaftes Inventar. Claim = Warenkorb = Checkout oder automatische Umwandlung.

---

## Ablauf aus User-Sicht

```
Pack öffnen → Karte ziehen → Entscheidung pro Karte:
  ├─ "Warenkorb" → Karte wird reserviert, landet im Warenkorb
  └─ "In Coins"  → Karte wird sofort in Coins umgewandelt

Im Warenkorb (ein 6h-Timer für den gesamten Warenkorb):
  ├─ Erste geclaimte Karte startet den 6h-Timer
  ├─ Alle weiteren Claims übernehmen dieselbe Ablaufzeit
  ├─ Einzelne Karten manuell in Coins umwandeln
  ├─ Globaler Countdown-Timer im Banner
  └─ Checkout: Adresse + Zahlung (Coins oder Stripe) → Bestellung

Nach 6h ohne Checkout:
  └─ Automatische Umwandlung ALLER Karten in Coins + Benachrichtigung

1h vor Ablauf:
  └─ Warnungs-Benachrichtigung
```

---

## Datenmodelle

### CartItem (`models/cart-item.ts`)

Ersetzt das alte `UserInventory`-Model. Speichert reservierte Karten mit Ablaufzeit.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `userId` | ObjectId → User | Besitzer |
| `cardId` | ObjectId → Card | Die gezogene Karte |
| `boxId` | ObjectId → Box | Aus welcher Box |
| `pullId` | ObjectId → PackPull | Unique — verhindert Duplikate |
| `rarity` | String | Seltenheit der Karte |
| `conversionValue` | Number | Coin-Wert bei Umwandlung |
| `status` | `reserved` \| `checked_out` \| `expired` | Aktueller Zustand |
| `expiresAt` | Date | Ablaufzeitpunkt (geteilt über gesamten Warenkorb) |
| `warningNotified` | Boolean | Ob 1h-Warnung gesendet wurde |
| `orderId` | ObjectId → Order \| null | Zugehörige Bestellung nach Checkout |

**Indexes:**
- `(userId, status)` — schnelles Laden des Warenkorbs
- `(expiresAt, status)` — für den Expiry-Worker
- `(pullId)` unique — verhindert doppeltes Claimen

**Status-Übergänge:**
```
reserved → checked_out  (Checkout erfolgreich)
reserved → expired      (Ablauf oder manuelle Umwandlung)
```

### Order (`models/order.ts`)

Gruppiert Karten einer Bestellung mit Versand- und Zahlungsinfos.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `userId` | ObjectId → User | Besteller |
| `orderNumber` | String (unique) | Format: `PA-YYYYMMDD-XXXX` |
| `items[]` | Array | Bestellte Karten (cartItemId, cardId, rarity) |
| `shippingAddress` | Subdoc | Name, Straße, Stadt, PLZ, Land (DE/AT/CH) |
| `paymentMethod` | `coins` \| `stripe` | Zahlungsart |
| `paymentStatus` | `pending` \| `paid` \| `failed` \| `refunded` | Zahlungsstatus |
| `shippingCostCents` | Number | Versandkosten in Cent |
| `shippingCostCoins` | Number | Versandkosten in Coins |
| `stripeSessionId` | String \| null | Stripe Checkout Session ID |
| `stripePaymentIntentId` | String \| null | Stripe Payment Intent ID |
| `fulfillments[]` | Array<Fulfillment> | Versandaufträge (siehe unten) |
| `status` | String | Bestellstatus (siehe unten) |

**Bestellstatus:**
```
pending_payment → paid → processing → shipped → delivered
                     └→ cancelled (bei Stripe-Timeout)
```

**Fulfillment-Subdokument:**

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `shopId` | ObjectId \| null | Shop der versendet (null = Plattform) |
| `items[]` | Array | Zugewiesene Karten |
| `status` | `pending` \| `processing` \| `shipped` \| `delivered` | Versandstatus |
| `trackingNumber` | String \| null | Sendungsverfolgung |
| `shippedAt` | Date \| null | Versanddatum |

### ShippingTier (`models/shipping-tier.ts`)

Admin-konfigurierbare Versandkosten-Staffeln.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `country` | `DE` \| `AT` \| `CH` | Zielland |
| `minCards` | Number | Mindestanzahl Karten |
| `maxCards` | Number | Maximalanzahl Karten |
| `costCents` | Number | Preis in Cent (für Stripe) |
| `costCoins` | Number | Preis in Coins |
| `isActive` | Boolean | Aktiv/Deaktiviert |

**Beispiel:**

| Land | Min | Max | Cent | Coins | Aktiv |
|------|-----|-----|------|-------|-------|
| DE | 1 | 5 | 299 | 150 | ja |
| DE | 6 | 15 | 499 | 250 | ja |
| AT | 1 | 5 | 499 | 250 | ja |

### Geänderte bestehende Models

- **PackPull**: Status-Enum um `"reserved"` erweitert (`reserved` → `claimed` nach Checkout, oder → `converted` bei Ablauf)
- **User**: `shippingAddress`-Subdoc (wird bei Checkout gespeichert/vorausgefüllt) + `reservationRulesAccepted: Date`
- **CoinTransaction**: Neue Typen `"shipping_payment"` und `"reservation_expired"` + `relatedOrderId`-Feld

---

## API-Endpunkte

### Pack-Opening (geändert)

**`POST /api/pulls/decide`**

Beim Claimen wird jetzt ein `CartItem` erstellt statt eines `UserInventory`. Die erste geclaimte Karte startet einen 6h-Timer für den gesamten Warenkorb — alle weiteren Claims übernehmen dieselbe Ablaufzeit.

- Claim-Response: `{ decision: "reserved", expiresAt: "ISO-String", newBalance }`
- Convert-Response: `{ decision: "converted", newBalance }`

### Warenkorb

**`GET /api/cart`** — Reservierte Karten laden
```json
{
  "items": [
    {
      "_id": "...",
      "card": { "name": "Luffy", "image": "...", "rarity": "SR" },
      "box": { "name": { "de": "OP Box 1" } },
      "rarity": "SR",
      "conversionValue": 50,
      "expiresAt": "2026-03-28T18:00:00Z",
      "remainingSeconds": 18432
    }
  ],
  "totalItems": 3
}
```

**`DELETE /api/cart/[itemId]`** — Karte manuell in Coins umwandeln
```json
{ "success": true, "convertedCoins": 50, "newBalance": 1250 }
```

**`POST /api/cart/shipping-estimate`** — Versandkosten-Schätzung
- Body: `{ "country": "DE" }`
- Response: `{ "cardCount": 5, "costCents": 299, "costCoins": 150, "tierFound": true }`

### Checkout

**`POST /api/cart/checkout`**
- Body: `{ "paymentMethod": "coins"|"stripe", "address": { "name", "street", "city", "zip", "country" }, "lang": "de" }`

**Coins-Zahlung:**
1. Redis Distributed Lock (`SETNX checkout:{userId}`, 30s TTL)
2. Reservierte Items laden (nur nicht-abgelaufene)
3. Versandkosten berechnen via ShippingTier
4. Fulfillments zuweisen (Greedy Set-Cover-Algorithmus)
5. Coins atomar abziehen (`$inc` mit `$gte`-Guard)
6. Order erstellen (status: `paid`)
7. CartItems → `checked_out`, PackPulls → `claimed`
8. Shop-Inventar dekrementieren
9. CoinTransaction erstellen
10. Shops benachrichtigen
- Response: `{ "success": true, "orderId": "...", "orderNumber": "PA-20260328-1234", "newBalance": 1100 }`

**Stripe-Zahlung:**
1. Schritte 1-4 wie bei Coins
2. Order erstellen (status: `pending_payment`)
3. CartItem-Ablauf auf mind. 30 Min verlängern
4. Stripe Checkout Session erstellen (30 Min Timeout)
5. User wird zu Stripe weitergeleitet
- Response: `{ "success": true, "checkoutUrl": "https://checkout.stripe.com/...", "orderId": "...", "orderNumber": "..." }`

**Stripe Webhook (`POST /api/stripe/webhook`):**
- `checkout.session.completed` mit `metadata.type === "shipping"`:
  - Order → `paid`, CartItems → `checked_out`, PackPulls → `claimed`
  - Shop-Inventar dekrementieren, Shops + User benachrichtigen
- `checkout.session.expired` mit `metadata.type === "shipping"`:
  - Order → `cancelled` (CartItems bleiben `reserved` und laufen normal ab)

### Bestellungen (User)

**`GET /api/orders`** — Bestellhistorie (paginiert)

**`GET /api/orders/[id]`** — Bestelldetail (inkl. Karten, Adresse, Fulfillments, Tracking)

### Shop-Fulfillment

**`GET /api/shop/fulfillments`** — Zugewiesene Aufträge (für Shop-Betreiber)
- Query: `?status=pending&page=1&limit=20`
- Zeigt nur Fulfillments die diesem Shop zugewiesen sind

**`PATCH /api/shop/fulfillments/[orderId]`** — Status aktualisieren
- Body: `{ "status": "processing"|"shipped"|"delivered", "trackingNumber": "DHL123" }`
- Bei `shipped`: User wird benachrichtigt
- Bei allen Fulfillments `shipped` → Order-Status = `shipped`
- Bei allen Fulfillments `delivered` → Order-Status = `delivered`

### Admin

**`GET /api/admin/shipping-tiers`** — Alle Versandkosten-Staffeln laden

**`POST /api/admin/shipping-tiers`** — Neue Staffel erstellen
- Body: `{ "country": "DE", "minCards": 1, "maxCards": 5, "costCents": 299, "costCoins": 150, "isActive": true }`
- Prüft auf Überlappung mit bestehenden Staffeln

**`GET /api/admin/orders`** — Alle Bestellungen (mit Status-/User-Filter)

**`GET /api/admin/orders/[id]`** — Bestelldetail (inkl. Shop-Zuweisungen)

**`PATCH /api/admin/orders/[id]`** — Bestellstatus überschreiben

---

## Hintergrund-Jobs (BullMQ)

Der Reservation-Worker läuft als BullMQ-Worker auf dem bestehenden Redis und wird beim Server-Start in `instrumentation.ts` gebootstrapped.

### Job: `check-expired` (alle 60 Sekunden)

Findet alle CartItems mit `status: "reserved"` und `expiresAt < now`:

1. CartItem → `expired`
2. PackPull → `converted`
3. Coins gutschreiben (`$inc`)
4. Kartenbestand in Box zurückgeben (`$inc cards.$.stock`)
5. CoinTransaction erstellen (Typ: `reservation_expired`)
6. Batch-Benachrichtigung pro User: "X Coins gutgeschrieben"
7. Redis Pub/Sub für SSE-Notification-Update

### Job: `send-warnings` (alle 60 Sekunden)

Findet alle CartItems mit `status: "reserved"`, `expiresAt` innerhalb der nächsten Stunde, `warningNotified: false`:

1. `warningNotified` → `true`
2. Benachrichtigung pro User: "X Karten laufen bald ab"
3. Redis Pub/Sub für SSE-Notification-Update

### Konfiguration

```
Queue-Name: "reservation-jobs"
Jobs: check-expired, send-warnings
Intervall: 60.000ms (1 Minute)
removeOnComplete: 100 (letzte 100 behalten)
removeOnFail: 50 (letzte 50 behalten)
```

---

## Fulfillment-Zuweisung (Greedy Set-Cover)

Der Algorithmus in `lib/fulfillment-assignment.ts` minimiert die Anzahl der Pakete:

1. Für jede unique Card-ID: Shops mit Bestand finden (via `InventoryItem`)
2. **Greedy-Loop:** Shop wählen der die meisten noch-unzugewiesenen Karten abdeckt
3. Wiederholen bis alle Karten zugewiesen
4. Karten ohne Shop-Bestand → Plattform-Fulfillment (`shopId: null`)

**Beispiel:**
- Karten: A, B, C, D
- Shop 1 hat: A, B, C → deckt 3 ab → wird zuerst gewählt
- Shop 2 hat: D → deckt 1 ab → wird als zweites gewählt
- Ergebnis: 2 Pakete statt 4

**Nach Checkout:** `decrementShopStock()` dekrementiert den `InventoryItem.stock` atomar (`$inc: -1` mit `$gte: 1`-Guard).

---

## Frontend-Seiten

### `/cart` — Warenkorb

- Kartenliste mit globalem Live-Countdown-Timer im Banner (ein Timer für den gesamten Warenkorb)
- "In Coins"-Button pro Karte (manuelle Umwandlung)
- Checkout-Sidebar:
  - Versandadresse (vorausgefüllt aus letzter Bestellung)
  - Land-Auswahl (DE/AT/CH)
  - Versandkosten-Anzeige (live aktualisiert)
  - Zahlungsmethode: Coins oder Stripe
  - Bestell-Button
- Hinweis-Banner: "Reservierte Karten werden nach Ablauf automatisch in Coins umgewandelt"
- Leerer Zustand: Link zu Packs

### `/orders` — Bestellhistorie

- Paginierte Bestellliste
- Pro Bestellung: Bestellnummer, Status-Badge, Kartenanzahl, Zahlungsart, Datum
- Klick → Bestelldetail

### `/orders/[id]` — Bestelldetail

- Bestellnummer + Status
- Versandadresse
- Fulfillment-Status pro Paket (mit Tracking wenn vorhanden)
- Kartengrid mit Bildern
- Zahlungsinfo

### `/shop/fulfillments` — Shop-Auftragsverwaltung

- Status-Filter-Tabs: Alle, Offen, In Bearbeitung, Versendet, Zugestellt
- Pro Auftrag: Bestellnummer, User, Adresse, Kartenanzahl
- Aktionsbuttons je nach Status:
  - Offen → "Verarbeiten"
  - In Bearbeitung → Tracking eingeben + "Versendet"
  - Versendet → "Zugestellt"
- Paginierung

### `/admin/shipping` — Versandkosten-Verwaltung

- Tabelle aller Staffeln (nach Land sortiert)
- Formular zum Erstellen neuer Staffeln
- Felder: Land, Min-Karten, Max-Karten, Preis (Cent), Preis (Coins)

### `/admin/orders` — Bestellverwaltung

- Alle Bestellungen mit Status-Filter
- Tabelle: Bestellnummer, User, Status, Zahlung, Karten, Datum

### Pack-Opening (geändert)

- "Claim"-Button umbenannt zu "Warenkorb" / "Cart"
- Icon: ShoppingCart statt Check
- Nach Bestätigung: Toast "Pack-Opening abgeschlossen! Karten im Warenkorb."

---

## Navigation (geändert)

| Alt | Neu |
|-----|-----|
| "Sammlung" (`/claimed`) | "Warenkorb" (`/cart`) |
| — | "Bestellungen" (`/orders`) |

**Neue Shop-Navigation:** "Versandaufträge" (`/shop/fulfillments`)

**Neue Admin-Navigation:** "Bestellungen" (`/admin/orders`) + "Versandkosten" (`/admin/shipping`)

---

## Entfernte Komponenten

- `models/user-inventory.ts` — ersetzt durch `CartItem`
- `app/api/claimed/route.ts` — nicht mehr benötigt
- `app/[lang]/(dashboard)/(pages)/claimed/page.tsx` — ersetzt durch `/cart`
- `components/inventory/inventory-grid.tsx` — nicht mehr benötigt

---

## Sicherheitsmaßnahmen

| Maßnahme | Beschreibung |
|----------|-------------|
| **Distributed Lock** | Redis `SETNX` beim Checkout verhindert Doppel-Submits |
| **Atomare Coin-Abzüge** | `$inc` mit `$gte`-Guard verhindert negative Salden |
| **Unique Index pullId** | Verhindert doppeltes Claimen derselben Karte |
| **Stock Guard** | `$inc: -1` mit `stock >= 1`-Filter beim Shop-Inventar |
| **CartItem-Validierung** | Checkout prüft `status: "reserved"` UND `expiresAt > now` |
| **Stripe Session Timeout** | 30 Min + CartItem-Verlängerung verhindert Mid-Payment-Ablauf |
| **Idempotenz** | Webhook prüft `paymentStatus !== "paid"` vor Verarbeitung |

---

## Technologie-Stack

| Komponente | Technologie |
|-----------|------------|
| Datenbank | MongoDB (Mongoose 9.3) |
| Cache / Locks / Pub-Sub | Redis (ioredis 5.10) |
| Background Jobs | BullMQ 5.71 (auf bestehendem Redis) |
| Zahlungen | Stripe 21.0 (Checkout Sessions) |
| Validierung | Zod 4.3 |
| Region | DACH (DE, AT, CH) |
