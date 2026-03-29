# Card Clash — Benutzer-Anleitung

## Was ist Card Clash?

Card Clash ist ein Multiplayer-Battle-Modus auf PackAttack. Du trittst gegen andere Spieler an, indem ihr gleichzeitig Packs öffnet und Karte für Karte vergleicht. Wer am Ende die meisten Runden gewinnt, steht auf dem Podium ganz oben — und bekommt die wertvollsten Karten.

---

## So funktioniert ein Battle

### 1. Battle erstellen oder beitreten

**Erstellen** (`/battles/create`):
- Wähle eine Box, die Anzahl Packs pro Spieler (1-10) und die Spieleranzahl (2-20)
- Optionen: Öffentlich oder Privat, Mindest-ELO
- Kosten pro Spieler = Box-Preis x Packs pro Spieler

**Beitreten** (`/battles`):
- Offene Battles werden auf der Battle-Übersicht angezeigt
- Klicke auf "Beitreten" — deine Coins werden sofort abgezogen
- Du kannst vor dem Start jederzeit wieder austreten (Coins werden zurückerstattet)

### 2. Lobby

- Du siehst alle Spieler mit Avatar, ELO-Rang und Win-Streak
- Zuschauer können bereits live zuschauen
- Sobald alle Slots belegt sind, startet ein **5-Sekunden-Countdown**
- Du kannst den Preset-Chat nutzen, um mit anderen zu kommunizieren

### 3. Clash-Runden

- Alle Spieler decken gleichzeitig **eine Karte** auf
- Die Karte mit dem höchsten Coin-Wert gewinnt die Runde (1 Punkt)
- Bei Gleichstand entscheidet die Seltenheit der Karte
- Gewinnst du 3+ Runden hintereinander, erscheint der **ON FIRE**-Effekt
- Die Gesamtanzahl der Runden = Karten pro Pack x Packs pro Spieler

### 4. Ergebnis & Podium

- Am Ende wird das Podium angezeigt (Top 3 mit Animation)
- Du siehst deine ELO-Veränderung (+/- Punkte)
- Bei Punktegleichstand entscheidet der Gesamtwert der gezogenen Karten

### 5. Kartenverteilung

Alle gezogenen Karten (von allen Spielern) werden nach Wert sortiert und per **Snake-Draft** verteilt:
- Platz 1 bekommt die wertvollsten Karten
- Jeder Spieler bekommt **exakt gleich viele** Karten
- Auch der Letztplatzierte geht nicht leer aus

### 6. Claim oder Convert

Für jede zugeteilte Karte hast du zwei Optionen:
- **Warenkorb** — Die Karte wird reserviert (3h Timer, wie bei Pack Openings)
- **In Coins umwandeln** — Du bekommst sofort den Conversion-Wert gutgeschrieben

---

## ELO-Rating & Ränge

Jeder Spieler startet mit **1000 ELO**. Nach jedem Battle steigt oder sinkt dein ELO abhängig vom Ergebnis und der Stärke deiner Gegner.

| Rang | ELO | Symbol |
|------|-----|--------|
| Bronze | 0 - 999 | 🥉 |
| Silber | 1000 - 1199 | 🥈 |
| Gold | 1200 - 1399 | 🥇 |
| Diamant | 1400 - 1599 | 💎 |
| Champion | 1600+ | 👑 |

Dein Rang wird in der Lobby, im Profil und im Leaderboard angezeigt.

---

## Achievements

Durch Battles kannst du spezielle Badges freischalten:

| Badge | Bedingung |
|-------|-----------|
| Erster Clash | Erstes Battle gespielt |
| On Fire | 3 Battles in Folge gewonnen |
| Underdog | Gewonnen gegen Spieler mit 200+ ELO mehr |
| Scharfschuetze | 10 Runden in Folge gewonnen |
| Champion | Champion-Rang erreicht (1600+ ELO) |
| Veteran | 100 Battles gespielt |
| Jackpot | Ultra Rare oder besser in einem Battle gezogen |
| Gastgeber | 10 Battles erstellt |

---

## Leaderboard (`/battles/leaderboard`)

Das Leaderboard zeigt die besten Spieler in drei Kategorien:
- **ELO-Rating** — Gesamtwertung
- **Siege** — Meiste Gewinne
- **Beste Serie** — Längste Gewinnsträhne

Dein eigener Rang wird unten angezeigt.

---

## Preset-Chat

Während eines Battles kannst du vorgefertigte Nachrichten senden. Eigene Texteingabe ist nicht möglich.

**Kategorien:**
- **Hype** — "Let's gooo!", "Das wird wild!"
- **Reaktion** — "Das war knapp!", "Unglaublich!"
- **Respekt** — "Gut gespielt!", "GG!"
- **Battle** — "Rematch?", "Ich bin bereit!"
- **Zuschauer** — Nur fuer Spectators sichtbar

Es gibt eine kurze Abklingzeit (2 Sekunden) zwischen Nachrichten.

---

## Zuschauer-Modus

Du kannst laufende Battles live verfolgen, ohne selbst teilzunehmen:
- Oeffne ein laufendes Battle ueber die Battle-Uebersicht
- Du siehst alle Kartenaufdeckungen und Ergebnisse in Echtzeit
- Du kannst Zuschauer-Nachrichten im Chat senden

---

## Seite neu laden / Verbindung verloren?

Keine Sorge — dein Battle laeuft weiter:
- Bei Seitenreload wirst du automatisch zurueck ins Battle geleitet
- Ein Banner auf jeder Seite zeigt dir, dass du in einem aktiven Battle bist
- Das Battle laeuft serverseitig weiter, auch wenn du kurz offline bist
- Verpasste Runden werden beim Reconnect als Zusammenfassung nachgeholt

**Wichtig:** Solange du in einem aktiven Battle bist, kannst du keine neuen Battles erstellen oder beitreten und keine regulaeren Packs oeffnen.
