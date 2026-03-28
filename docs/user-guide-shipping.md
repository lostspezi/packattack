# Versand & Warenkorb — Benutzer-Anleitung

## So funktioniert's

Wenn du ein Pack öffnest und eine Karte ziehst, hast du zwei Optionen:

- **Warenkorb** — Die Karte wird reserviert und landet in deinem Warenkorb
- **In Coins** — Die Karte wird sofort in Coins umgewandelt

---

## Der 6-Stunden-Timer

Dein Warenkorb hat ein **6-Stunden-Zeitfenster**:

- Die erste geclaimte Karte startet den Timer
- Alle weiteren geclaimten Karten teilen sich denselben Timer
- Der Timer wird oben im Warenkorb als Countdown angezeigt
- **1 Stunde vor Ablauf** bekommst du eine Benachrichtigung

### Was passiert nach Ablauf?

Alle Karten im Warenkorb werden **automatisch in Coins umgewandelt**. Du bekommst den jeweiligen Coin-Wert jeder Karte gutgeschrieben und eine Benachrichtigung darüber.

---

## Warenkorb (`/cart`)

Im Warenkorb siehst du:

- Alle reservierten Karten mit Bild, Name, Seltenheit und Coin-Wert
- Den globalen Countdown-Timer
- Pro Karte einen **"In Coins"**-Button für manuelle Umwandlung

### Karte manuell umwandeln

Wenn du eine einzelne Karte doch nicht physisch haben möchtest, klicke auf **"In Coins"**. Die Karte wird sofort in Coins umgewandelt und aus dem Warenkorb entfernt.

---

## Checkout

### 1. Versandadresse

Gib deine Versandadresse ein:

- Name
- Straße + Hausnummer
- PLZ
- Stadt
- Land (Deutschland, Österreich oder Schweiz)

Deine Adresse wird gespeichert und beim nächsten Mal automatisch vorausgefüllt.

### 2. Versandkosten

Die Versandkosten werden automatisch berechnet basierend auf:

- Anzahl der Karten im Warenkorb
- Zielland (DE / AT / CH)

Die Kosten werden dir live angezeigt, sobald du ein Land ausgewählt hast.

### 3. Zahlungsmethode

Du kannst die Versandkosten bezahlen mit:

| Methode | Beschreibung |
|---------|-------------|
| **Coins** | Sofortige Abbuchung von deinem Coin-Guthaben |
| **Stripe** | Zahlung per Kreditkarte/Debitkarte über Stripe |

Bei **Coins-Zahlung** wird die Bestellung sofort bestätigt.

Bei **Stripe-Zahlung** wirst du zur Stripe-Checkout-Seite weitergeleitet. Du hast 30 Minuten Zeit, die Zahlung abzuschließen. Deine Karten bleiben währenddessen reserviert.

### 4. Reservierungsregeln

Beim ersten Checkout wirst du einmalig gebeten, die Reservierungsregeln zu bestätigen:

- Der Warenkorb hat ein 6-Stunden-Zeitfenster
- Nicht abgeschlossene Karten werden automatisch in Coins umgewandelt
- Einzelne Karten können jederzeit manuell in Coins umgewandelt werden

---

## Bestellungen (`/orders`)

Nach dem Checkout findest du deine Bestellungen unter **Bestellungen**:

### Bestellübersicht

- Bestellnummer (z.B. `PA-20260328-001234`)
- Status-Badge
- Anzahl der Karten
- Zahlungsart
- Datum

### Bestelldetail

Klicke auf eine Bestellung für Details:

- Versandadresse
- Versandstatus pro Paket (inkl. Tracking-Nummer wenn vorhanden)
- Alle bestellten Karten mit Bild
- Zahlungsinformationen

### Bestellstatus

| Status | Bedeutung |
|--------|-----------|
| `pending_payment` | Warte auf Stripe-Zahlung |
| `paid` | Bezahlt, wird bearbeitet |
| `processing` | Wird verpackt |
| `shipped` | Versendet (Tracking verfügbar) |
| `delivered` | Zugestellt |
| `cancelled` | Storniert (z.B. Stripe-Timeout) |

---

## Häufige Fragen

**Kann ich den Timer verlängern?**
Nein. Der 6-Stunden-Timer ist fest. Plane deinen Checkout entsprechend.

**Was passiert bei einer Stripe-Zahlung, wenn meine Karten ablaufen?**
Deine Karten werden für mindestens 30 Minuten verlängert, wenn du den Stripe-Checkout startest. Falls die Zahlung trotzdem fehlschlägt oder du abbrichst, bleiben die Karten bis zum ursprünglichen Timer reserviert.

**Kann ich Karten aus verschiedenen Packs bestellen?**
Ja. Alle geclaimten Karten landen im selben Warenkorb, unabhängig aus welcher Box sie kommen.

**Warum sind meine Versandkosten unterschiedlich?**
Die Kosten hängen von der Anzahl der Karten und dem Zielland ab. Die Staffeln werden vom Admin konfiguriert.

**Meine Bestellung hat mehrere Pakete — warum?**
Karten können von verschiedenen Shops versendet werden. Jeder Shop verschickt sein eigenes Paket mit separatem Tracking.
