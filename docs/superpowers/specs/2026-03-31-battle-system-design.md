# Battle System — Design Spec

## Context

PackAttack.gg bietet Usern das Öffnen von TCG-Booster-Packs mit Animationen und Kartenzusammenfassung. Dieses Feature erweitert die Plattform um ein Battle-System, in dem 2–4 Spieler strategisch gegeneinander antreten. Im Gegensatz zu reinen Glücks-Battles (wie bei Pullbox.gg, HypeDrop) hat unser System ein **Strategie-Element**: Spieler sehen 5 Karten und wählen 1 aus.

**Warum Neustart statt bestehendem Code**: Der alte Card-Clash-Code wird gelöscht. Das neue System hat fundamental andere Mechaniken (Kartenauswahl statt reine Zufallsziehung, 4 Modi, Tier-basiertes Ziehen).

**Alleinstellungsmerkmale vs. Konkurrenz:**
- Strategische Kartenauswahl (kein anderes Pack-Battle-System hat das)
- Snake Draft als fairer Verteilmodus
- ELO + Seasons + Leaderboard

---

## 1. Datenmodell (MongoDB/Mongoose)

### Battle (Hauptdokument)

```typescript
interface IBattle {
  _id: ObjectId
  slug: string               // unique, URL-fähig, auto-generiert
  creator: ObjectId           // User-Ref
  box: ObjectId               // Box-Ref
  players: IBattlePlayer[]
  settings: {
    playerCount: 2 | 3 | 4
    rounds: 3 | 5 | 7
    mode: "lowest_card" | "highest_card" | "all_cards" | "snake_draft"
    isPrivate: boolean
    inviteCode: string | null   // 6-stellig für private Battles
  }
  entryFee: number              // Coins (rounds × Faktor basierend auf Box)
  status: "waiting" | "ready_check" | "countdown" | "active" | "sudden_death" | "finished" | "cancelled"
  currentRound: number
  lobbyExpiresAt: Date          // 5 Min nach Erstellung
  readyCheckExpiresAt: Date | null
  startCountdownAt: Date | null // 3 Min Countdown nach Ready-Check
  rounds: IBattleRound[]        // embedded
  result: IBattleResult | null
  seasonId: ObjectId | null
  createdAt: Date
  updatedAt: Date
}
```

### BattlePlayer (embedded in Battle)

```typescript
interface IBattlePlayer {
  user: ObjectId
  joinedAt: Date
  isReady: boolean
  readyAt: Date | null
  roundsWon: number
}
```

### BattleRound (embedded in Battle)

```typescript
interface IBattleRound {
  roundNumber: number
  hands: IBattleHand[]
  winner: ObjectId | null        // null = Gleichstand
  status: "selecting" | "revealing" | "completed"
  selectDeadline: Date           // 30 Sek nach Rundenstart
  revealedAt: Date | null
}

interface IBattleHand {
  player: ObjectId
  cards: IVirtualCard[]          // 5 Karten (tier-basiert generiert)
  selectedCardIndex: number | null
  selectedAt: Date | null
}

interface IVirtualCard {
  cardId: ObjectId
  name: string
  image: string
  rarity: string
  coinValue: number
}
```

### BattleResult (embedded in Battle)

```typescript
interface IBattleResult {
  winner: ObjectId | null        // null bei Unentschieden (nach Sudden Death unmöglich)
  isDraw: boolean
  finalScores: { player: ObjectId; roundsWon: number }[]
  transfers: IBattleTransfer[]
  eloChanges: { player: ObjectId; oldElo: number; newElo: number; change: number }[]
  completedAt: Date
}

interface IBattleTransfer {
  from: ObjectId
  to: ObjectId
  cards: IVirtualCard[]
  mode: string
}
```

### Season (bestehendes Model erweitern)

```typescript
interface ISeason {
  _id: ObjectId
  name: string
  startsAt: Date
  endsAt: Date
  status: "upcoming" | "active" | "ended"
  eloResetBaseline: number       // Soft-Reset Wert (z.B. 1000)
  rewards: ISeasonReward[]
}

interface ISeasonReward {
  minRank: number
  maxRank: number
  type: "coins" | "badge"
  value: number | string         // Coins-Anzahl oder Badge-Key
}
```

### Indexes

```
Battle: { slug: 1 } unique
Battle: { status: 1, lobbyExpiresAt: 1 }   // Lobby-Abfrage
Battle: { "players.user": 1, status: 1 }    // Aktive Battles eines Users
Battle: { seasonId: 1, status: 1 }          // Season-Battles
Battle: { createdAt: -1 }                   // Neueste zuerst
```

---

## 2. Tier-basiertes Kartenziehen

Problem: Boxen haben viele 1-Coin-Karten. Rein zufälliges Ziehen von 5 Karten ergibt oft 5×1 Coin = langweilig.

**Lösung: Stratifiziertes Ziehen nach Wert-Tiers**

Per Hand von 5 Karten:
- **Tier 1** (coinValue 1–10): 2 Karten
- **Tier 2** (coinValue 11–50): 1 Karte
- **Tier 3** (coinValue 51–200): 1 Karte
- **Tier 4** (coinValue 200+): 1 Karte

Fallback-Regeln:
- Wenn ein Tier nicht genug Karten hat → nächsthöherer/niedrigerer Tier füllt auf
- Innerhalb eines Tiers: gewichtete Zufallsauswahl (wie bei Pack-Opening)
- Karten sind **virtuell** — kein Stock-Verbrauch

**Implementierung**: Neue Funktion `generateBattleHand(boxCards: IBoxCard[])` in `lib/battle-engine.ts`

---

## 3. API-Endpunkte

```
POST   /api/battles              → Battle erstellen
GET    /api/battles              → Lobby (offene Battles) + eigene aktive
GET    /api/battles/[id]         → Battle-Details (kompletter State für Reconnect)
POST   /api/battles/[id]/join    → Beitreten (Coin-Reservierung)
POST   /api/battles/[id]/ready   → Ready-Check bestätigen
POST   /api/battles/[id]/start   → Manueller Start (nur Creator, nur im countdown-Status)
POST   /api/battles/[id]/select  → Karte wählen (roundNumber + cardIndex)
POST   /api/battles/[id]/leave   → Verlassen (nur status=waiting)
GET    /api/battles/[id]/events  → SSE-Stream

GET    /api/leaderboard          → Leaderboard (?season=id&sort=elo|wins|winrate|streak)
GET    /api/leaderboard/me       → Eigene Position

GET    /api/seasons              → Alle Seasons
GET    /api/seasons/current      → Aktive Season
POST   /api/admin/seasons        → Season CRUD
DELETE /api/admin/battles/[id]   → Battle abbrechen (Admin)
```

### SSE Events (Redis Pub/Sub auf `battle:{id}`)

```
player_joined      → { player, playerCount }
player_left        → { player }
ready_check        → { expiresAt }
player_ready       → { player }
battle_start       → { }
round_start        → { roundNumber, hand: IVirtualCard[], selectDeadline }
player_selected    → { player }  (ohne Karteninfo! Verdeckt)
round_reveal       → { roundNumber, selections: [{player, card}], winner }
battle_end         → { result: IBattleResult }
battle_cancelled   → { reason }
```

---

## 4. Battle-Flow (komplett)

### 4.1 Erstellung
1. User wählt Box, Spieleranzahl (2/3/4), Runden (3/5/7), Modus, Sichtbarkeit
2. Server validiert: User eingeloggt, nicht in aktivem Battle, genug Coins
3. Gebühr = `rounds × box.battleFeePerRound` (Admin setzt `battleFeePerRound` als Feld auf dem Box-Model, z.B. 15 Coins/Runde → 3 Runden = 45 Coins)
4. Coins werden **reserviert** (CoinTransaction type: "battle_entry")
5. Battle erstellt, Status: `waiting`, Lobby-Timer: 5 Min
6. SSE-Channel `battle:{id}` geöffnet

### 4.2 Beitreten
1. Spieler sieht Battle in Lobby, klickt "Beitreten"
2. Server prüft: Battle offen, nicht voll, Timer nicht abgelaufen, User != Creator, nicht in anderem Battle
3. Coins reserviert
4. Wenn voll → Status: `ready_check`, `readyCheckExpiresAt` = now + 30s
5. **Browser Push Notification** an alle Spieler + In-App-Notification
6. SSE: `ready_check` Event

### 4.3 Ready-Check
1. Alle Spieler haben 30 Sekunden zum Bestätigen (`POST /ready`)
2. Alle bestätigt → Status: `countdown`, `startCountdownAt` = now + 3min
3. Jemand nicht bestätigt → Spieler wird entfernt, Coins zurück, Status: `waiting`
4. SSE: `player_ready` / `battle_cancelled`

### 4.4 Start
1. Creator klickt "Start" ODER 3-Min-Timer läuft ab → Auto-Start
2. Status: `active`, currentRound: 1
3. Server generiert 5 Karten pro Spieler (tier-basiert) für Runde 1
4. SSE: `round_start` mit Hand-Daten (jeder sieht nur seine eigenen!)

### 4.5 Runde
1. **Auswahl (30 Sek)**: Spieler wählen verdeckt 1 Karte (`POST /select`)
2. SSE: `player_selected` (ohne Karteninfo — nur dass jemand gewählt hat)
3. Timer abgelaufen ohne Wahl → Server wählt zufällig
4. Alle gewählt → **Reveal**: Flip-Animation (card-back.jpg → Karte)
5. SSE: `round_reveal` mit allen Karten + Rundengewinner
6. Höchster coinValue = Rundensieger, bei Gleichstand = kein Punkt
7. currentRound++, nächste Runde starten (zurück zu Schritt 1)

### 4.6 Battle-Ende
1. Alle Runden gespielt → Spieler mit meisten Rundensiegen gewinnt
2. **Gleichstand** → Sudden Death: 1 Extra-Runde (status: `sudden_death`)
3. Ergebnis berechnen: ELO, Kartenverteilung nach Modus

### 4.7 Kartenverteilung (Modi)

**Modus 1 — Niedrigste Karte**: Gewinner erhält die Karte mit dem niedrigsten coinValue aus allen gespielten Karten des Verlierers. Bei Gleichstand: erste gezogene Karte.

**Modus 2 — Höchste Karte**: Gewinner erhält die Karte mit dem höchsten coinValue aus allen gespielten Karten des Verlierers. Bei Gleichstand: erste gezogene Karte.

**Modus 3 — Alle Karten**: Gewinner erhält alle gespielten Karten des Verlierers.

**Modus 4 — Snake Draft**: Alle gespielten Karten aller Spieler werden nach coinValue sortiert. Verteilung in Snake-Reihenfolge nach Platzierung:
- 2 Spieler: P1, P2, P2, P1, P1, P2, ...
- 3 Spieler: P1, P2, P3, P3, P2, P1, P1, P2, P3, ...
- 4 Spieler: P1, P2, P3, P4, P4, P3, P2, P1, ...

**Bei 3+ Spielern** (Modi 1-3): Jeder Verlierer gibt Karten an den Gesamtgewinner nach dem jeweiligen Modus. Platzierung basiert auf Rundensiegen (meiste = Platz 1). Bei Gleichstand zwischen Nicht-Erstplatzierten: alle gelten als Verlierer.

**Sudden Death bei 3+ Spielern**: Nur die Spieler mit den meisten Rundensiegen (Gleichstand an Platz 1) spielen die Sudden Death Runde. Andere Spieler warten.

### 4.8 ELO-Berechnung

- Startelo: 1000
- K-Faktor: 40 (unter 30 Battles) / 20 (erfahren)
- Paarweiser Vergleich: Expected = 1/(1+10^((opponent-elo)/400))
- ELO-Change = K × (actual - expected)
- Ranks: Bronze (0-999), Silver (1000-1199), Gold (1200-1399), Diamond (1400-1599), Champion (1600+)

### 4.9 Auto-Storno
- Lobby-Timer (5 Min) abgelaufen → Status: `cancelled`, Coins zurück
- Server-seitiger Cron-Job oder BullMQ delayed job

---

## 5. Disconnect & Reconnect

- **Server ist Single Source of Truth** — Client ist nur View
- SSE-Disconnect → Spieler als "disconnected" markiert, Battle läuft weiter
- Während Kartenauswahl: Timer läuft weiter, bei Ablauf → zufällige Karte
- Reconnect: `GET /api/battles/[id]` liefert kompletten State, SSE neu verbinden
- Während Ready-Check: Nicht bestätigt = entfernt nach 30 Sek

---

## 6. Real-Time Architektur

- **SSE (Server-Sent Events)** über `GET /api/battles/[id]/events`
- **Redis Pub/Sub** als Message-Broker: Channel `battle:{battleId}`
- Server-Funktionen publishen Events → SSE-Handler forwarden an Clients
- **Heartbeat**: Alle 15 Sekunden `:ping` über SSE
- **Browser Push Notifications**: Web Push API für Ready-Check (wenn User in anderem Tab)

---

## 7. UI-Struktur

### Seiten

```
/battles                    → Lobby (Sidebar-Layout: Erstellen links, Battles rechts)
/battles/[slug]             → Battle-Ansicht (Gameplay, Waiting Room, Ergebnis)
/leaderboard                → Leaderboard mit Season-Selector
```

### Responsive Design Prinzipien

**Desktop**: Volle Breite nutzen (max-w-screen-2xl oder breiter), großzügige Abstände (p-6/p-8), Karten und Spielfelder groß und immersiv. Kein gestauchtes Layout — der verfügbare Platz soll eine Premium-Erfahrung liefern.

**Tablet**: Angepasstes Grid (2 Spalten Lobby, Karten etwas kleiner), Touch-optimierte Buttons (min 44px Tap-Target).

**Mobile**: Single-Column, Karten stacken vertikal, Swipe-Gesten für Kartenauswahl, Bottom-Sheet für Aktionen. Battle-Hand als horizontaler Scroll mit Snap.

Breakpoints: `sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`, `2xl:1536px`

### Lobby (Sidebar-Layout)
- **Links**: Battle-Erstellen-Panel (Box-Auswahl als Kacheln, Spieleranzahl 2/3/4, Runden 3/5/7, 4 Modi, Sichtbarkeit, Gebühr-Anzeige, Erstellen-Button)
- **Rechts**: Offene Battles als Karten (Box, Runden, Modus, Spieler x/y, Gebühr, Timer, Beitreten-Button)

### Battle-Ansicht

**Waiting Room**: Spieler-Slots, Lobby-Timer, Chat (optional)
**Ready-Check**: Modal-Overlay mit 30-Sek-Timer, "Bereit"-Button
**Gameplay**:
  - Oben: Rundennummer, Score, Timer
  - Mitte oben: Gegner-Karten verdeckt (card-back.jpg)
  - Mitte: VS-Divider
  - Mitte unten: Eigene 5 Karten (offen, klickbar)
  - Unten: Bestätigen-Button
**Reveal**: Flip-Animation (bestehende CSS-3D-Rotation aus pack-opening), Karten-Vergleich groß
**Ergebnis**: Victory/Defeat-Banner, Rundenhistorie, Kartenverteilung (Snake Draft visuell), ELO-Change, Buttons (Neues Battle / Zur Lobby)

### Leaderboard
- Season/Global Toggle
- Sortierung: ELO / Siege / Winrate / Streak
- Season-Info-Banner (Name, Zeitraum, eigener Rang)
- Tabelle mit Rang, Spieler, ELO, Siege, W/L, Streak
- Eigene Position hervorgehoben
- Season Rewards am unteren Rand

---

## 8. Seasons & Admin

### Season-Verwaltung (Admin)
- CRUD für Seasons mit Name, Start/Enddatum
- Reward-Konfiguration: Platzierungsbereiche → Coins/Badges
- ELO Soft-Reset bei Season-Start (alle Spieler → Baseline, z.B. 1000)
- Automatische Verknüpfung: Neue Battles bekommen aktive Season-ID

### Admin Battle-Tools
- Battle abbrechen (mit Coin-Rückerstattung)
- Battle-Statistiken einsehen
- Box-Battle-Gebühr konfigurieren (`battleFeePerRound` Feld auf Box)

---

## 9. Zu löschende Dateien (alter Battle-Code)

Alle Dateien im bestehenden Card-Clash-System müssen entfernt werden:
- Models: battle.ts, battle-pull.ts, battle-achievement.ts (Season bleibt, wird erweitert)
- API-Routes: /api/battles/* (komplett, wird neu gebaut)
- Lib: battle-orchestrator.ts, battle-elo.ts, battle-achievements.ts
- Components: /components/battles/* (komplett)
- Docs: card-clash-*.md (veraltet)

---

## 10. Neue Dateien (Überblick)

```
models/battle.ts                        → Battle + BattleRound + BattleResult Schema
lib/battle-engine.ts                    → Kartenziehung (tier-basiert), Rundenbewertung
lib/battle-elo.ts                       → ELO-Berechnung (neu)
lib/battle-distribution.ts              → Snake Draft + Modi-Logik
lib/battle-events.ts                    → Redis Pub/Sub Helper
app/api/battles/route.ts                → GET (Lobby), POST (Erstellen)
app/api/battles/[id]/route.ts           → GET (Details)
app/api/battles/[id]/join/route.ts      → POST
app/api/battles/[id]/ready/route.ts     → POST
app/api/battles/[id]/start/route.ts     → POST
app/api/battles/[id]/select/route.ts    → POST
app/api/battles/[id]/leave/route.ts     → POST
app/api/battles/[id]/events/route.ts    → GET (SSE)
app/api/leaderboard/route.ts            → GET
app/api/leaderboard/me/route.ts         → GET
app/api/seasons/route.ts                → GET
app/api/seasons/current/route.ts        → GET
app/api/admin/seasons/route.ts          → POST/PUT/DELETE
app/api/admin/battles/[id]/route.ts     → DELETE (cancel)
app/(main)/battles/page.tsx             → Lobby
app/(main)/battles/[slug]/page.tsx      → Battle-Ansicht
app/(main)/leaderboard/page.tsx         → Leaderboard
components/battles/battle-lobby.tsx      → Lobby-Layout
components/battles/battle-create.tsx     → Erstellungs-Panel
components/battles/battle-card.tsx       → Battle in Lobby
components/battles/battle-gameplay.tsx   → Gameplay-Orchestrator
components/battles/battle-hand.tsx       → 5 Karten Hand
components/battles/battle-reveal.tsx     → Reveal-Animation
components/battles/battle-result.tsx     → Ergebnis-Ansicht
components/battles/battle-ready-check.tsx → Ready-Check Modal
components/battles/battle-waiting.tsx    → Waiting Room
components/battles/snake-draft-view.tsx  → Draft-Visualisierung
components/leaderboard/leaderboard.tsx   → Leaderboard-Tabelle
components/leaderboard/season-selector.tsx
```

---

## 11. Verifizierung

### Manuelles Testen
1. Battle erstellen → Lobby prüfen → mit 2. Account beitreten
2. Ready-Check → beide bestätigen → Battle startet
3. 5 Karten sehen → 1 wählen → Reveal → Rundengewinner korrekt
4. Alle Runden durchspielen → Ergebnis + Kartenverteilung prüfen
5. Sudden Death bei Gleichstand testen
6. Disconnect simulieren (Tab schließen) → Reconnect → State korrekt
7. Lobby-Timer ablaufen lassen → Auto-Storno
8. Leaderboard nach Season filtern, Sortierung wechseln

### Automatisierte Tests (TDD)
- `battle-engine.test.ts`: Tier-basiertes Ziehen, Handgenerierung
- `battle-elo.test.ts`: ELO-Berechnung, Edge Cases
- `battle-distribution.test.ts`: Snake Draft, Modi 1-3
- `battle-api.test.ts`: Alle Endpunkte, Validierung, Race Conditions
- `battle-flow.test.ts`: Kompletter Battle-Ablauf, Timer, Sudden Death
