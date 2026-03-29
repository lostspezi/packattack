# Card Clash — Developer Guide

## Architektur

```
Frontend (React)          API Routes (Next.js)         Server-Side
┌─────────────────┐      ┌──────────────────┐        ┌───────────────────────┐
│ BattleView      │─SSE──│ /events (GET)    │──Redis──│ battle-orchestrator.ts│
│ ├─ BattleLobby  │      │ /join (POST)     │        │ ├─ countdown (5s)     │
│ ├─ BattleClash  │      │ /leave (DELETE)  │        │ ├─ drawPacks()        │
│ ├─ BattlePodium │      │ /chat (POST)     │        │ ├─ clash rounds       │
│ └─ BattleDecide │      │ /decide (POST)   │        │ ├─ ELO + placements   │
└─────────────────┘      └──────────────────┘        │ ├─ snake-draft        │
                                                      │ └─ achievements       │
                                                      └───────────────────────┘
```

**Kernprinzip:** Der Server steuert das komplette Battle-Timing. Kein Client-Timer bestimmt Rundenuebergaenge. Der Client reagiert nur auf SSE-Events.

---

## Dateistruktur

### Engine & Logik

| Datei | Verantwortung |
|-------|---------------|
| `lib/battle-constants.ts` | Alle Konstanten: ELO, Raenge, Timing, Chat-Messages, Rarity-Order, Achievements |
| `lib/battle-elo.ts` | ELO-Berechnung: K-Faktor, Rang-Lookup, paarweiser Vergleich, Season-Soft-Reset |
| `lib/battle-engine.ts` | Scoring: Rundengewinner, Platzierungen, Snake-Draft-Verteilung, Reveal-Delay |
| `lib/battle-orchestrator.ts` | Server-seitiger Lifecycle: Countdown → Draw → Rounds → Finish → Achievements |
| `lib/battle-achievements.ts` | Achievement-Pruefung + Badge-Vergabe (idempotent) |
| `lib/validations/battle.ts` | Zod-Schemas fuer alle Battle-API-Inputs |

### Models

| Datei | Verantwortung |
|-------|---------------|
| `models/battle.ts` | Battle-Dokument mit Spielern, Runden, Status |
| `models/battle-pull.ts` | Gezogene Karten mit Distribution-Tracking |
| `models/season.ts` | Monatliche Seasons |
| `models/battle-achievement.ts` | Achievement-Unlock-Tracking |

### API Routes

| Datei | Method | Beschreibung |
|-------|--------|-------------|
| `app/api/battles/route.ts` | GET, POST | Liste + Erstellen |
| `app/api/battles/active/route.ts` | GET | Aktives Battle (Reconnect) |
| `app/api/battles/leaderboard/route.ts` | GET | Leaderboard mit Pagination |
| `app/api/battles/[id]/route.ts` | GET | Details (by ID oder Slug) |
| `app/api/battles/[id]/join/route.ts` | POST | Beitreten (mit Redis Lock) |
| `app/api/battles/[id]/leave/route.ts` | DELETE | Verlassen + Refund |
| `app/api/battles/[id]/events/route.ts` | GET | SSE-Stream |
| `app/api/battles/[id]/chat/route.ts` | POST | Preset-Chat (Rate Limited) |
| `app/api/battles/[id]/decide/route.ts` | POST | Claim/Convert |

### Frontend

| Datei | Beschreibung |
|-------|-------------|
| `app/[lang]/(dashboard)/(pages)/battles/page.tsx` | Battle-Uebersicht |
| `app/[lang]/(dashboard)/(pages)/battles/create/page.tsx` | Battle erstellen |
| `app/[lang]/(dashboard)/(pages)/battles/[slug]/page.tsx` | Battle-View |
| `app/[lang]/(dashboard)/(pages)/battles/leaderboard/page.tsx` | Leaderboard |
| `components/battles/battle-view.tsx` | Haupt-Client-Komponente (SSE + State) |
| `components/battles/battle-lobby.tsx` | Lobby-Phase |
| `components/battles/battle-clash.tsx` | Runden-Ansicht |
| `components/battles/battle-podium.tsx` | Ergebnisse |
| `components/battles/battle-decide.tsx` | Claim/Convert |
| `components/battles/battle-scoreboard.tsx` | Live-Scoreboard |
| `components/battles/battle-preset-chat.tsx` | Chat-Panel |
| `components/battles/card-flip.tsx` | Animierte Kartenaufdeckung |
| `components/battles/battles-list.tsx` | Battle-Karten-Grid |
| `components/battles/create-battle-form.tsx` | Erstellungsformular |
| `components/battles/battle-leaderboard.tsx` | Leaderboard-Tabelle |
| `components/battles/battle-stats-card.tsx` | Profil-Stats |
| `components/battles/active-battle-banner.tsx` | Reconnect-Banner |

---

## Battle-Lifecycle (Orchestrator)

`runBattle(battleId)` wird aufgerufen, sobald das letzte Spieler-Slot gefuellt wird (in `/api/battles/[id]/join`). Die Funktion laeuft komplett serverseitig:

### 1. Countdown (5s)
```
Status: waiting → countdown
Event: battle_start { countdownSeconds: 5 }
```

### 2. Opening
```
Status: countdown → opening
- drawPacks() pro Spieler (shared Stock Pool)
- Box-Stock atomar dekrementiert
- CoinTransactions erstellt (battle_entry)
- BattlePull-Records gespeichert
- Runden-Array aufgebaut
Event: opening_complete
```

### 3. Clash-Runden
```
Status: opening → clash
Pro Runde:
  Event: round_reveal { roundIndex, cards[] }
  → sleep(3000-5000ms je nach Rarity)
  → determineRoundWinner()
  Event: round_result { roundIndex, winnerId, scores }
  → sleep(1500ms) zwischen Runden
```

### 4. Finish
```
Status: clash → finished
- calculatePlacements() (Score + totalValue Tiebreaker)
- calculateEloChanges() (paarweiser Vergleich)
- User-Stats + ELO aktualisiert
- snakeDraftDistribute() → BattlePulls aktualisiert
Event: battle_end { placements[] }
Event: distribution { targetUserId, cards[] } (pro Spieler)
- checkAndAwardAchievements() pro Spieler
```

### Error-Handling
```
catch → Status: cancelled
Event: error { message }
```

---

## SSE-Events (Referenz)

Der SSE-Endpoint (`/api/battles/[id]/events`) nutzt Redis Pub/Sub auf Channel `battle:{id}`.

| Event | Payload | Wann |
|-------|---------|------|
| `sync` | Kompletter Battle-State | Bei (Re-)Connect |
| `player_joined` | `{ userId, name, image, elo }` | Spieler tritt bei |
| `player_left` | `{ userId }` | Spieler verlaesst Lobby |
| `battle_start` | `{ countdownSeconds }` | Countdown beginnt |
| `opening_complete` | `{}` | Packs fertig gezogen |
| `round_reveal` | `{ roundIndex, cards[] }` | Karten aufdecken |
| `round_result` | `{ roundIndex, winnerId, scores }` | Rundengewinner |
| `battle_end` | `{ placements[] }` | Battle beendet |
| `distribution` | `{ targetUserId, cards[] }` | Karten verteilt |
| `chat` | `{ userId, messageKey, name }` | Chat-Nachricht |
| `spectator_count` | `{ count }` | Zuschauerzahl |
| `error` | `{ message }` | Fehler |

**Wichtig:** `distribution` Events werden nur an den jeweiligen `targetUserId` gefiltert (im SSE-Endpoint). Andere Spieler sehen nur ihre eigenen zugeteilten Karten.

---

## ELO-Berechnung

```typescript
// lib/battle-elo.ts

// K-Faktor: 40 fuer neue Spieler (<30 Battles), 20 fuer erfahrene
getKFactor(totalBattles: number) → 40 | 20

// Paarweiser Vergleich aller Spieler
// Jedes Paar: Expected = 1 / (1 + 10^((opponentElo - myElo) / 400))
// Actual = 1 (gewonnen), 0.5 (gleiche Platzierung), 0 (verloren)
// Aenderung = K * (actual - expected)
calculateEloChanges(players[]) → Map<userId, eloChange>

// Zero-Sum: Summe aller ELO-Aenderungen ≈ 0
```

---

## Snake-Draft-Verteilung

Karten werden nach `coinValue` absteigend sortiert, dann im Snake-Pattern verteilt:

```
Spieler nach Platzierung: P1, P2, P3, P4
Karten (nach Wert):       1,  2,  3,  4,  5,  6,  7,  8, ...

Runde 1 (vorwaerts):  P1←1, P2←2, P3←3, P4←4
Runde 2 (rueckwaerts): P4←5, P3←6, P2←7, P1←8
Runde 3 (vorwaerts):  P1←9, P2←10, ...
```

Ergebnis: P1 bekommt den hoechsten Gesamtwert, aber alle bekommen gleich viele Karten.

---

## Race-Condition-Schutz

### Join-Endpoint
- Redis Distributed Lock (`battle:join:{battleId}`, 10s TTL) verhindert parallele Joins
- Atomares `User.findOneAndUpdate({ coins: { $gte: cost } }, { $inc: { coins: -cost } })` verhindert Ueberziehung

### Active-Battle-Check
- Vor Battle-Erstellen und -Beitreten wird geprueft, ob der User bereits in einem aktiven Battle ist
- Prueft auch auf undecided BattlePulls (`status: "distributed"`)

### Box-Stock
- Atomares `Box.updateOne({ "cards.stock": { $gte: 1 } }, { $inc: { "cards.$.stock": -1 } })` pro Karte

---

## Tests

```bash
# Unit Tests (ELO + Engine)
npx vitest run __tests__/lib/battle-elo.test.ts __tests__/lib/battle-engine.test.ts

# Type Check
npx tsc --noEmit
```

Getestete Bereiche:
- ELO K-Faktor-Auswahl
- ELO Rang-Lookup
- ELO-Aenderungen (positiv/negativ, Zero-Sum, Upset-Bonus)
- Rundengewinner-Bestimmung (Wert, Rarity-Tiebreak)
- Platzierungsberechnung
- Snake-Draft-Verteilung (Fairness, gleiche Kartenanzahl)

---

## Integration mit bestehenden Systemen

| System | Integration |
|--------|------------|
| **Pack-Engine** | `drawPacks()` wird wiederverwendet (shared Stock Pool) |
| **Cart/Checkout** | Claim erstellt CartItem mit 3h Reservation (wie bei Pack Openings) |
| **CoinTransaction** | Neue Types: `battle_entry`, `battle_card_conversion`, `battle_refund` |
| **Badges** | Achievements vergeben Badges ueber bestehendes `badges[]` Array |
| **SSE/Redis** | Neuer Channel `battle:{id}`, gleiche Architektur wie Chat |
| **i18n** | 57 Uebersetzungen unter `battles.*` Namespaces in `seed/translations.ts` |

---

## Erweiterungsmoeglichkeiten

- **Season-Rewards**: Auto-Vergabe am Season-Ende (aktuell nur Model, kein Cron-Job)
- **Battle-History-API**: `/api/battles/stats/{userId}` fuer detaillierte User-Statistiken
- **Spectator-Chat-Erweiterung**: Emotes, Reactions
- **Private Battle Invites**: Einladungslinks per Share-URL
- **Quick Match**: Auto-Matching basierend auf ELO-Range
