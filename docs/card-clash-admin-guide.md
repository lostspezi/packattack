# Card Clash — Admin-Handbuch

## Ueberblick

Das Card Clash Battle-System laeuft weitgehend automatisch. Admins muessen vor allem Seasons verwalten und koennen Battles im Problemfall manuell eingreifen.

```
Battle erstellt → Lobby (Coins reserviert) → Countdown → Pack Opening → Clash-Runden → Podium → Kartenverteilung → Claim/Convert
```

---

## Datenmodelle

### Battle

Kern-Model mit folgenden Status-Uebergaengen:

```
waiting → countdown → opening → clash → finished
                                            ↘ cancelled (bei Fehler oder Creator-Leave)
```

| Feld | Beschreibung |
|------|-------------|
| `slug` | Eindeutiger Short-URL-Slug (z.B. "clash-a3f8x2") |
| `box` | Referenz zur Box |
| `packsPerPlayer` | 1-10 Packs pro Spieler |
| `maxPlayers` | 2-20 Spielerplaetze |
| `status` | Aktueller Phase (siehe oben) |
| `visibility` | `public` oder `private` |
| `minElo` | Optionale Mindest-ELO zum Beitreten |
| `players[]` | Spieler-Array mit Score, ELO-Snapshot, Platzierung |
| `rounds[]` | Runden-Array mit Karten und Gewinner |
| `seasonId` | Referenz zur aktiven Season (falls vorhanden) |

### BattlePull

Jede im Battle gezogene Karte wird als `BattlePull` gespeichert:

| Feld | Beschreibung |
|------|-------------|
| `battle` | Referenz zum Battle |
| `user` | Spieler, der die Karte gezogen hat |
| `card` | Referenz zur Karte |
| `distributedTo` | Spieler, der die Karte nach Snake-Draft erhalten hat |
| `status` | `pending` → `distributed` → `claimed` / `converted` |

### Season

Monatliche kompetitive Saisons:

| Feld | Beschreibung |
|------|-------------|
| `name` | Lokalisierter Name (de/en) |
| `number` | Fortlaufende Nummer |
| `startsAt` / `endsAt` | Zeitraum |
| `status` | `upcoming` → `active` → `ended` |
| `rewards[]` | Belohnungen pro Platzierungsrange |

### BattleAchievement

Speichert freigeschaltete Achievements pro User. Unique Index auf `{user, key}` verhindert Duplikate.

---

## Coin-Flow

| Zeitpunkt | Aktion | CoinTransaction Type |
|-----------|--------|---------------------|
| Beitritt | Coins abgezogen (atomar mit `$gte` Guard) | `battle_entry` |
| Verlassen vor Start | Coins zurueckerstattet | `battle_refund` |
| Karte convertieren | Conversion-Wert gutgeschrieben | `battle_card_conversion` |

Alle Transaktionen haben ein `relatedBattleId` Feld fuer Zuordnung.

**Wichtig:** Coins werden beim Beitritt sofort abgezogen, nicht erst beim Start. Das verhindert Race Conditions. Bei Verlassen vor Start wird ein Refund erstellt.

---

## Season-Verwaltung

Seasons werden ueber die DB verwaltet (aktuell kein Admin-UI). Eine Season hat:

```json
{
  "name": { "de": "Season 1", "en": "Season 1" },
  "number": 1,
  "startsAt": "2026-04-01T00:00:00Z",
  "endsAt": "2026-04-30T23:59:59Z",
  "status": "upcoming",
  "rewards": [
    { "minPlacement": 1, "maxPlacement": 1, "type": "badge", "badgeKey": "season_1_champion" },
    { "minPlacement": 2, "maxPlacement": 3, "type": "coins", "coinAmount": 500 }
  ]
}
```

Das Battle-System holt automatisch die aktive Season (`status: "active"`) und verknuepft neue Battles damit. Leaderboard kann nach Season gefiltert werden.

---

## User-Model-Erweiterungen

Folgende Felder wurden zum User-Model hinzugefuegt:

| Feld | Typ | Default | Beschreibung |
|------|-----|---------|-------------|
| `elo` | Number | 1000 | ELO-Rating |
| `battleStats.wins` | Number | 0 | Siege |
| `battleStats.losses` | Number | 0 | Niederlagen |
| `battleStats.streak` | Number | 0 | Aktuelle Gewinnserie |
| `battleStats.bestStreak` | Number | 0 | Laengste Gewinnserie |
| `battleStats.totalBattles` | Number | 0 | Gesamt Battles |
| `battleStats.battlesCreated` | Number | 0 | Erstellte Battles |

---

## Problembehandlung

### Battle haengt (Status bleibt stecken)

Der Orchestrator laeuft als `async`-Funktion serverseitig. Bei Fehlern setzt er das Battle automatisch auf `cancelled` und publiziert ein Error-Event. Falls ein Battle dennoch haengt:

```javascript
// In MongoDB Shell / Compass
db.battles.updateOne(
  { _id: ObjectId("...") },
  { $set: { status: "cancelled" } }
)
```

### Coins nicht zurueckerstattet

Pruefen, ob ein `battle_refund` CoinTransaction existiert:

```javascript
db.cointransactions.find({
  relatedBattleId: ObjectId("BATTLE_ID"),
  type: "battle_refund"
})
```

Falls nicht, manuell erstellen und User-Coins anpassen.

### BattlePulls im "distributed"-Status haengen

Wenn ein Spieler seine Karten nicht claimed/converted hat, bleiben die BattlePulls auf `distributed`. Diese blockieren den User (keine neuen Battles). Pruefen:

```javascript
db.battlepulls.find({
  distributedTo: ObjectId("USER_ID"),
  status: "distributed"
})
```

---

## API-Endpoints (Referenz)

| Method | Endpoint | Zweck |
|--------|----------|-------|
| POST | `/api/battles` | Battle erstellen |
| GET | `/api/battles` | Offene Battles auflisten |
| GET | `/api/battles/active` | Aktives Battle des Users (Reconnect) |
| GET | `/api/battles/leaderboard` | Leaderboard |
| GET | `/api/battles/{id}` | Battle-Details (by ID oder Slug) |
| POST | `/api/battles/{id}/join` | Beitreten |
| DELETE | `/api/battles/{id}/leave` | Verlassen |
| GET | `/api/battles/{id}/events` | SSE-Stream |
| POST | `/api/battles/{id}/chat` | Preset-Chat |
| POST | `/api/battles/{id}/decide` | Claim/Convert |

---

## Sperr-Logik

Solange ein User in einem aktiven Battle ist (Status nicht `finished`/`cancelled` ODER noch `distributed` BattlePulls hat):
- Kann kein neues Battle erstellen oder beitreten
- Kann keine regulaeren Packs oeffnen
- Kann weiterhin den Warenkorb/Checkout nutzen
