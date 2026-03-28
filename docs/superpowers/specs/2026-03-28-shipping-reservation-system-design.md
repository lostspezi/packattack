# Shipping & Reservation System Design

## Context

PackAttack.gg ist eine TCG Pack-Opening-Plattform. User kaufen Coins, öffnen Booster, und entscheiden pro Karte: behalten (claimen) oder in Coins umwandeln. Bisher landen geclaimte Karten in einem permanenten Inventar (UserInventory) ohne physischen Versand.

**Problem:** Geclaimte Karten existieren nur digital auf der Plattform. Es gibt keinen Weg, sie physisch zu erhalten. Gleichzeitig sind TCG-Kartenpreise volatil — unbegrenzte Reservierungen sind für die Plattform nicht tragbar.

**Lösung:** Ein Warenkorb- und Versandsystem mit 6-Stunden-Reservierung. Geclaimte Karten landen im Warenkorb, der User hat 6h für den Checkout (Adresse + Versandkosten). Nach Ablauf: automatische Umwandlung in Coins.

**Rechtliches Framing:** Das Öffnen von Boostern ist eine digitale Experience. Physische Karten müssen aktiv innerhalb der Frist beansprucht und der Versand abgeschlossen werden. Ownership entsteht erst nach abgeschlossenem Checkout.

---

## Datenmodell

### CartItem (ersetzt UserInventory)

Das bestehende `UserInventory`-Model wird zu `CartItem` umbenannt. Es gibt kein permanentes Karteninventar mehr — jede geclaimte Karte durchläuft den Checkout.

```
CartItem {
  userId           → User (required)
  cardId           → Card (required)
  boxId            → Box (required)
  pullId           → PackPull (required, unique)
  rarity           string (required)
  conversionValue  number (required)  // Snapshot vom Ziehzeitpunkt, für Auto-Convert
  status           enum: "reserved" | "checked_out" | "expired"
  expiresAt        Date (required)    // createdAt + 6 Stunden
  warningNotified  boolean (default: false)  // 1h-Warnung gesendet?
  orderId          → Order | null
  createdAt        Date
}

Indexes:
  { userId: 1, status: 1 }              — Cart-Abfrage pro User
  { expiresAt: 1, status: 1 }           — BullMQ Expiry-Worker
  { pullId: 1 } (unique)                — Verhindert Duplikate
```

### Order (neu)

Gruppiert Karten einer Bestellung mit Versandinfos und Fulfillment-Zuweisungen.

```
Order {
  userId              → User (required)
  orderNumber         string (unique)     // Format: "PA-YYYYMMDD-XXXX", generiert via Counter-Collection oder Date.now() + 4-stellige Zufallszahl
  items               [{
    cartItemId        → CartItem
    cardId            → Card
    rarity            string
  }]
  shippingAddress     {
    name              string (required)
    street            string (required)
    city              string (required)
    zip               string (required)
    country           enum: "DE" | "AT" | "CH" (required)
  }
  paymentMethod       enum: "coins" | "stripe"
  paymentStatus       enum: "pending" | "paid" | "failed" | "refunded"
  shippingCostCents   number
  shippingCostCoins   number | null
  stripeSessionId     string | null
  stripePaymentIntentId string | null
  fulfillments        [Fulfillment]  // embedded subdocuments
  status              enum: "pending_payment" | "paid" | "processing" | "shipped" | "delivered" | "cancelled"
  createdAt           Date
  updatedAt           Date
}

Fulfillment (embedded subdoc) {
  shopId              → User | null       // null = Plattform erfüllt
  items               [{ cardId, rarity }]
  status              enum: "pending" | "processing" | "shipped" | "delivered"
  trackingNumber      string | null
  shippedAt           Date | null
}

Indexes:
  { userId: 1, createdAt: -1 }                          — Bestellhistorie
  { orderNumber: 1 } (unique)                            — Lookup
  { "fulfillments.shopId": 1, "fulfillments.status": 1 } — Shop-Dashboard
  { status: 1 }                                          — Admin-Filter
```

### ShippingTier (neu, Admin-konfigurierbar)

Gestaffelte Versandkosten nach Kartenanzahl und Land.

```
ShippingTier {
  country       enum: "DE" | "AT" | "CH"
  minCards      number (required)
  maxCards      number (required)
  costCents     number (required)     // Preis in Euro-Cent
  costCoins     number (required)     // Preis in Coins
  isActive      boolean (default: true)
}

Index:
  { country: 1, minCards: 1 }
```

### Änderungen an bestehenden Models

**PackPull** (`models/pack-pull.ts`):
- Status-Enum erweitern: `"reserved" | "claimed" | "converted"`
  - `reserved` = Karte im Warenkorb, Checkout noch offen
  - `claimed` = Checkout abgeschlossen, Bestellung erstellt
  - `converted` = In Coins umgewandelt (manuell oder Auto-Convert)

**User** (`models/user.ts`):
- Neues Feld `shippingAddress`:
  ```
  shippingAddress: {
    name:    string | null
    street:  string | null
    city:    string | null
    zip:     string | null
    country: "DE" | "AT" | "CH" | null
  }
  ```
- Neues Feld `reservationRulesAccepted: Date | null` (Consent für 6h-Reservierungsregel)

**CoinTransaction** (`models/coin-transaction.ts`):
- Neue Typen: `"shipping_payment"`, `"reservation_expired"`
- Neues Feld: `relatedOrderId: ObjectId | null`

---

## API-Design

### Geänderter Claim-Flow

**`POST /api/pulls/decide`** (modifiziert)

Bei `decision = "claim"`:
1. PackPull erstellen mit `status: "reserved"`
2. CartItem erstellen mit `expiresAt: now + 6h`, `status: "reserved"`, `conversionValue` vom Pull
3. KEIN UserInventory mehr erstellen
4. Response: `{ decision: "reserved", expiresAt, newBalance }`

Bei `decision = "convert"`:
- Unverändert (Coins gutschreiben, Stock zurück in Box, CoinTransaction)

### Cart APIs

**`GET /api/cart`**
- Alle CartItems mit `status: "reserved"` für den authentifizierten User
- Populated mit Card-Info (name, image, rarity)
- Berechnet `remainingSeconds` pro Item
- Response: `{ items: [...], totalItems: number }`

**`DELETE /api/cart/[itemId]`**
- Manuelle Umwandlung einer einzelnen Karte in Coins vor Ablauf
- Gleiche Logik wie Convert: Coins gutschreiben, Box-Stock zurück, PackPull → "converted", CartItem → "expired"
- Response: `{ newBalance, convertedCoins }`

**`POST /api/cart/shipping-estimate`**
- Input: `{ country: "DE" | "AT" | "CH" }`
- Zählt reservierte CartItems des Users
- Findet passenden ShippingTier
- Response: `{ cardCount, costCents, costCoins, tierLabel }`

### Checkout API

**`POST /api/cart/checkout`**
- Input:
  ```
  {
    paymentMethod: "coins" | "stripe",
    address: { name, street, city, zip, country },
    lang: "de" | "en"
  }
  ```
- Validierung:
  - Adresse: DACH-Länder, PLZ-Format validieren
  - CartItems: Alle mit `status: "reserved"` und `expiresAt > now`
  - Mindestens 1 CartItem vorhanden
- Versandkosten berechnen via ShippingTier
- Shop-Zuweisung via Fulfillment-Algorithmus (siehe unten)
- Distributed Lock: `SETNX checkout:${userId}` (30s TTL) gegen Doppel-Submits

**Coins-Zahlung:**
1. `User.findOneAndUpdate({ _id: userId, coins: { $gte: shippingCostCoins } }, { $inc: { coins: -shippingCostCoins } })`
2. Order erstellen mit `paymentStatus: "paid"`, `status: "paid"`
3. Alle CartItems → `status: "checked_out"`, `orderId` setzen
4. Alle zugehörigen PackPulls → `status: "claimed"`
5. CoinTransaction erstellen (type: `"shipping_payment"`)
6. User `shippingAddress` aktualisieren
7. Notifications an zugewiesene Shops senden
8. Response: `{ orderId, orderNumber }`

**Stripe-Zahlung:**
1. Stripe Checkout Session erstellen mit `metadata: { type: "shipping", orderId }`
2. Order erstellen mit `paymentStatus: "pending"`, `status: "pending_payment"`
3. CartItems bleiben `status: "reserved"` bis Webhook bestätigt
4. Response: `{ checkoutUrl }`
5. Webhook `checkout.session.completed` (metadata.type === "shipping"): führt Schritte 3-7 der Coins-Zahlung aus

### Shop-Fulfillment APIs

**`GET /api/shop/fulfillments`**
- Alle Orders mit Fulfillment für diesen Shop
- Filter: `status` (pending, processing, shipped, delivered)
- Populated mit Card-Info und Shipping-Adresse

**`PATCH /api/shop/fulfillments/[orderId]`**
- Input: `{ status: "processing" | "shipped" | "delivered", trackingNumber?: string }`
- Nur das Fulfillment-Subdoc das dem Shop gehört
- Bei Status "shipped": Notification an User senden
- Validierung: Shop darf nur eigenes Fulfillment updaten

### Admin APIs

**`GET/POST/PUT/DELETE /api/admin/shipping-tiers`**
- CRUD für Versandkosten-Staffeln
- Validierung: keine überlappenden minCards/maxCards pro Land

**`GET /api/admin/orders`**
- Alle Bestellungen mit Filtern (status, dateRange, userId, shopId)
- Pagination

**`GET/PATCH /api/admin/orders/[id]`**
- Bestelldetail
- PATCH: Status überschreiben, Fulfillment-Zuweisung manuell ändern

---

## Shop-Zuweisungs-Algorithmus

Ziel: Minimiere die Anzahl der Pakete (= Shops), die eine Bestellung erfüllen.

```
function assignFulfillments(cartItems: CartItem[]): Fulfillment[] {
  1. Für jede unique cardId:
     InventoryItem.find({ card: cardId, stock: { $gte: 1 } })
     → Map<cardId, Set<shopId>>

  2. Greedy Set-Cover:
     while (uncoveredCards.size > 0) {
       bestShop = shop der die meisten uncoveredCards abdecken kann
       if (bestShop covers 0) break
       Fulfillment erstellen für bestShop mit seinen Karten
       uncoveredCards -= bestShop.cards
     }

  3. Verbleibende Karten → Fulfillment mit shopId: null (Plattform)

  4. Für jedes Fulfillment: InventoryItem stock atomisch dekrementieren
}
```

**Wichtig:** User zahlt nur 1x Versand. Bei Multi-Shop-Split trägt die Plattform die Zusatzkosten.

---

## BullMQ Background Jobs

### Setup

- Package: `bullmq` (neue Dependency)
- Worker-Start in `instrumentation.ts` (runs once on server boot, `NEXT_RUNTIME === "nodejs"`)
- Nutzt bestehende Redis-Instanz aus `lib/redis.ts`

### Job 1: `check-expired-reservations` (Repeatable, alle 60s)

```
1. CartItem.find({ status: "reserved", expiresAt: { $lt: now } })
2. Für jedes expired Item:
   a. CartItem.status → "expired"
   b. PackPull.status → "converted"
   c. User coins += conversionValue (atomic $inc)
   d. Box card stock += 1 (atomic $inc, gibt Karte zurück in den Pool)
   e. CoinTransaction erstellen (type: "reservation_expired")
3. Batch-Notification an betroffene User: "Deine Karten wurden in X Coins umgewandelt"
```

### Job 2: `send-expiry-warnings` (Repeatable, alle 60s)

```
1. CartItem.find({
     status: "reserved",
     expiresAt: { $lt: now + 1h, $gt: now },
     warningNotified: false
   })
2. Für jeden User mit ablaufenden Items:
   a. In-App Notification senden (bestehendes System)
   b. Optional: E-Mail über Resend
   c. CartItem.warningNotified = true
```

### Worker-Infrastruktur

File: `lib/queue.ts`
```
- getQueue(name): erstellt BullMQ Queue mit Redis connection
- Konstanten: RESERVATION_EXPIRY_QUEUE, RESERVATION_WARNING_QUEUE
```

File: `workers/reservation-worker.ts`
```
- BullMQ Worker für beide Jobs
- Retry-Logic bei Fehlern
- Logging
```

Bootstrap in `instrumentation.ts`:
```
- Queue.add('check-expired', {}, { repeat: { every: 60000 } })
- Queue.add('send-warnings', {}, { repeat: { every: 60000 } })
```

---

## Frontend-Seiten

### Neue Seiten

| Route | Beschreibung |
|-------|-------------|
| `/[lang]/(dashboard)/(pages)/cart` | Warenkorb: reservierte Karten mit Countdown, Checkout-Button |
| `/[lang]/(dashboard)/(pages)/orders` | Bestellhistorie des Users |
| `/[lang]/(dashboard)/(pages)/orders/[id]` | Bestelldetail mit Fulfillment-Status/Tracking |
| `/[lang]/(dashboard)/shop/fulfillments` | Shop: zugewiesene Aufträge verwalten |
| `/[lang]/(dashboard)/admin/shipping` | Admin: Versandkosten-Staffeln konfigurieren |
| `/[lang]/(dashboard)/admin/orders` | Admin: alle Bestellungen verwalten |

### Entfernte Seiten

| Route | Aktion |
|-------|--------|
| `/[lang]/(dashboard)/(pages)/claimed` | Entfernen (kein permanentes Inventar mehr) |
| `/api/claimed` | Entfernen |

### Geänderte Seiten

- **Pack Opening** (`/packs/[id]`): Decision-Phase zeigt "In den Warenkorb" statt "Claimen". Nach dem Claimen: Hinweis "6h reserviert" + Link zum Warenkorb.
- **Navigation**: "Meine Karten" Link → "Warenkorb" Link mit Badge (Anzahl reservierter Items)

### Cart-Seite UX

1. **Karten-Grid**: Alle reservierten Karten mit Bild, Name, Rarity, Coin-Wert
2. **Countdown pro Karte**: "Noch 4:32:15" (oder globaler Timer für früheste Ablaufzeit)
3. **Einzeln entfernen**: "In Coins umwandeln" Button pro Karte
4. **Transparenter Hinweis**: "Deine Karten sind für 6 Stunden reserviert. Bitte schließe den Versand innerhalb dieses Zeitraums ab. Da sich Marktpreise kurzfristig verändern können, ist eine längere Reservierung für uns nicht planbar."
5. **Checkout-Section**: Adresseingabe (pre-filled wenn vorhanden), Versandkosten-Anzeige, Zahlungsart-Wahl, Bestätigen-Button
6. **Erstmaliger Claim-Hinweis**: "Verstanden"-Button beim ersten Mal, der die 6h-Regel bestätigt. Consent wird als `reservationRulesAccepted: Date | null` auf dem User-Model gespeichert. Wird einmalig beim ersten Claim-Versuch angezeigt, danach nie wieder.

---

## Sicherheit & Edge Cases

### Race Conditions
- **Doppelter Checkout**: Redis distributed lock `SETNX checkout:${userId}` mit 30s TTL
- **Coin-Deduktion**: Atomic `findOneAndUpdate` mit Balance-Guard
- **CartItem-Status**: `findOneAndUpdate({ status: "reserved" })` verhindert doppelte Verarbeitung

### Expiry während Stripe-Checkout
- Checkout validiert `expiresAt > now` für alle CartItems
- Bei Stripe-Zahlung: `expiresAt` aller CartItems im Checkout wird auf `max(expiresAt, now + 30min)` verlängert, damit die Stripe-Session nicht mitten im Payment abläuft
- Stripe Session `expires_after` auf 30 Minuten setzen (statt 24h Default)
- Webhook prüft ob CartItems noch `status: "reserved"` sind
- Falls expired (z.B. User hat Stripe-Tab einfach offen gelassen und Session expired): Order canceln, keine Refund nötig da nicht bezahlt

### Leerer Warenkorb
- Checkout verweigert bei 0 reservierten Items
- Cart-Seite zeigt leeren Zustand mit Link zu den Packs

### Shop ohne Stock
- Fulfillment-Algorithmus fällt auf Plattform zurück (shopId: null)
- Admin wird notifiziert wenn Plattform-Fulfillment nötig ist

---

## Migration

1. Bestehende `UserInventory`-Dokumente löschen — bisherige Claims hatten keine physische Bedeutung, es wurden noch nie Karten versendet.
2. `user_inventories` Collection droppen, neue `cart_items` Collection wird durch Mongoose automatisch erstellt.
3. PackPull-Dokumente mit `status: "claimed"` behalten ihren Status (historische Daten = abgeschlossen).
4. Bestehende User erhalten `shippingAddress: null` (kein Migrationsskript nötig, Mongoose Default).

---

## Verification

### Manueller Test-Flow
1. Pack öffnen → Karte claimen → erscheint im Warenkorb mit 6h Timer
2. Warenkorb öffnen → Versandkosten sehen → Adresse eingeben → mit Coins bezahlen → Order erstellt
3. Karte claimen → 6h warten (oder Timer simulieren) → Auto-Convert prüfen: Coins gutgeschrieben, Karte weg
4. Karte claimen → mit Stripe bezahlen → Webhook triggern → Order status "paid"
5. Shop-Dashboard: Auftrag sehen → als "shipped" markieren → User bekommt Notification
6. Admin: Versandkosten-Staffel ändern → neue Bestellung hat korrekten Preis
7. Multi-Shop: Box mit Karten von 2 Shops öffnen → Fulfillment korrekt aufgeteilt

### Automatisierte Tests
- Unit: Shop-Zuweisungs-Algorithmus (Greedy Set-Cover)
- Unit: Versandkosten-Berechnung
- Integration: Checkout-Flow (Coins + Stripe)
- Integration: Expiry-Worker (CartItems → expired → Coins)
- Integration: Race Condition Tests (doppelter Checkout)

---

## Kritische Dateien

### Zu modifizieren
- `models/pack-pull.ts` — Status-Enum erweitern
- `models/user.ts` — shippingAddress hinzufügen
- `models/coin-transaction.ts` — Neue Typen + relatedOrderId
- `app/api/pulls/decide/route.ts` — CartItem statt UserInventory erstellen
- `app/api/stripe/webhook/route.ts` — Shipping-Payment Webhook
- `instrumentation.ts` — BullMQ Workers starten
- `components/packs/pack-opening.tsx` — "Claimen" → "In Warenkorb" UX

### Neu zu erstellen
- `models/cart-item.ts` — CartItem Schema
- `models/order.ts` — Order + Fulfillment Schema
- `models/shipping-tier.ts` — Versandkosten-Staffeln
- `lib/queue.ts` — BullMQ Queue Setup
- `lib/shipping.ts` — Versandkosten-Berechnung
- `lib/fulfillment-assignment.ts` — Shop-Zuweisungs-Algorithmus
- `workers/reservation-worker.ts` — Expiry + Warning Jobs
- `app/api/cart/route.ts` — Cart GET
- `app/api/cart/[itemId]/route.ts` — Cart DELETE (manueller Convert)
- `app/api/cart/shipping-estimate/route.ts` — Kostenvoranschlag
- `app/api/cart/checkout/route.ts` — Checkout
- `app/api/shop/fulfillments/route.ts` — Shop-Aufträge
- `app/api/shop/fulfillments/[orderId]/route.ts` — Fulfillment-Update
- `app/api/admin/shipping-tiers/route.ts` — Staffel-CRUD
- `app/api/admin/orders/route.ts` — Bestellungen
- `app/api/admin/orders/[id]/route.ts` — Bestelldetail
- Cart, Orders, Shop-Fulfillment, Admin-Shipping, Admin-Orders Frontend-Seiten

### Zu entfernen
- `models/user-inventory.ts` — Wird durch CartItem ersetzt
- `app/api/claimed/route.ts` — Kein permanentes Inventar mehr
- `app/[lang]/(dashboard)/(pages)/claimed/page.tsx` — Seite entfernen
