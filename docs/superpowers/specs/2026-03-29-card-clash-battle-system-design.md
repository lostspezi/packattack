# Card Clash — Battle System Design

## Context

PackAttack.gg ist eine Pack-Opening-Plattform für TCG-Karten (Pokémon, MTG etc.) mit Coin-Economy, Cart/Checkout-System und Live-Events via SSE. Bisher öffnen User Packs solo. Ein Battle-System soll das Erlebnis um einen kompetitiven Multiplayer-Modus erweitern, der Community-Engagement fördert, Gamification-Elemente einführt und sich dabei bewusst **nicht wie Gambling anfühlt**. Referenz: pullbox.gg Battles. Das Konzept heißt **Card Clash** — ein Hybrid aus Arena-Feeling (ELO, Spectators) und Party-Spannung (simultane Card-Flips, Preset-Chat).

---

## 1. Battle-Flow (7 Phasen)

### Phase 1: Erstellen
- Ersteller wählt: **Box**, **Packs pro Spieler** (1-10), **Spieleranzahl** (2-10+)
- Coin-Einsatz pro Spieler = `box.priceInCoins × packsPerPlayer`
- Optionen: Öffentlich/Privat, Mindest-ELO, Einladungslink
- Route: `POST /api/battles`

### Phase 2: Lobby
- Spieler treten bei → Coins werden **reserviert** (atomar: `User.findOneAndUpdate({ coins: { $gte: cost } }, { $inc: { coins: -cost } })` — Coins werden sofort abgezogen, aber bei Verlassen vor Start zurückerstattet)
- Lobby zeigt: Spieler-Avatare, ELO-Rating, Ränge, Badges, aktuelle Win-Streak
- Preset-Chat ist aktiv, Spectators können bereits zuschauen
- Battle startet automatisch wenn alle Slots gefüllt → **5s Countdown**
- Spieler können vor Start wieder austreten (Coins werden freigegeben)

### Phase 3: Pack Opening (Server-seitig)
- Server zieht Karten für alle Spieler gleichzeitig via bestehende `drawPacks()` aus `lib/pack-engine.ts`
- Karten werden **nicht** sofort angezeigt — sie werden für den Runden-Reveal gespeichert
- Coins werden jetzt **endgültig abgezogen** (atomar mit `$gte` Check)
- Box-Stock wird dekrementiert (atomare Updates wie bei regulären Packs)
- `CoinTransaction` mit Type `battle_entry` wird erstellt

### Phase 4: Clash-Runden (Kernstück)
- Pro Runde: Alle Spieler decken gleichzeitig **eine Karte** auf
- **Card-Flip-Animation** mit Rarity-abhängiger Dramatik:
  - Common: schneller Flip (0.5s)
  - Rare: langsamer + Glow (1.5s)
  - Ultra Rare: Slowmo + Partikel + Sound (3s)
- Karten werden nach **coinValue** verglichen → Rundengewinner bekommt **1 Punkt**
- **Tiebreaker**: Höhere Rarity gewinnt, dann Zufall
- **Streak-Anzeige**: 3+ Runden in Folge → "🔥 ON FIRE"-Effekt (rein kosmetisch)
- Gesamtrunden = `cardsPerPack × packsPerPlayer`
- Server steuert Timing zentral (3-5s Pause zwischen Runden, abhängig von Rarity)

### Phase 5: Ergebnis & Podium
- Finale Rangliste mit **Podium-Animation** (Top 3), Konfetti für Platz 1
- Statistiken: Gesamtwert gezogen, beste Karte, Runden gewonnen
- **ELO-Update** wird angezeigt (+/- Punkte pro Spieler)
- Bei Gleichstand: Höherer Gesamtwert der gezogenen Karten entscheidet

### Phase 6: Kartenverteilung
- Alle Karten (von allen Spielern) werden nach **coinValue** sortiert (höchster zuerst)
- **Snake-Draft-Verteilung** nach Platzierung:
  - Beispiel (4 Spieler, 20 Karten): P1 bekommt Karte 1,8,9,16,17 | P2 bekommt 2,7,10,15,18 | P3 bekommt 3,6,11,14,19 | P4 bekommt 4,5,12,13,20
  - Jeder bekommt exakt gleich viele Karten
- Platz 1 bekommt die wertvollsten Karten, letzte Plätze die Bulk-Karten

### Phase 7: Claim / Convert
- Jeder Spieler sieht seine zugeteilten Karten
- Pro Karte: **Warenkorb** (3h Reservation via CartItem) oder **Coins umwandeln**
- Identisch zum bestehenden Pull-Decide-System (`/api/pulls/decide`)
- Bulk-Convert-Bonus bleibt verfügbar (≥3 Karten aus ≥3 Packs)

---

## 2. Punkte-System

| Situation | Regel |
|-----------|-------|
| Rundengewinn | Spieler mit der wertvollsten Karte (nach coinValue) bekommt 1 Punkt |
| Gleichstand | Rarity-Tiebreaker (höhere Seltenheit gewinnt), dann Zufall |
| Streak-Bonus | 3+ Runden in Folge: visueller "🔥 ON FIRE"-Effekt (rein kosmetisch, keine Extra-Punkte) |
| Finale Platzierung | Meiste Punkte = Platz 1. Tiebreaker: höherer Gesamtwert der gezogenen Karten |

---

## 3. ELO-Rating-System

- **Startwert**: 1000 ELO
- **K-Faktor**: Neue Spieler (<30 Battles) K=40, erfahrene Spieler (30+) K=20
- **Multi-Player**: ELO-Berechnung gegen den Durchschnitt aller Gegner
- **Ränge**:

| Rang | ELO | Beschreibung |
|------|-----|-------------|
| 🥉 Bronze | 0–999 | Einstieg |
| 🥈 Silber | 1000–1199 | Startwert |
| 🥇 Gold | 1200–1399 | Erfahrene Spieler |
| 💎 Diamant | 1400–1599 | Top-Spieler |
| 👑 Champion | 1600+ | Elite (Top 1%) |

- ELO und Rang werden in der Battle-Lobby, im Profil und im Leaderboard angezeigt

---

## 4. Gamification

### Achievements & Badges
Achievements schalten Badges frei über das bestehende `badges[]`-Array im User-Model.

| Key | Name | Bedingung |
|-----|------|-----------|
| `first_clash` | Erster Clash | 1. Battle gespielt |
| `win_streak_3` | On Fire | 3er Win-Streak |
| `underdog` | Underdog | Gegen 200+ ELO höheren Gegner gewonnen |
| `sharpshooter` | Scharfschütze | 10 Runden in Folge gewonnen |
| `champion_rank` | Champion | Champion-Rang erreicht |
| `veteran` | Veteran | 100 Battles gespielt |
| `jackpot` | Jackpot | Ultra Rare in einem Battle gezogen |
| `host_10` | Gastgeber | 10 Battles erstellt |

### Win-Streaks (rein kosmetisch)
| Streak | Effekt |
|--------|--------|
| 3 Wins | 🔥 Flammen-Aura am Avatar in der Lobby |
| 5 Wins | 🔥🔥 Intensivere Flammen + temporärer "On Fire"-Badge |
| 10 Wins | 👑🔥 Goldene Flammen + "Unaufhaltbar"-Anzeige |

Bewusst **keine Coin-Boni** für Streaks — hält das System fair und verhindert Gambling-Druck.

### Seasons
- **Monatliche Seasons** mit eigenem Leaderboard
- Season-Ende-Belohnungen:
  - Top 10: Exklusive Season-Badges (z.B. "Season 1 Champion")
  - Top 50: Bonus-Coins
- **Soft-Reset**: `(ELO - 1000) × 0.5 + 1000` (zieht Richtung Mitte)

### Leaderboard-Kategorien
- 🏆 Höchstes ELO
- ⚔️ Meiste Wins
- 🔥 Längste Win-Streak
- 💰 Wertvollster Pull

### Special Events (Admin-gesteuert)
- Zeitlich begrenzte Events mit besonderen Regeln
- Beispiele: "Pokémon Weekend", "High-Roller Night" (ab Gold-Rang), "Double Points"

---

## 5. Spectator-Modus

### Zugang
- Über die **Battle-Übersichtsseite** (laufende öffentliche Battles)
- Über **Share-Link** (direkt vom Ersteller geteilt)
- Über den **Live-Feed** (bestehende SSE-Events)

### Sichtbarkeit
| Element | Sichtbar? |
|---------|-----------|
| Card-Flips in Echtzeit | ✅ |
| Scoreboard & Spieler-Info | ✅ |
| Preset-Chat (lesen + senden) | ✅ (eigene Spectator-Kategorie) |
| Runden-Ergebnisse & Podium | ✅ |
| Coin-Werte der Karten | ❌ (erst nach Battle-Ende) |
| Claim/Convert-Entscheidungen | ❌ |

### Spectator-Zähler
- "👀 12 Zuschauer" im Battle-Header
- Realisiert über Redis Pub/Sub Presence-Tracking (wie Chat-System)

---

## 6. Preset-Chat System

### Kategorien & Nachrichten

**🔥 HYPE**: "Let's gooo!", "Nicht schlecht!", "Das wird wild!", "Krass!"

**😱 REAKTION**: "Das war knapp!", "Oh nein...", "Unglaublich!", "RIP 💀"

**🤝 RESPEKT**: "Gut gespielt!", "GG! 🤝", "Starker Pull!", "Respekt!"

**⚔️ BATTLE**: "Rematch? ⚔️", "Ich bin bereit!", "Glück gehabt! 😏", "Nächstes Mal!"

**👀 SPECTATOR** (nur für Zuschauer): "Spannend! 🍿", "Go go go!", "Was ein Battle!", "😱😱😱"

### Regeln
- Nachrichten sind bilingual (de/en) — Anzeige basierend auf Empfänger-Sprache
- **Rate-Limit**: Max 1 Nachricht pro 2 Sekunden pro User
- Nachrichten erscheinen als **Bubbles neben dem Spieler-Avatar**
- Nachrichten werden als Admin-definierte Einträge in der DB gespeichert (erweiterbar)

---

## 7. Reconnect & Session-Recovery

### `GET /api/battles/active`
- Prüft ob der User in einem laufenden Battle ist (analog zu `/api/pulls/pending`)
- Gibt das aktive Battle zurück oder `null`

### Reconnect-Flow
1. User lädt eine beliebige Seite → Client ruft `GET /api/battles/active` auf
2. Aktives Battle gefunden → Banner: "Du bist in einem aktiven Battle!" → [Zurück zum Battle]
3. Auf der Battle-Seite: SSE-Reconnect → Server schickt `sync` Event mit komplettem State
4. Client springt zur richtigen Phase (Lobby/Runde X/Podium/Claim)
5. Verpasste Runden werden als schnelle Replay-Animation nachgeholt

### SSE `sync` Event
```json
{
  "type": "sync",
  "battle": {
    "status": "clash",
    "currentRound": 7,
    "totalRounds": 15,
    "players": [{ "userId": "...", "name": "...", "score": 4, "eloAtStart": 1150, "streak": 2 }],
    "completedRounds": [{ "roundIndex": 0, "cards": [...], "winnerId": "..." }],
    "spectatorCount": 12
  }
}
```

### Edge Cases
| Situation | Verhalten |
|-----------|-----------|
| Refresh während Countdown | Reconnect, Countdown läuft serverseitig weiter |
| Refresh während Runde | Sync-Event, verpasste Runden als schnelle Replay |
| Refresh während Podium | Podium-Ergebnis sofort anzeigen (keine Animation) |
| Refresh während Claim/Convert | Zugeteilte Karten + bisherige Entscheidungen anzeigen |
| Internet kurz weg | SSE reconnected automatisch, sync Event holt auf |
| User verlässt komplett | Battle läuft weiter, Karten werden verteilt, Claim/Convert muss nachgeholt werden |

### Sperr-Logik
Solange ein aktives Battle läuft oder undecided BattlePulls existieren:
- ❌ Kein neues Battle erstellen oder beitreten
- ❌ Keine regulären Packs öffnen
- ✅ Cart/Checkout für bereits reservierte Items weiterhin möglich

---

## 8. Datenmodelle

### Battle (neues Model)
```
{
  _id, slug (unique, z.B. "clash-a3f8x2")
  createdBy: ObjectId → User
  box: ObjectId → Box
  packsPerPlayer: number (1-10)
  maxPlayers: number (2+)
  status: "waiting" | "countdown" | "opening" | "clash" | "finished" | "cancelled"
  visibility: "public" | "private"
  minElo: number | null

  players: [{
    user: ObjectId → User
    joinedAt: Date
    coinsReserved: number
    eloAtStart: number
    score: number
    placement: number | null
    eloChange: number | null
  }]

  rounds: [{
    roundIndex: number
    cards: [{ player: ObjectId → User, card: ObjectId → Card, rarity: string, coinValue: number }]
    winnerId: ObjectId → User | null
    revealedAt: Date
  }]

  currentRound: number
  totalRounds: number
  startedAt: Date | null
  finishedAt: Date | null
  seasonId: ObjectId → Season | null
  timestamps
}
```

### BattlePull (neues Model)
```
{
  _id
  battle: ObjectId → Battle
  user: ObjectId → User (ursprünglicher Zieher)
  card: ObjectId → Card
  rarity: string
  coinValue: number
  conversionValue: number
  roundIndex: number
  status: "pending" | "distributed" | "claimed" | "converted"
  distributedTo: ObjectId → User | null (Empfänger nach Ranking-Verteilung)
  decidedAt: Date | null
  timestamps
}
```

### Season (neues Model)
```
{
  _id
  name: { de: string, en: string }
  number: number
  startsAt: Date
  endsAt: Date
  status: "upcoming" | "active" | "ended"
  rewards: [{
    minPlacement: number
    maxPlacement: number
    type: "badge" | "coins"
    badgeKey: string | null
    coinAmount: number | null
  }]
  timestamps
}
```

### BattleAchievement (neues Model)
```
{
  _id
  user: ObjectId → User
  key: string (z.B. "first_clash", "win_streak_3")
  unlockedAt: Date
  battle: ObjectId → Battle | null
}
```

### User Model (Erweiterungen)
- `elo: number` (default: 1000)
- `battleStats: { wins: number, losses: number, streak: number, bestStreak: number }`

### CoinTransaction (Erweiterungen)
- Neue Types: `battle_entry`, `battle_card_conversion`
- Neues Feld: `battleId: ObjectId → Battle | null`

---

## 9. API-Endpoints

| Method | Endpoint | Zweck |
|--------|----------|-------|
| POST | `/api/battles` | Battle erstellen |
| POST | `/api/battles/{id}/join` | Battle beitreten (Coins reservieren) |
| DELETE | `/api/battles/{id}/leave` | Battle verlassen (vor Start) |
| GET | `/api/battles` | Offene Battles auflisten (Filter: status, box, game) |
| GET | `/api/battles/{id}` | Battle-Details |
| GET | `/api/battles/{id}/events` | SSE-Stream (Spieler + Spectators) |
| POST | `/api/battles/{id}/chat` | Preset-Chat-Nachricht senden |
| POST | `/api/battles/{id}/decide` | Claim/Convert nach Verteilung |
| GET | `/api/battles/active` | Aktives Battle des Users (Reconnect) |
| GET | `/api/battles/leaderboard` | Leaderboard (Season/All-Time) |
| GET | `/api/battles/stats/{userId}` | User Battle-Statistiken |

### SSE Events (`/api/battles/{id}/events`)
- `player_joined` / `player_left` — Lobby-Updates
- `battle_start` — Countdown → Start
- `round_reveal` — Karten dieser Runde (mit Timing-Info für Animationen)
- `round_result` — Rundengewinner + Scoreboard-Update
- `chat_message` — Preset-Chat-Nachricht
- `spectator_count` — Zuschauer-Update
- `battle_end` — Finale Ergebnisse + ELO-Changes
- `distribution` — Kartenverteilung pro Spieler
- `sync` — Kompletter State (bei Reconnect)

---

## 10. Seiten & UI-Struktur

| Route | Beschreibung |
|-------|-------------|
| `/[lang]/battles` | Übersicht: Offene Battles, laufende Battles (spectate), Quick-Match, "Battle erstellen" |
| `/[lang]/battles/create` | Erstellung: Box wählen, Packs, Spieleranzahl, Sichtbarkeit, Min-ELO |
| `/[lang]/battles/{slug}` | Battle-View: Lobby → Clash-Runden → Podium → Claim/Convert. Gleiche Seite für Spieler & Spectators. |
| `/[lang]/battles/leaderboard` | Leaderboard mit Season-Filter und Kategorien |
| `/[lang]/profile` (erweitert) | Neuer Tab: Battle-Stats, ELO-Verlauf, Achievements, History |

---

## 11. Integration mit bestehenden Systemen

| System | Integration |
|--------|------------|
| **Pack-Engine** | `drawPacks()` aus `lib/pack-engine.ts` — pro Spieler ein Aufruf |
| **Cart/Checkout** | Claim → CartItem (3h Reservation) → bestehender Checkout-Flow |
| **CoinTransaction** | Neue Types `battle_entry` + `battle_card_conversion`, neues Feld `battleId` |
| **SSE / Redis** | Neuer Channel `battle:{id}`, gleiche Architektur wie Chat + Live-Events |
| **Presence-Tracking** | Spectator-Zähler via Redis (analog Chat-Presence) |
| **Badge-System** | Achievements vergeben Badges über bestehendes `badges[]` Array |
| **Bulk-Convert** | Bleibt verfügbar für Battle-Karten (≥3 Karten aus ≥3 Packs) |
| **Box-Stock** | Atomare Stock-Dekrementierung wie bei regulären Pack-Openings |

---

## 12. Anti-Gambling Design-Entscheidungen

| Entscheidung | Begründung |
|-------------|-----------|
| Keine Coin-Boni für Win-Streaks | Verhindert "Druck" bei Streak-Verlust |
| Jeder bekommt gleich viele Karten | Verlierer gehen nicht leer aus |
| Rein kosmetische Streak-Effekte | Engagement ohne finanzielle Anreize |
| Transparentes Punkte-System | Klar nachvollziehbar, kein versteckter RNG |
| Kein Echtgeld-Einsatz | Nur Coins, die auch für reguläre Packs genutzt werden |
| Spectator-Modus ohne Wetten | Community-Engagement ohne Gambling-Mechanik |
| Coin-Werte für Spectators versteckt | Fokus auf Spaß, nicht auf Geldwerte |
| ELO-System | Skill-basiertes Ranking statt reines Glück |

---

## 13. Verifikation & Testing

### Manuell testen
1. Battle erstellen (verschiedene Spieleranzahlen, Boxen)
2. Beitreten mit mehreren Accounts → Lobby-Flow
3. Battle durchspielen → Runden-Reveals, Scoring
4. Ergebnis prüfen: Kartenverteilung korrekt nach Ranking?
5. Claim/Convert → Karten landen im Warenkorb bzw. Coins werden gutgeschrieben
6. Reconnect testen: Tab schließen während Battle → Seite neu laden → sync
7. Spectator-Modus: Als Nicht-Teilnehmer Battle live mitschauen
8. Preset-Chat: Rate-Limiting, bilingual, Spectator-Kategorie

### Automatisierte Tests
- Unit Tests: ELO-Berechnung, Snake-Draft-Verteilung, Scoring-Logik
- Integration Tests: Battle-Lifecycle (erstellen → beitreten → starten → Runden → finish)
- Race Conditions: Gleichzeitiges Beitreten, doppeltes Claim/Convert
- Edge Cases: User verlässt Battle, nur 1 Slot übrig + Join, Box ohne Stock
