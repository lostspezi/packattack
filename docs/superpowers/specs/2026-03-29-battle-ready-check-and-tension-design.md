# Battle Ready-Check & Spannungsaufbau — Design Spec

## Goal

Zwei Kernprobleme im Battle-System beheben:
1. Battles starten sofort ohne Ready-Bestätigung — Spieler können überrumpelt werden
2. Runden laufen zu schnell ab ohne Spannungsaufbau — kein dramatisches Erlebnis

## Architecture

Das Battle-System wird um einen Ready-Check-Mechanismus (LoL-Style) und eine komplett überarbeitete Runden-Choreografie erweitert. Alles server-gesteuert via SSE-Events, Client animiert nur was der Server vorgibt.

## Tech Stack

- MongoDB/Mongoose (Battle-Model Erweiterung)
- Redis Pub/Sub (neue SSE-Events)
- Next.js API Routes (neuer Ready-Endpoint)
- React Client Components (Animation, Ready-Check UI)
- CSS Animations/Transitions (Glow, Shake, Partikel)

---

## 1. Neue Battle-Statuskette

```
waiting → ready_check → countdown → opening → clash → finished/cancelled
```

`ready_check` ist ein neuer Status zwischen `waiting` und `countdown`.

---

## 2. Ready-Check System

### Flow

1. Letzter Spieler joint → Status wechselt zu `"ready_check"`
2. SSE-Event `ready_check_start` wird an alle Spieler gesendet
3. Alle Spieler sehen einen "Ready"-Button mit 30-Sekunden-Countdown-Timer
4. Spieler klickt "Ready" → `POST /api/battles/[id]/ready` → SSE `player_ready` an alle (Häkchen am Avatar)
5. **Alle ready:** 3s visueller Countdown ("3... 2... 1... FIGHT!") → Battle startet (`runBattle()`)
6. **30s Timer abgelaufen, nicht alle ready:**
   - Nicht-ready Spieler werden gekickt, Coins zurückerstattet
   - SSE-Event `players_kicked` mit Liste der gekickten User-IDs
   - Battle geht zurück auf `"waiting"`, neue Spieler können beitreten
   - Ready-Spieler bleiben im Battle (ready-Status wird zurückgesetzt für den nächsten Durchlauf)

### API Endpoint

**`POST /api/battles/[id]/ready`**
- Auth: Nur eingeloggte Spieler die im Battle sind
- Validierung: Battle muss im Status `"ready_check"` sein
- Aktion: Setzt `player.ready = true` in DB
- Prüft ob alle Spieler ready sind → wenn ja, startet Battle
- SSE-Event: `player_ready { userId }`

### Ready-Check Timer (Server-seitig)

- Timer startet wenn Status auf `"ready_check"` wechselt
- Nach 30 Sekunden prüft der Server welche Spieler nicht ready sind
- Implementierung: `setTimeout` im Orchestrator oder separater Timer-Mechanismus
- Nicht-ready Spieler werden entfernt, Coins zurückgebucht via `CoinTransaction`

### Battle-Model Erweiterung

```typescript
// Player-Subdocument bekommt neues Feld:
ready: { type: Boolean, default: false }

// Battle bekommt neues Feld:
readyCheckStartedAt: { type: Date, default: null }

// Status-Enum erweitert:
status: "waiting" | "ready_check" | "countdown" | "opening" | "clash" | "finished" | "cancelled"
```

### Reconnect während Ready-Check

- `ready`-Status ist in der DB gespeichert
- Bei SSE-Reconnect sendet `sync`-Event den aktuellen Ready-Check-Zustand
- Spieler der vorher Ready geklickt hat, bleibt Ready
- Spieler der Seite schließt und nicht zurückkommt: Timer läuft ab → wird gekickt

---

## 3. Runden-Ablauf mit Spannungsaufbau

### Choreografie pro Runde

| Schritt | SSE-Event | Dauer | Beschreibung |
|---------|-----------|-------|--------------|
| 1. Ankündigung | `round_announce` | 3s | Rundenummer wird groß eingeblendet (Zoom-Effekt) |
| 2. Aufbau | — (Client-Timer) | 3s | Karten erscheinen verdeckt, leichtes Wackeln/Glühen |
| 3. Karten-Reveal | `card_reveal` (pro Spieler) | 1s Flip + 4s Display | Karten werden einzeln nacheinander aufgedeckt |
| 4. Zwischen-Pause | — (Client-Timer) | 3s | Nächste Karte wackelt, Spannung steigt |
| 5. (Wiederhole 3-4 für jeden Spieler) | | | Reihenfolge jede Runde zufällig |
| 6. Vergleichs-Pause | — (Client-Timer) | 4s | Alle Karten sichtbar, Gewinner noch unklar |
| 7. Gewinner-Enthüllung | `round_result` | 3s / 8s | Abhängig von `isClose` Flag |
| 8. Score-Update | — (Client-Timer) | 3s | Punkte zählen animiert hoch |
| 9. Übergang | — (Client-Timer) | 2s | Fade zur nächsten Runde |

### Reveal-Reihenfolge

- Jede Runde wird die Reihenfolge der Spieler-Reveals **zufällig** bestimmt
- Die Reihenfolge wird im `round_announce`-Event als `revealOrder: userId[]` mitgesendet
- Server steuert die Timings — sendet `card_reveal` Events mit den korrekten Pausen

### Seltene Karten — Extra-Dramatik

Wenn eine Karte mit hoher Seltenheit aufgedeckt wird, bekommt sie zusätzliche Display-Zeit und visuelle Effekte:

- **Rare+ (RARITY_ORDER >= 3):** +2s extra Display-Zeit, Glow-Effekt um die Karte, Partikel-Animation
- **Ultra Rare+ (RARITY_ORDER >= 5):** +4s extra Display-Zeit, intensiver Glow, Screen-Shake, goldene Partikel

### Gewinner-Enthüllung

**Normaler Fall (klarer Unterschied):**
- Gewinnerkarte bekommt goldenen Rahmen + Größen-Puls
- Verlierer-Karten werden leicht ausgegraut
- Score zählt animiert hoch
- Dauer: 3s

**Knapper Fall (`isClose: true`):**
- Definition "knapp": Coinwert-Differenz der Top-2-Karten < 20% vom höheren Wert
- Spotlight wechselt 4-5x zwischen den Top-Karten hin und her (je ~400ms)
- Dann bleibt Spotlight auf dem Gewinner stehen
- Goldener Rahmen + Puls, Verlierer ausgegraut
- Dauer: 8s

**Unentschieden (`winnerId: null`):**
- Beide/alle Karten gleich hervorgehoben (kein Highlight, kein Ausgrauen)
- "Unentschieden!" Text-Animation
- Kein Punkt für niemanden
- Dauer: 3s

### Timings pro Runde (geschätzt)

- **2 Spieler:** ~31s (klarer Sieger) bis ~36s (knapp), +2-4s bei seltenen Karten
- **4 Spieler:** ~47s (klarer Sieger) bis ~55s (knapp), +2-4s bei seltenen Karten

---

## 4. Gewinner-Logik (überarbeitet)

### Einziges Kriterium: Coinwert

```
Höherer Coinwert gewinnt.
Gleicher Coinwert = Unentschieden.
```

- Seltenheit wird **nicht** mehr als Tiebreaker genutzt
- Kein Random-Fallback mehr
- Seltenheit beeinflusst nur noch die Animation (Glow, Partikel, extra Display-Zeit)

### Unentschieden-Regeln

- `winnerId: null` im `round_result`
- Kein Spieler bekommt einen Punkt
- Streak wird nicht unterbrochen (Unentschieden zählt weder als Sieg noch als Niederlage)

---

## 5. Neue SSE-Events

| Event | Payload | Wann |
|-------|---------|------|
| `ready_check_start` | `{ timeoutSeconds: 30 }` | Battle voll, Ready-Check beginnt |
| `player_ready` | `{ userId }` | Spieler klickt Ready |
| `players_kicked` | `{ kickedUserIds: string[], refunded: true }` | 30s Timer abgelaufen |
| `round_announce` | `{ roundIndex, totalRounds, revealOrder: string[] }` | Runde startet |
| `card_reveal` | `{ roundIndex, playerId, card: { _id, name, image }, rarity, coinValue }` | Einzelne Karte aufgedeckt |

### Geänderte Events

| Event | Änderung |
|-------|----------|
| `round_result` | Neues Feld `isClose: boolean`, `winnerId` kann `null` sein (Unentschieden) |
| `battle_start` | Wird jetzt erst nach Ready-Check gesendet (nach "3-2-1-FIGHT" Countdown) |

### Entfernte Events

| Event | Ersetzt durch |
|-------|---------------|
| `round_reveal` (alle Karten auf einmal) | `card_reveal` (einzeln pro Spieler) |

---

## 6. Reconnect-Verhalten

- **Seite neu laden:** SSE reconnect → `sync`-Event mit aktuellem Stand
- **Verpasste Runden:** User springt direkt zur aktuellen Runde, verpasste Runden sind weg
- **Während Ready-Check:** `ready`-Status bleibt in DB erhalten, User sieht Ready-Check-Screen mit verbleibender Zeit
- **Während Clash:** User sieht aktuellen Score und steigt bei der laufenden Runde wieder ein

---

## 7. Dateien-Übersicht

### Neue Dateien

| Datei | Zweck |
|-------|-------|
| `app/api/battles/[id]/ready/route.ts` | Ready-Endpoint |

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `models/battle.ts` | `ready: boolean` im Player-Schema, `readyCheckStartedAt` Feld, Status `"ready_check"` |
| `lib/battle-constants.ts` | Neue Timing-Konstanten (READY_CHECK_TIMEOUT, ROUND_ANNOUNCE_DELAY, CARD_REVEAL_DISPLAY, etc.) |
| `lib/battle-engine.ts` | `determineRoundWinner()` — nur Coinwert, Unentschieden bei Gleichstand, `isClose` Berechnung |
| `lib/battle-orchestrator.ts` | Ready-Check-Flow, neue Runden-Choreografie mit einzelnen `card_reveal` Events und Timings |
| `app/api/battles/[id]/join/route.ts` | Bei vollem Battle: Status auf `ready_check` statt `runBattle()` direkt |
| `app/api/battles/[id]/events/route.ts` | `sync`-Event um Ready-Check-Zustand erweitern |
| `components/battles/battle-view.tsx` | Neue SSE-Events handeln (`ready_check_start`, `player_ready`, `players_kicked`, `round_announce`, `card_reveal`) |
| `components/battles/battle-lobby.tsx` | Ready-Check UI (Ready-Button, 30s Timer, Häkchen pro Spieler) |
| `components/battles/battle-clash.tsx` | Neue Animationssequenz (einzelne Reveals, Spannungspausen, Gewinner-Choreografie, Unentschieden-Anzeige, knappes Ergebnis Spotlight) |
| `components/battles/card-flip.tsx` | Rarity-Effekte (Glow, Screen-Shake, Partikel je nach Seltenheit) |
