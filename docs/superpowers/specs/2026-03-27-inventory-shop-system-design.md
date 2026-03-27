# Inventory & Shop-System Design

**Datum:** 2026-03-27
**Status:** Approved

## Problemstellung

Wenn eine Karte in einer Box den Bestand 0 erreicht, wird sie aktuell aus dem Draw-Pool entfernt. Das verschiebt die Wahrscheinlichkeitsverteilung und macht den Pack-Preis konzeptionell falsch. Statt den Preis dynamisch anzupassen (volatil, schlecht für UX), wird die Karte durch eine gleichwertige Ersatzkarte aus einem globalen Inventar substituiert.

Gleichzeitig soll ein vollständiges Inventarsystem aufgebaut werden, das Shops (Partner) ermöglicht, ihren Bestand manuell einzupflegen — mit späterer API-Integration für Warenwirtschaftssysteme.

## Datenmodell

### User-Role-Enum Erweiterung

```
"user" | "admin" | "super_admin" | "shop"
```

### Neues Model: `InventoryItem`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `card` | ObjectId ref Card | Referenz auf die Karte (required) |
| `shop` | ObjectId ref User | Shop-Betreiber (role: shop, required) |
| `stock` | number (min 0) | Verfügbarer Bestand |
| `ean` | string \| null | EAN für spätere Warenwirtschafts-Integration |
| `sku` | string \| null | SKU für spätere Warenwirtschafts-Integration |
| `notes` | string \| null | Interne Notiz des Shops |
| `pricePerUnit` | number \| null | Einkaufspreis (für spätere Abrechnung) |
| `createdAt` | Date | - |
| `updatedAt` | Date | - |

### Neues Model: `ShopProfile`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `user` | ObjectId ref User (unique) | Verknüpfter User-Account |
| `companyName` | string | Firmenname |
| `status` | `"pending" \| "approved" \| "rejected"` | Bewerbungsstatus |
| `rejectReason` | string \| null | Ablehnungsgrund (bei rejected) |
| `licenseFile` | string | GridFS File-ID des Gewerbescheins |
| `submittedAt` | Date | Einreichungszeitpunkt |
| `reviewedBy` | ObjectId ref User \| null | Admin der die Entscheidung traf |
| `reviewedAt` | Date \| null | Zeitpunkt der Entscheidung |

### Box-Schema: Erweiterung `IBoxCard`

```typescript
// Neue Felder in IBoxCard:
isSubstitute: boolean        // default: false
originalCard: ObjectId | null // Referenz auf die ursprüngliche Karte
```

Wenn `isSubstitute = true`, zeigt die Box-Detailansicht ein Badge "Ersatz für [Originalkarte]" — transparent für User sichtbar.

## Substitutions-Flow

Ausgelöst innerhalb des bestehenden `/api/packs/[id]/open` API-Calls, **nach** den atomaren Stock-Dekrementierungen, als neues `lib/substitution.ts` Modul.

```
Für jede Karte, die in diesem Pack-Opening auf stock=0 gefallen ist:

  1. SUCHE: InventoryItem wo
       - card.internalPrice innerhalb ±5 Coins des Originals
       - stock > 0
       - sortiert nach kleinstem Preisabstand (nächster Wert gewinnt)

  2a. GEFUNDEN:
       - Berechne Menge = min(inventoryItem.stock, drawnCount)
         (drawnCount = wie viele Einheiten dieser Karte gerade gezogen wurden,
          da stock jetzt 0 ist gilt: stock_vorher = drawnCount)
       - Dekrementiere InventoryItem.stock um diese Menge
       - Ersetze box.cards-Eintrag:
           card        = neue CardId
           stock       = Menge
           isSubstitute = true
           originalCard = alte CardId
       - Admin-Notification: "Karte X wurde durch Y substituiert in Box Z"

  2b. NICHT GEFUNDEN:
       - Box.status = "paused"
       - Admin-Notification (error): "Keine Ersatzkarte für X in Box Z — Box pausiert"
```

Die `drawPacks`-Funktion in `lib/pack-engine.ts` bleibt **unverändert**. Die gesamte Substitutions-Logik liegt in `lib/substitution.ts`.

## Shop-Registrierungs-Flow

1. User ist eingeloggt → Account-Einstellungen → Tab/Abschnitt **"Als Shop bewerben"**
2. Formular: Firmenname + Gewerbenachweis-Upload (PDF oder Bild, via GridFS wie bestehende Avatar-Uploads)
3. `ShopProfile` wird mit `status: "pending"` erstellt
4. Admins erhalten Notification mit Link zu `/admin/shops`
5. Admin prüft Dokument, entscheidet:
   - **Freischalten:** `User.role = "shop"`, `ShopProfile.status = "approved"` → User-Notification "Bewerbung angenommen"
   - **Ablehnen:** `ShopProfile.status = "rejected"`, `rejectReason` gesetzt → User-Notification "Bewerbung abgelehnt: [Grund]"
6. Freigeschaltete Shops können sofort Inventory-Items anlegen; Bestand ist sofort für Substitutionen verfügbar

## API-Routen

### Shop (role: shop)
```
GET    /api/inventory           → Eigene Items auflisten
POST   /api/inventory           → Neues Item erstellen
PATCH  /api/inventory/[id]      → Item aktualisieren (nur eigene)
DELETE /api/inventory/[id]      → Item löschen (nur eigene)
POST   /api/shop/apply          → Bewerbung einreichen + Dokument hochladen
GET    /api/shop/profile        → Eigenes ShopProfile lesen
```

### Admin
```
GET    /api/admin/inventory        → Alle Items (mit Shop-Filter)
PATCH  /api/admin/inventory/[id]   → Manuelles Override (z.B. Substitution korrigieren)
GET    /api/admin/shops            → Alle Bewerbungen
PATCH  /api/admin/shops/[id]       → Approve / Reject
GET    /api/admin/shops/[id]/license → Gewerbenachweis-Datei streamen
```

## UI-Seiten

### Shop-Interface
- `/[lang]/shop/inventory` — CRUD eigener Inventory-Items (Karte, Bestand, EAN, SKU, Notiz, Einkaufspreis)
- Nur eigene Items sichtbar (server-seitig nach `shop = session.userId` gefiltert)

### Admin-Interface
- `/[lang]/admin/inventory` — Globale Übersicht aller Items, filterbar nach Shop; Spalte "In Verwendung" zeigt welche Box die Karte als Substitut nutzt
- `/[lang]/admin/shops` — Bewerbungs-Übersicht mit Status, Dokumentenansicht, Approve/Reject-Aktion

## Berechtigungen

| Aktion | shop | admin | super_admin |
|--------|------|-------|-------------|
| Eigene Inventory-Items verwalten | ✓ | ✓ | ✓ |
| Alle Inventory-Items sehen | - | ✓ | ✓ |
| Shop-Bewerbungen reviewen | - | ✓ | ✓ |
| Box-Substitution manuell überschreiben | - | ✓ | ✓ |

## Edge Cases

**Shop löscht ein InventoryItem, das aktuell als Substitut in einer Box verwendet wird:**
- `DELETE /api/inventory/[id]` prüft, ob dieses Item als Substitut referenziert wird (`box.cards.card === inventoryItem.card && isSubstitute === true`)
- Wenn ja: Löschen wird blockiert mit Fehlermeldung "Karte wird aktuell in Box X als Ersatz verwendet"
- Shop muss zunächst Bestand auf 0 setzen (löst ggf. erneute Substitutionssuche aus) oder Admin kontaktieren

## Nicht im Scope (MVP)

- Automatische Shop-API-Integration (Webhooks, Polling) — folgt nach erstem Shop-Onboarding
- Priorisiertes Substitutions-Mapping pro Box (Admin wählt bevorzugte Ersatzkarte) — mögliche spätere Erweiterung
- Shop-Abrechnung auf Basis von `pricePerUnit` — Feld wird schon angelegt, Logik folgt später
