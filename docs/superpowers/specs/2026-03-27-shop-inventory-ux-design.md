# Shop-Inventar-Verwaltung — Redesign

**Datum:** 2026-03-27
**Status:** Approved
**Scope:** Projekt 1 von 4 (Inventar-Verwaltung → Claim & Versand → Auftragsverwaltung → Abrechnung)

## Problemstellung

Die aktuelle Shop-Inventar-Seite hat keine Möglichkeit, Karten hinzuzufügen. Es fehlt eine Kartensuche, Bilddarstellung, und der gesamte Workflow ist nicht nutzbar. Die Seite muss komplett überarbeitet werden — mit der gleichen Such- und Filterlogik wie bei der Admin-Box-Kartenverwaltung (JustTCG-API).

Gleichzeitig muss das Datenmodell für das spätere Fulfillment-System vorbereitet werden: Netto-Preise statt EK-Preise, Zustand pro Eintrag, Kleinunternehmer-Flag.

## Geschäftsmodell-Kontext (für spätere Projekte)

- Shops verkaufen nicht an die Plattform, sondern versenden direkt an User
- User claimed Karten nach Pack-Opening → Shop versendet
- Round-Robin-Verteilung unter Shops (mit Shop-Affinität pro User)
- 24h Sammelfenster, 6€ Versandpauschale via Stripe
- Shops geben Netto-Preise ein, Kleinunternehmer (0% MwSt) oder regulär (19%)
- Plattform trägt Multi-Shop-Versandkosten-Differenz

Dies wird in Projekt 2-4 implementiert. Projekt 1 bereitet nur das Datenmodell vor.

## Layout

### Desktop: Zwei-Spalten

- **Links (~40%)** — Kartensuche (fixiert, scrollt unabhängig)
- **Rechts (~60%)** — Inventar-Tabelle (scrollt unabhängig)

### Mobile: Tabs

- Tab "Suche" / Tab "Inventar" — da Zwei-Spalten auf Mobile nicht funktioniert
- Badge auf "Inventar"-Tab zeigt Anzahl der Artikel

## Linke Spalte: Kartensuche

Wiederverwendung der bestehenden JustTCG-API-Routen. Gleiche Suchlogik wie `JustTCGCardSearch`-Komponente in der Box-Verwaltung.

### Filter

1. **Game-Auswahl** (Dropdown) — lädt von `/api/justtcg/games`
2. **Kartenname** (Textfeld) — min. 2 Zeichen, Debounce 400ms
3. **Set-Filter** (Multi-Select mit Suche) — lädt von `/api/justtcg/sets?game=X`, durchsuchbar, Chips für ausgewählte Sets

### Ergebnisse: Listen-Ansicht

Pro Karte eine Zeile:
- **Thumbnail** (36×50px) — TCGPlayer CDN: `https://tcgplayer-cdn.tcgplayer.com/product/{tcgplayerId}_200w.jpg`
- **Name** (fett, truncated)
- **Set · Rarity** (secondary text)
- **NM-Preis** (Near Mint Variante, in USD)
- **"+" Button** — grün wenn verfügbar, ausgegraut mit Häkchen wenn bereits im Inventar (gleiche `card` + `condition: "Near Mint"`)

Max 20 Ergebnisse. Bei Multi-Set-Suche: parallele Requests, dedupliziert.

### Klick auf "+"

Erstellt sofort einen InventoryItem-Eintrag:
- `card`: Card-Record (wird erstellt falls nicht vorhanden, wie bei Box-Kartenverwaltung via `POST /api/admin/boxes/[id]/cards`)
- `condition`: `"Near Mint"` (Default)
- `stock`: `0` (muss vom Shop in der Tabelle gesetzt werden)
- `sku`: `tcgplayerSkuId` der Near Mint Variante (vorausgefüllt)
- `netPrice`: `null` (Shop muss Netto-Preis selbst eingeben)
- `ean`: `null`
- `notes`: `null`

Die neue Zeile erscheint in der rechten Tabelle, **automatisch im Edit-Modus geöffnet**.

## Rechte Spalte: Inventar-Tabelle

### Spalten

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| Bild | Thumbnail 28×40px | Kartenbild |
| Karte | Text | Name + Set (secondary) |
| Zustand | Dropdown | Mint, Near Mint, Lightly Played, Moderately Played, Heavily Played |
| Bestand | Number-Input | min 0 |
| Netto-Preis | Number-Input | € mit 2 Dezimalen |
| SKU | Text-Input | vorausgefüllt aus `tcgplayerSkuId`, editierbar |
| EAN | Text-Input | optional |
| Notiz | Text-Input | optional |
| Aktionen | Buttons | Bearbeiten / Speichern / Abbrechen / Löschen |

### Verhalten

- **Neue Einträge** öffnen sich automatisch im Edit-Modus (alle Felder editierbar)
- **Bestehende Einträge** zeigen Werte als Text, "Bearbeiten"-Button startet Edit-Modus
- **Zustand-Änderung** im Edit-Modus aktualisiert automatisch die SKU (wechselt zur passenden `tcgplayerSkuId` der gewählten Condition)
- **Löschen** mit Bestätigungs-Dialog. Blockiert wenn Karte als Substitut in einer Box verwendet wird (409 von API)
- **Duplikat-Schutz**: gleiche Karte + gleicher Zustand = 409 von API

## Datenmodell-Änderungen

### InventoryItem — Änderungen

| Feld | Änderung | Beschreibung |
|------|----------|--------------|
| `condition` | **Neu** (required) | `"Mint" \| "Near Mint" \| "Lightly Played" \| "Moderately Played" \| "Heavily Played"`, default `"Near Mint"` |
| `pricePerUnit` | **Umbenennung** → `netPrice` | Netto-Preis des Shops in EUR, `number \| null` |
| Unique-Index | **Änderung** | `shop + card + condition` statt `shop + card` (pro Zustand ein eigener Eintrag) |

### ShopProfile — Änderungen

| Feld | Änderung | Beschreibung |
|------|----------|--------------|
| `isSmallBusiness` | **Neu** | `boolean`, default `false` — Kleinunternehmerregelung (0% MwSt) |

Wird bei der Shop-Bewerbung als Checkbox abgefragt: "Ich unterliege der Kleinunternehmerregelung (§19 UStG)".

## API-Änderungen

### JustTCG-Routen: Role-Check erweitern

Betroffene Routen:
- `GET /api/justtcg/cards`
- `GET /api/justtcg/sets`
- `GET /api/justtcg/games`
- `GET /api/justtcg/rarities`

Aktuell: `role !== "admin" && role !== "super_admin"` → 403
Neu: `!["admin", "super_admin", "shop"].includes(role)` → 403

### POST /api/shop/inventory — Überarbeitung

Akzeptiert jetzt `justTcgId` + Karten-Metadaten statt `cardId`:

```typescript
// Request Body
{
  justTcgId: string;       // JustTCG Card ID
  name: string;            // Kartenname
  game: string;            // Game ID
  set: string;             // Set ID
  setName: string;         // Set-Name
  rarity: string;          // Rarity
  tcgplayerId: string | null;  // TCGPlayer Product ID (für Bild)
  tcgplayerSkuId: string | null; // TCGPlayer SKU ID (für SKU-Feld)
  condition: string;       // Default "Near Mint"
  stock: number;           // Default 0
  variants: Array<{ condition: string; printing: string; price: number }>; // Für Marktpreis-Extraktion
}
```

Logik:
1. Card-Record finden oder erstellen (wie `POST /api/admin/boxes/[id]/cards`)
2. Duplikat-Check: `shop + card + condition` → 409
3. InventoryItem erstellen mit vorausgefüllter SKU

### Entfällt

- `GET /api/cards` (die einfache Suchroute die wir vorhin gebaut haben) — wird durch JustTCG-Suche ersetzt. Datei kann gelöscht werden.

## Neue Komponente

### `ShopInventoryManager`

Ersetzt die bestehende `ShopInventoryTable`. Neue Datei: `components/shop/shop-inventory-manager.tsx`

Enthält:
- Zwei-Spalten-Layout-Container
- Linke Spalte: Kartensuche (eigene Sub-Komponente `ShopCardSearch`)
- Rechte Spalte: Inventar-Tabelle (eigene Sub-Komponente `ShopInventoryList`)
- Mobile: Tab-Umschaltung

### `ShopCardSearch`

Basiert auf der Logik von `JustTCGCardSearch`, aber angepasst:
- Listenansicht statt Dropdown
- "+" Button statt direktem Add-to-Box
- Prüft `existingInventoryIds` um Duplikate zu markieren
- Ruft `onAdd(cardData)` Callback auf

### `ShopInventoryList`

Tabelle mit Inline-Edit, ersetzt `ShopInventoryTable`:
- Empfängt `newItemId` prop um neue Einträge automatisch im Edit-Modus zu öffnen
- Zustandsänderung triggert SKU-Update

## Shop-Bewerbung: Kleinunternehmer-Checkbox

In `ShopApplyForm` wird eine Checkbox ergänzt:
- Label: "Ich unterliege der Kleinunternehmerregelung (§19 UStG)"
- Default: unchecked (= regulär, 19% MwSt)
- Wird als `isSmallBusiness: boolean` an `POST /api/shop/apply` gesendet und im ShopProfile gespeichert

## Nicht im Scope (Projekt 1)

- Fulfillment / Claim-Flow (Projekt 2)
- Versandaufträge / Tracking (Projekt 3)
- Stripe-Integration für Versandkosten (Projekt 2)
- Rechnungsstellung / MwSt-Berechnung (Projekt 4)
- Round-Robin-Logik (Projekt 2)
- User-Adressverwaltung (Projekt 2)
