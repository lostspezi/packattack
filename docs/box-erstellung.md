# Box-Erstellung — Anleitung

## 1. Neue Box anlegen

**Admin Panel → Boxen → Neue Box erstellen**

Folgende Pflichtfelder ausfüllen:

| Feld | Beschreibung |
|------|-------------|
| Name (DE/EN) | Name der Box in beiden Sprachen |
| Beschreibung (DE/EN) | Optional — wird dem User angezeigt |
| Spiel | Kartenspiel auswählen (z.B. One Piece Card Game) |
| Preis (Coins) | Was ein Pack kostet (1 Coin = 1€) |
| Karten/Pack | Wie viele Karten pro Pack gezogen werden |
| Gesamte Packs | Optional — Limit, leer = unbegrenzt |

Nach dem Speichern wird die Box als **Entwurf** erstellt.

---

## 2. Raritäten hinzufügen

Im rechten Sidebar unter **Rarities**:

- **Vom Spiel laden**: Lädt alle Raritäten des ausgewählten Spiels von der API
- **Manuell erstellen**: Eigene Rarity eingeben und mit + hinzufügen
- **Autocomplete**: Bereits gespeicherte Raritäten werden als Vorschlag angezeigt
- **Reihenfolge**: Per Drag & Drop (Desktop) oder Pfeiltasten (Mobile) sortieren — die Reihenfolge wird im Rarity-Dropdown der Karten übernommen

---

## 3. Karten hinzufügen

Im Bereich **Karten hinzufügen**:

1. **Kartenname** eingeben (mind. 2 Zeichen)
2. Optional: **Set** als Filter auswählen (Mehrfachauswahl möglich)
3. Suchergebnisse mit Kartenbild, Name, Set und Rarity erscheinen
4. Auf **+** klicken um eine Karte zur Box hinzuzufügen

Jede Karte wird mit **Gewicht 1** und **Bestand 0** initial hinzugefügt.

---

## 4. Karten konfigurieren

Die Kartentabelle (sortiert nach Marktpreis, aufsteigend) hat folgende editierbare Felder:

| Spalte | Beschreibung |
|--------|-------------|
| **Rarität** | Dropdown — kann von der API-Rarity abweichen |
| **Gewicht** | Bestimmt die Ziehwahrscheinlichkeit (0.001–1000) |
| **Coins** | Wert der Karte in Coins (ganze Zahlen, min. 1) |
| **Bestand** | Verfügbare Stückzahl — bei 0 wird die Karte NICHT gezogen |
| **Min.** | Mindestbestand — unter diesem Wert wird die Zeile gelb markiert |

### Wie die Ziehchance berechnet wird

```
Ziehchance = Gewicht der Karte / Summe aller Gewichte × 100
```

Die Gewichte sind **relativ** zueinander — es zählt nur das Verhältnis, nicht die absoluten Zahlen.

#### Einfaches Beispiel

3 Karten:

| Karte | Gewicht | Rechnung | Ziehchance |
|-------|---------|----------|------------|
| Common A | 80 | 80 / 100 | **80%** |
| Rare B | 15 | 15 / 100 | **15%** |
| Ultra Rare C | 5 | 5 / 100 | **5%** |
| **Summe** | **100** | | **100%** |

Die gleichen Ziehchancen bekommst du auch mit 8, 1.5 und 0.5 — das Verhältnis bleibt identisch.

#### Praxis-Beispiel (One Piece Box)

| Karte | Marktpreis | Gewicht | Ziehchance |
|-------|-----------|---------|------------|
| Jinbe (Common) | $0.12 | 28.9 | 28.92% |
| Sanji (Common) | $0.19 | 18.3 | 18.27% |
| Stussy (Super Rare) | $0.39 | 8.9 | 8.90% |
| Arlong (Alt Art) | $4.55 | 0.76 | 0.76% |
| Mihawk SP | $174.31 | 0.02 | 0.02% |
| Mihawk Manga | $1,084.82 | 0.003 | 0.003% |

**Wichtig:** Teurere Karten haben niedrigere Gewichte → werden seltener gezogen. Eine $0.12-Karte wird ~9.600× häufiger gezogen als eine $1.084-Karte.

#### Regeln

- Mindestgewicht: **0.001** (extrem selten)
- Maximalgewicht: **1000** (extrem häufig)
- Karten mit **Bestand 0** werden automatisch aus der Ziehung ausgeschlossen
- Die Gewichte können manuell oder per Auto-Berechnung gesetzt werden

### Farbliche Markierung

| Farbe | Bedeutung |
|-------|-----------|
| **Rot** | Bestand = 0 — Karte wird nicht gezogen |
| **Gelb** | Bestand ≤ Mindestbestand — Warnung, bald nachbestellen |
| **Normal** | Bestand über Mindestbestand — alles OK |

---

## 5. Auto-Berechnung (optional)

Der **Auto-Berechnung** Button berechnet automatisch alle Gewichte, Coin-Werte und den Pack-Preis. Ideal für den Erstaufbau einer Box.

### Was wird berechnet?

#### 1. Gewichte (Ziehwahrscheinlichkeit)

Formel: **Gewicht = 1 / Marktpreis** (umgekehrt proportional)

| Karte | Marktpreis | Rohgewicht (1/Preis) | Normalisiert (Summe=100) |
|-------|-----------|---------------------|------------------------|
| Jinbe | $0.12 | 8.33 | **28.92** |
| Arlong Alt Art | $4.55 | 0.22 | **0.76** |
| Mihawk Manga | $1,084.82 | 0.0009 | **0.003** |

**Logik:** Je teurer die Karte, desto seltener wird sie gezogen — genau wie bei echten Booster-Packs.

#### 2. Coin-Werte

Formel: **Coin-Wert = Marktpreis × 1.10, aufgerundet**

Der 10% Aufschlag stellt sicher, dass die Plattform pro Karte immer etwas über dem Marktwert liegt.

| Karte | Marktpreis | Rechnung | Coin-Wert |
|-------|-----------|----------|-----------|
| Jinbe | $0.12 | ceil(0.12 × 1.10) = ceil(0.132) | **1 Coin** (Minimum) |
| Arlong Alt Art | $4.55 | ceil(4.55 × 1.10) = ceil(5.005) | **6 Coins** |
| Mihawk SP | $174.31 | ceil(174.31 × 1.10) = ceil(191.74) | **192 Coins** |
| Mihawk Manga | $1,084.82 | ceil(1,084.82 × 1.10) = ceil(1,193.30) | **1.194 Coins** |

#### 3. Pack-Preis

Formel: **Pack-Preis = Erwartungswert / (1 - Marge)**

Der **Erwartungswert** ist der gewichtete Durchschnitt aller Coin-Werte — also was ein Pack im Schnitt wert ist.

| Marge | Erwartungswert | Rechnung | Pack-Preis |
|-------|---------------|----------|------------|
| 30% | 18 Coins | 18 / 0.70 | **26 Coins** |
| 50% | 18 Coins | 18 / 0.50 | **36 Coins** |
| 70% | 18 Coins | 18 / 0.30 | **60 Coins** |

**Marge = Anteil des Pack-Preises, der Gewinn ist.** Bei 50% Marge und 36 Coins Pack-Preis: 18 Coins gehen an den User (als Kartenwert), 18 Coins sind Plattform-Gewinn.

### Ablauf

1. **Auto-Berechnung** Button klicken
2. **Marge** auswählen (Quick-Select: 10%, 20%, 30%, 40%, 50%)
3. **"Berechnen"** klicken → Vorschau-Tabelle zeigt alle Änderungen:
   - Jede Karte: altes Gewicht → neues Gewicht, alter Coin-Wert → neuer Coin-Wert
   - Oben: Erwarteter Pack-Wert + vorgeschlagener Pack-Preis
4. **"Übernehmen"** → Alle Werte werden gespeichert, Pack-Preis wird aktualisiert

### Nach der Auto-Berechnung

- Einzelne Gewichte und Coin-Werte können jederzeit manuell nachjustiert werden
- Die Simulation nutzen um zu prüfen ob die Verteilung realistisch ist
- Auto-Berechnung kann jederzeit erneut ausgeführt werden (überschreibt vorherige Werte)

---

## 6. Simulation

Der **Simulation** Button testet die Gewichtungsverteilung virtuell:

1. Anzahl Packs wählen (1–10.000, Quick-Select verfügbar)
2. "Simulation starten" — Ergebnis erscheint sofort

### Ergebnis-KPIs

| KPI | Beschreibung |
|-----|-------------|
| Packs geöffnet | Anzahl simulierter Packs |
| Gesamte Ziehungen | Packs × Karten pro Pack |
| Eingesetzt | Packs × Pack-Preis in Coins |
| Ziehungswert | Summe der Coin-Werte aller gezogenen Karten |
| Gewinn/Verlust | Ziehungswert − Eingesetzt (aus User-Sicht) |
| ROI | Gewinn/Verlust in % des Einsatzes |
| Marge (Plattform) | Eingesetzt − Ziehungswert = Plattform-Gewinn |
| Ø Pack-Wert | Durchschnittlicher Coin-Wert pro Pack |
| Bestes/Schlechtestes Pack | Höchster/niedrigster Pack-Wert |

### Tabs

- **Karten**: Tabelle mit Pulls pro Karte, Draw%, Abweichung von der erwarteten Ziehchance, Wert
- **Raritäten**: Balkendiagramm Erwartet vs. Tatsächlich pro Rarity
- **Wert-Analyse**: Pack-Wert-Verteilung als Histogramm, Wert pro Rarity

**Hinweis:** Karten mit Bestand 0 werden von der Simulation ausgeschlossen.

---

## 7. Verteilungs-Check

Im rechten Sidebar zeigt der **Verteilungs-Check** automatisch Probleme:

| Stufe | Beispiel |
|-------|---------|
| **Fehler** (rot) | Keine Karten, Karten/Pack > Kartenanzahl |
| **Warnung** (gelb) | Eine Karte dominiert >80%, eine Rarity >90% |
| **Tipp** (blau) | Alle Gewichte gleich, Karten mit <0.01% Chance |
| **OK** (grün) | Keine Probleme gefunden |

Fehler blockieren die Veröffentlichung. Warnungen erfordern eine Bestätigung.

---

## 8. Veröffentlichung

### Status-Ablauf

```
Entwurf → Veröffentlicht → Pausiert oder Archiviert
                ↑                |
                └── Reaktiviert ←┘
```

| Aktion | Von → Nach | Bedingung |
|--------|-----------|-----------|
| **Veröffentlichen** | Entwurf → Veröffentlicht | Kein Fehler im Verteilungs-Check |
| **Pausieren** | Veröffentlicht → Pausiert | Jederzeit — Box nicht mehr ziehbar |
| **Reaktivieren** | Pausiert → Veröffentlicht | Kein Fehler im Verteilungs-Check |
| **Archivieren** | Veröffentlicht/Pausiert → Archiviert | Jederzeit — permanent inaktiv |
| **Wiederherstellen** | Archiviert → Entwurf | Jederzeit |

### Löschen

Nur Entwürfe können gelöscht werden.

---

## 9. Box duplizieren

Der **Duplizieren** Button erstellt eine exakte Kopie der Box:

- Alle Karten mit Gewichten, Coins, Bestand und Raritäten
- Pack-Konfiguration und Preis
- Neuer Name wird abgefragt (vorausgefüllt mit "Kopie")
- Die Kopie wird als neuer Entwurf erstellt

---

## 10. Marktpreis-Anzeige

- **Sprache Deutsch**: Marktpreise werden automatisch in Euro umgerechnet (Live-Wechselkurs)
- **Sprache Englisch**: Marktpreise in US-Dollar (Original von TCGPlayer)

Der Wechselkurs wird stündlich aktualisiert.
