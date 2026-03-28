# Versand & Bestellungen — Admin-Handbuch

## Überblick

Das Versandsystem besteht aus folgenden Komponenten:

```
Warenkorb (6h Timer) → Checkout (Coins/Stripe) → Bestellung → Fulfillment (Multi-Shop)
```

Admins verwalten **Versandkosten-Staffeln** und **Bestellungen**. Shop-Betreiber verwalten ihre **Versandaufträge**.

---

## Versandkosten-Staffeln (`/admin/shipping`)

### Konzept

Versandkosten werden anhand von **Staffeln** berechnet. Jede Staffel definiert:

| Feld | Beschreibung |
|------|-------------|
| Land | DE, AT oder CH |
| Min-Karten | Ab wie vielen Karten diese Staffel greift |
| Max-Karten | Bis wie viele Karten diese Staffel gilt |
| Preis (Cent) | Kosten für Stripe-Zahlung |
| Preis (Coins) | Kosten für Coin-Zahlung |
| Aktiv | Ob die Staffel aktiv ist |

### Beispiel-Konfiguration

| Land | Min | Max | Cent | Coins |
|------|-----|-----|------|-------|
| DE | 1 | 5 | 299 | 150 |
| DE | 6 | 15 | 499 | 250 |
| DE | 16 | 50 | 799 | 400 |
| AT | 1 | 5 | 499 | 250 |
| AT | 6 | 15 | 699 | 350 |
| CH | 1 | 5 | 599 | 300 |
| CH | 6 | 15 | 899 | 450 |

### Staffel erstellen

1. Gehe zu `/admin/shipping`
2. Klicke "Add Tier"
3. Wähle Land, Min/Max-Karten, Preis in Cent und Coins
4. Klicke "Create"

**Wichtig:** Staffeln dürfen sich nicht überlappen. Wenn für DE bereits 1-5 existiert, kann keine neue Staffel mit überlappender Range (z.B. 3-8) erstellt werden.

### Staffel bearbeiten / löschen

**API-Endpunkte** (noch keine UI — über API oder Tool wie Postman):

- `PUT /api/admin/shipping-tiers/{id}` — Staffel aktualisieren
- `DELETE /api/admin/shipping-tiers/{id}` — Staffel löschen

**PUT Body-Beispiel:**
```json
{
  "costCents": 399,
  "costCoins": 200,
  "isActive": false
}
```

Alle Felder sind optional (Partial Update). Beim Aktivieren wird geprüft, ob die Range mit einer bestehenden aktiven Staffel überlappt.

### Fehlende Staffel

Wenn für eine Land/Kartenanzahl-Kombination keine Staffel existiert, wird dem User "N/A" angezeigt und der Checkout-Button ist deaktiviert. **Stelle sicher, dass für alle relevanten Ranges Staffeln existiert.**

---

## Bestellverwaltung (`/admin/orders`)

### Bestellübersicht

- Filterbar nach Status
- Tabelle: Bestellnummer, User, Status, Zahlungsart, Kartenanzahl, Datum

### Bestellstatus

```
pending_payment → paid → processing → shipped → delivered
                                                  └→ cancelled
```

| Status | Bedeutung |
|--------|-----------|
| `pending_payment` | User wurde zu Stripe weitergeleitet, Zahlung ausstehend |
| `paid` | Bezahlt (automatisch bei Coins, per Webhook bei Stripe) |
| `processing` | Mind. ein Shop hat angefangen zu verpacken |
| `shipped` | Alle Pakete versendet |
| `delivered` | Alle Pakete zugestellt |
| `cancelled` | Storniert (Stripe-Timeout oder Admin-Override) |

### Status überschreiben

Admins können den Bestellstatus manuell ändern über:

- `PATCH /api/admin/orders/{id}` mit `{ "status": "delivered" }`

**Vorsicht:** Status-Override hat keine Nebeneffekte (z.B. keine Coin-Rückerstattung bei Stornierung). Dies ist nur für Korrekturen gedacht.

### Bestelldetail

`GET /api/admin/orders/{id}` liefert:

- Vollständige Bestelldaten inkl. User-Info
- Alle Karten mit Bildern
- Fulfillment-Zuweisungen mit Shop-Info
- Zahlungsstatus und Stripe-IDs

---

## Fulfillment-Zuweisung

### Wie die automatische Zuweisung funktioniert

Beim Checkout werden Karten automatisch Shops zugewiesen:

1. **Greedy Set-Cover-Algorithmus:** Der Shop, der die meisten Karten auf Lager hat, wird zuerst gewählt
2. Wiederholung bis alle Karten zugewiesen sind
3. Karten ohne Shop-Bestand → **Plattform-Fulfillment** (shopId: null = ihr verschickt selbst)

**Beispiel:**
```
Karten: A, B, C, D, E
Shop 1 hat: A(2), B(1), C(1) → deckt A, B, C ab → Paket 1
Shop 2 hat: D(1), E(1)       → deckt D, E ab    → Paket 2
Ergebnis: 2 Pakete statt 5
```

Der Algorithmus berücksichtigt auch **mehrfache Kopien** derselben Karte: Wenn ein User 3x Karte A hat, prüft er ob der Shop auch 3 auf Lager hat.

### Plattform-Fulfillment

Karten mit `shopId: null` in den Fulfillments haben keinen Shop-Bestand. Diese müssen vom Plattform-Team selbst verschickt werden. Sie tauchen **nicht** in Shop-Dashboards auf.

---

## Shop-Fulfillment-Workflow

Shops sehen ihre Aufträge unter `/shop/fulfillments`:

```
pending → processing → shipped → delivered
```

| Aktion | Trigger | Effekt |
|--------|---------|--------|
| "Process" | Shop startet Verpackung | Status → processing |
| "Shipped" + Tracking | Shop hat versendet | Status → shipped, User wird benachrichtigt |
| "Delivered" | Paket zugestellt | Status → delivered |

Wenn **alle** Fulfillments einer Bestellung `shipped` sind → Bestellstatus = `shipped`.
Wenn **alle** `delivered` → Bestellstatus = `delivered`.

---

## Hintergrund-Worker

Der BullMQ-Worker läuft automatisch beim Server-Start und führt zwei Jobs alle 60 Sekunden aus:

### Job: `check-expired`

Findet abgelaufene Reservierungen (`expiresAt < now`, `status: reserved`):

1. CartItem → `expired` (atomar, idempotent)
2. PackPull → `converted`
3. Coins gutschreiben
4. Kartenbestand in Box zurückgeben
5. CoinTransaction erstellen (Typ: `reservation_expired`)
6. User-Benachrichtigung senden

### Job: `send-warnings`

Findet Karten die in weniger als 1 Stunde ablaufen:

1. `warningNotified` → `true`
2. User-Benachrichtigung senden

### Monitoring

Worker-Logs erscheinen in der Server-Konsole:
```
[reservation-worker] Started with 60s interval
[reservation-worker] Processed 5 expired reservations
[reservation-worker] Sent 3 expiry warnings
```

---

## Stripe-Integration

### Checkout-Flow

1. User wählt "Stripe" als Zahlungsmethode
2. Stripe Checkout Session wird erstellt (30 Min Timeout)
3. CartItem-Ablauf wird auf mind. 30 Min verlängert
4. User wird zu Stripe weitergeleitet

### Webhook-Events

| Event | Handling |
|-------|---------|
| `checkout.session.completed` (type=shipping) | Prüft ob alle CartItems noch reserviert. Ja → Order paid. Nein → Automatischer Refund + Order cancelled |
| `checkout.session.expired` (type=shipping) | Order → cancelled. CartItems bleiben reserved und laufen normal ab |

### Sicherheit: Refund bei abgelaufenen Items

Wenn zwischen Stripe-Zahlung und Webhook-Verarbeitung Karten ablaufen (z.B. durch Race Condition), wird automatisch ein **Stripe-Refund** ausgelöst und die Bestellung storniert. Das verhindert, dass ein User für Karten bezahlt, die nicht mehr reserviert sind.

---

## Sicherheitsmaßnahmen

| Maßnahme | Beschreibung |
|----------|-------------|
| **Distributed Lock** | Redis `SETNX` beim Checkout verhindert Doppel-Submits (30s TTL) |
| **Atomare Coin-Abzüge** | `$inc` mit `$gte`-Guard verhindert negative Salden |
| **Unique Index pullId** | Verhindert doppeltes Claimen derselben Karte |
| **Stock Guard** | `$inc: -1` mit `stock >= 1`-Filter beim Shop-Inventar |
| **Idempotenter Worker** | `findOneAndUpdate` verhindert doppelte Verarbeitung bei Crashes |
| **CartItem-Validierung** | Checkout prüft `status: reserved` UND `expiresAt > now` |
| **Webhook-Refund** | Automatischer Refund bei Item-Mismatch nach Stripe-Zahlung |
| **Zod-Validierung** | Alle API-Eingaben werden mit Zod-Schemas validiert |

---

## Übersetzungen

Alle UI-Texte des Versandsystems nutzen das dynamische Übersetzungssystem. Die relevanten Namespaces:

| Namespace | Seiten |
|-----------|--------|
| `cart` | Warenkorb-Seite |
| `orders` | Bestellübersicht + Detail |
| `fulfillments` | Shop-Versandaufträge |
| `admin` | Admin-Seiten (Prefix `shipping_` und `orders_`) |

Übersetzungen verwalten: `/admin/translations`

### Wichtige Translation-Keys

**Namespace `cart`:**
`pageTitle`, `pageSubtitle`, `emptyCart`, `openPacks`, `timerWarning`, `toCoins`, `shippingAddress`, `placeholderName`, `placeholderStreet`, `placeholderZip`, `placeholderCity`, `germany`, `austria`, `switzerland`, `paymentMethod`, `cards`, `shipping`, `notAvailable`, `placeOrder`, `orderPlaced`, `orderNumber`, `addressIncomplete`, `fillAllFields`, `checkoutFailed`, `converted`, `coinsCredited`, `convertFailed`, `consentTitle`, `consentRule1`, `consentRule2`, `consentRule3`, `consentAccept`

**Namespace `orders`:**
`pageTitle`, `pageSubtitle`, `noOrders`, `cards`, `previous`, `next`, `orderNotFound`, `shippingAddress`, `shippingStatus`, `shippedOn`, `payment`, `shipping`

**Namespace `fulfillments`:**
`pageTitle`, `pageSubtitle`, `noOrders`, `cards`, `previous`, `next`, `statusUpdated`, `filterAll`, `status_pending`, `status_processing`, `status_shipped`, `status_delivered`, `actionProcess`, `actionShipped`, `actionDelivered`

**Namespace `admin` (Prefix `shipping_`):**
`shipping_pageTitle`, `shipping_pageSubtitle`, `shipping_country`, `shipping_costCents`, `shipping_active`, `shipping_noTiers`, `shipping_addTier`, `shipping_newTier`, `shipping_create`, `shipping_cancel`, `shipping_tierCreated`

**Namespace `admin` (Prefix `orders_`):**
`orders_pageTitle`, `orders_pageSubtitle`, `orders_filterAll`, `orders_noOrders`, `orders_user`, `orders_payment`, `orders_cards`, `orders_date`, `orders_previous`, `orders_next`

---

## API-Referenz (Kurzübersicht)

### Öffentliche Endpunkte (Auth erforderlich)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| GET | `/api/cart` | Warenkorb laden |
| DELETE | `/api/cart/{itemId}` | Karte in Coins umwandeln |
| POST | `/api/cart/shipping-estimate` | Versandkosten berechnen |
| POST | `/api/cart/checkout` | Checkout (Coins/Stripe) |
| GET | `/api/orders` | Bestellhistorie |
| GET | `/api/orders/{id}` | Bestelldetail |

### Shop-Endpunkte (Shop-Rolle erforderlich)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| GET | `/api/shop/fulfillments` | Zugewiesene Aufträge |
| PATCH | `/api/shop/fulfillments/{orderId}` | Status aktualisieren |

### Admin-Endpunkte (Admin-Rolle erforderlich)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| GET | `/api/admin/shipping-tiers` | Alle Staffeln |
| POST | `/api/admin/shipping-tiers` | Neue Staffel |
| PUT | `/api/admin/shipping-tiers/{id}` | Staffel bearbeiten |
| DELETE | `/api/admin/shipping-tiers/{id}` | Staffel löschen |
| GET | `/api/admin/orders` | Alle Bestellungen |
| GET | `/api/admin/orders/{id}` | Bestelldetail |
| PATCH | `/api/admin/orders/{id}` | Status überschreiben |
