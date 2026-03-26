# Pack Detail Page Redesign — Design Spec

## Context

Die aktuelle Pack-Detail-Seite ist funktional aber flach — kein Gamification, kein Social Proof, keine Kartenvorschau. Ziel: Pack-Opening als klares Zentrum, umgeben von Elementen die zum Öffnen motivieren.

---

## Layout: Hero + 3 Kacheln + Kartenpool

### Hero-Bereich (oben, dominant)

3-Spalten-Layout innerhalb einer großen Card:

**Links:** Box-Bild (160×210px, gerundet)

**Mitte (Hauptfokus):**
- Box-Name (22px, bold) + Social Proof Badge ("🔥 247 geöffnet")
- Spielname darunter
- Pack-Selector (1/2/3/5/10) als Buttons
- **Großer CTA:** "🎴 Pack öffnen — 36 Coins" mit Glow-Shadow
- Coin-Balance daneben
- Info-Zeile: Karten/Pack · verfügbar · Umwandlungsrate

**Rechts (260px):**
- **Beschreibung** in eigener Kachel (bg-surface, scrollbar bei langen Texten, max-height mit "mehr anzeigen" wenn >4 Zeilen)
- **Raritäten-Verteilung** mit farbigen Progress-Bars + Prozent pro Rarity
  - Farben nach Seltenheit: Blau (Common/Rare), Orange (Alt Art), Rot (Secret/SP)

**Mobile:** Stacked — Bild oben, CTA darunter, Beschreibung + Rarities unter dem CTA

---

### 3 Kacheln (nebeneinander, unter Hero)

#### 1. 🏆 Top Hits
- Die 3 wertvollsten Karten der Box (sortiert nach coinValue absteigend)
- Pro Karte: Thumbnail, Name, Rarity-Badge, Coin-Wert, Ziehchance in %
- #1 hat grüne Akzent-Border
- **Klick → Lightbox** mit Kartendetails

#### 2. Live Events (SSE)
- Echtzeit-Feed via Server-Sent Events + Redis Pub/Sub
- Roter Pulse-Dot als "Live"-Indikator
- Seltene Pulls hervorgehoben (grüne Seitenleiste, Coin-Wert angezeigt)
- Username klickbar → User-Profil (wenn public)
- Letzte 10 Events, neue slide von oben rein

#### 3. Meine letzten Pulls
- Letzte 5 Pulls des eingeloggten Users in dieser Box
- Kartenbild, Name, Rarity, Status-Badge (Geclaimed grün / +X Coins blau)
- "Alle anzeigen →" Link zur Inventar-Seite

**Mobile:** 3 Kacheln stacked vertikal

---

### Kartenpool (volle Breite, unter den Kacheln)

- Responsive Grid (6 Spalten Desktop, 3 Mobile)
- Pro Karte: Bild, Name, Ziehchance in %
- Chance-Farbe: Grün für häufig (>5%), Orange für selten (<1%), Rot für ultra-selten (<0.1%)
- **Klick → Lightbox**

---

### Karten-Lightbox

Modal (size lg) bei Klick auf eine Karte (Top Hits oder Kartenpool):
- Großes Kartenbild links
- Rechts: Name, Set, Rarity-Badge
- Stat-Boxen: Coin-Wert, Ziehchance, Marktpreis
- Set-Info

---

## SSE Live Events — Technischer Aufbau

### Redis Pub/Sub
- Channel: `box-events:{boxId}`
- Bei jedem Pack-Opening: Publish Event `{ userId, userName, cardName, rarity, coinValue, timestamp }`
- Im Open-Endpoint nach erfolgreicher Ziehung: `redis.publish(channel, JSON.stringify(event))`

### SSE Endpoint
- Route: `GET /api/packs/[id]/events` (text/event-stream)
- Subscribes to Redis channel for the box
- Streamt Events als SSE an den Client
- Client: `EventSource` in React-Komponente, neue Events prepend mit Fade-In

### Fallback
- Wenn SSE-Verbindung abbricht: Auto-Reconnect (EventSource macht das nativ)
- Initiale Events beim Laden: API gibt letzte 10 Events zurück

---

## Neue/Geänderte Dateien

### Neue Dateien
- `components/packs/pack-hero.tsx` — Hero-Bereich mit CTA
- `components/packs/top-hits.tsx` — Top 3 Kachel
- `components/packs/live-events.tsx` — SSE Live-Feed
- `components/packs/my-pulls.tsx` — Letzte Pulls des Users
- `components/packs/card-pool.tsx` — Kartenpool-Grid
- `components/packs/card-lightbox.tsx` — Karten-Detail-Modal
- `app/api/packs/[id]/events/route.ts` — SSE Endpoint

### Zu ändern
- `app/[lang]/(dashboard)/packs/[id]/page.tsx` — Komplettes Redesign mit neuen Komponenten
- `app/api/packs/[id]/route.ts` — Cards-Details für Kartenpool + Top Hits zurückgeben
- `app/api/packs/[id]/open/route.ts` — Redis Pub/Sub Event publishen
- `app/api/pulls/route.ts` — Filter nach boxId für "Meine Pulls"

---

## Verifikation

1. Hero-Bereich zeigt Box-Info, Pack-Selector, CTA mit Glow
2. Beschreibung rechts, scrollbar bei langem Text
3. Raritäten-Verteilung mit farbigen Balken
4. Top 3 Hits mit Coin-Wert und Chance
5. Klick auf Karte → Lightbox mit Details
6. Live Events aktualisiert sich in Echtzeit (SSE)
7. Seltene Pulls hervorgehoben im Feed
8. Username klickbar → Profil
9. Meine Pulls zeigt letzte 5 mit Status
10. Kartenpool-Grid mit allen Karten + Chance
11. Mobile: alles stacked, keine Überlappung
