# Arena Battle Card Game — Design Spec

## Problem

The current battle system is luck-based: cards are drawn and compared automatically. Players have zero strategic input during a battle — the winner is whoever randomly draws higher-value cards. This makes battles feel passive and unengaging, especially for skilled players who want their decisions to matter.

Additionally, the battle UI is functional but not spectacular. There's no sense of "arena" or competitive atmosphere. Spectators see a count number but have no visual presence or way to interact beyond chat.

## Design

### Core Mechanic: Card Selection (1 out of 5)

Each round, every player receives 5 random cards (drawn from the selected box, using real coin values as battle strength). Players choose 1 card to play — the other 4 are discarded. All players reveal simultaneously. Highest coin value wins the round.

This transforms battles from pure luck to **luck + strategy**: the random draw determines your hand, but your **decision** determines the outcome. When do you play your best card? Do you save it for later? Do you "waste" a low card on a round you expect to lose?

### Card Pool & Economy

- Cards come from the selected box (same as current system)
- Coin value = battle strength (no new attributes, no rarity-based effects)
- Total cards drawn: `totalRounds × 5 × playerCount` (each round, each player gets 5 fresh cards)
- Snake-draft distribution after battle: unchanged
- Claim/Convert decision: unchanged
- Coin economy: unchanged

### Visual Effects by Coin Value

Effects are triggered by coin value, not rarity. Thresholds are configurable in `battle-constants.ts` and could also be calculated relative to the box's average card value.

| Tier | Coin Value | Effects |
|------|-----------|---------|
| Low | $0 – $1 | Simple reveal animation, brief glow, no particles |
| Medium | $1 – $5 | Green glow, light spark particles, spectators react slightly |
| High | $5 – $20 | Purple/gold glow, particle rain, short screen shake, spotlights focus, spectators jump up |
| Extreme | $20+ | Gold explosion, fullscreen flash, massive screen shake, confetti from stands, rotating spotlights, bass-drop sound, spectator wave |

### Timer & Simultaneous Play

- Each round has a 20-second countdown timer for card selection
- All players select simultaneously (no turn order)
- If a player doesn't select before timeout, a random card is played for them
- Once all players have selected (or timer expires), all cards are revealed simultaneously
- SSE broadcasts `player_selected` (without revealing the card) so others know someone has chosen

### Player Count: 2–4 Players

The system supports 2, 3, and 4 players per battle (matching the existing matchmaking queue).

**Arena positions:**
- **2 players:** Left vs Right, cards meet in center with VS label
- **3 players:** Triangle formation, 3 cards in center triangle
- **4 players:** Square formation, 4 cards in 2×2 grid

**Player colors:**
- Player 1: Green (#9BFF00, PA brand)
- Player 2: Red (#ff6b6b)
- Player 3: Blue (#64b5f6)
- Player 4: Gold (#ffd54f)

### Arena Layout: Stadium Side View (PixiJS 8)

The entire battle takes place in a PixiJS canvas rendered as a stadium side view.

**Zones (top to bottom):**

1. **Sky / Background** — Dark gradient with animated spotlight beams
2. **Spectator Stands** — 3 rows of pixel-art avatar sprites with depth effect:
   - Back row: small (16×20px), 0.4 alpha
   - Middle row: medium (22×28px), 0.65 alpha
   - Front row: large (28×36px), 0.9 alpha
3. **Railing** — Glowing separator line (PA green gradient)
4. **Arena Floor** — Dark playing field with subtle radial glow
5. **Player Positions** — Pixel-art avatars with name, score, and player-color border
6. **Battle Center** — Played cards (face-down → face-up), VS label, round counter
7. **Player Hand** — 5 cards at bottom (only visible to the active player), with timer bar
8. **Effects Layer** — Particles, confetti, glow effects
9. **Reaction Layer** — Floating emoji/text bubbles from spectators
10. **Overlay Layer** — Countdown numbers, round announcements, winner badge

**Chat Sidebar (DOM, not Canvas):** The chat remains as a React DOM sidebar (~25% width) next to the canvas (~75% width). Reason: scrollable text lists, text input fields, copy/paste, emoji picker, and moderation features are all dramatically better in DOM. Visually styled to feel like one unit with the canvas.

### PixiJS Scene Tree

```
Application (root)
├── BackgroundLayer — gradient sky, spotlight beams
├── SpectatorStands — Container with avatar sprites
│   ├── BackRow[] — small avatars, 0.4 alpha
│   ├── MiddleRow[] — medium avatars, 0.65 alpha
│   └── FrontRow[] — large avatars, 0.9 alpha
├── Railing — glowing separator
├── ArenaFloor — playing field background
├── PlayerSlots[] — 2-4 player positions
│   ├── AvatarSprite — pixel-art avatar (animated)
│   ├── NameLabel — BitmapText
│   └── ScoreLabel — BitmapText (animated on update)
├── BattleCenter — card comparison zone
│   ├── PlayedCards[] — played cards (face-down → face-up)
│   ├── VSLabel — "VS" text
│   └── RoundLabel — "RUNDE X / Y"
├── PlayerHand — your 5 cards (only for active player)
│   ├── HandCard[0..4] — interactive card sprites
│   └── TimerBar — countdown graphic
├── EffectsLayer — particles, confetti, glow
├── ReactionLayer — floating bubbles
└── OverlayLayer — countdown "3-2-1", announcements
```

### Game Flow (Complete Battle Session)

**Phase 1: Lobby / Waiting**
- Arena visible but dimmed
- Joined players shown with their pixel avatars, empty slots pulse with dashed border
- Spectators can already enter and take seats in the stands
- Ambient background

**Phase 2: Ready Check (30s)**
- Arena lights flicker on when all slots filled
- Each player must confirm "READY"
- Spotlights activate, countdown sound plays
- Non-ready players kicked after 30s and refunded (unchanged)

**Phase 3: Countdown (3-2-1-FIGHT!)**
- Fullscreen countdown numbers with screen shake per number
- Arena lights pulse
- At "FIGHT!" — spotlight explosion, card shuffle animation, bass-drop sound

**Phase 4: Card Draw (Opening)**
- Server draws all cards at once: `totalRounds × 5 × playerCount`
- Cards are distributed into rounds: each round, each player gets 5 random cards
- Player sees brief pack-opening animation, then first 5 hand cards appear face-down and flip one by one

**Phase 5: Clash Rounds (Core Loop)**

Per round:
1. **Round announcement** — "RUNDE X VON Y" zooms in
2. **Hand reveal** — 5 face-down cards appear at bottom, flip to show coin values. Only YOU see your hand.
3. **Card selection (20s timer)** — Player clicks one of 5 cards. Selected card lifts and glows. Timer bar depletes. Timeout = random card.
4. **Waiting animation** — Your chosen card appears face-down in center. "Waiting for opponent..." with pulse. Spectators see all face-down cards gathering in center.
5. **Simultaneous reveal** — All cards flip at once. Coin values shown. Effect intensity based on coin value tier.
6. **Winner reveal** — Highest coin value highlighted. Winner's avatar celebrates (victory pose). Scores update. Close match: extended suspense with spotlight cycling. Draw: tie animation.
7. **Score update + transition** — Scores animate up. Cards fade. Next round starts with new 5 hand cards.

**Phase 6: Result & Podium**
- Camera zooms out after final round
- Confetti explosion
- Placements revealed one by one (3rd, 2nd, 1st)
- Elo changes animate
- Podium view in arena (winner avatar large in center, spotlights)
- Spectators cheer (wave animation)

**Phase 7: Card Decision (Claim / Convert)**
- Snake-draft distribution as before
- Player sees distributed cards, chooses claim or convert
- This phase can leave the arena and show as normal UI (the spectacle is over)

### Pixel-Art Avatar Builder

Accessible from profile page and battles page. Avatar stored as JSON config, PixiJS renders at runtime from sprite sheets.

**Categories:**
- Hair: 8-10 styles + color picker
- Skin tone: 8-10 options
- Eyes: 6-8 styles + color
- Clothing: 10-12 tops + color
- Accessories: hats, glasses, headphones, etc.
- Background: for profile view only (not arena)

**Storage:** `avatarConfig` field on User model:
```typescript
{
  hair: { style: number, color: string },
  skin: string,
  eyes: { style: number, color: string },
  clothing: { style: number, color: string },
  accessory: number | null
}
```

**Rendering:** Layered compositing — each part is a separate small sprite overlaid at runtime. No pre-rendered combinations needed. Pixel-art textures use `scaleMode: 'nearest'` for crisp rendering.

**Sizes:**
- Avatar builder preview: 128×168px
- Arena player: ~48×64px
- Arena spectator (front): ~28×36px
- Arena spectator (back): ~16×20px

### Spectator System

**Seat assignment:** Spectators get a random seat when joining. New spectators "sit down" with animation. On leave, avatar fades out.

**Idle animations:** Gentle bobbing, occasional blinking, random small movements — stands feel alive.

**Automatic crowd events (in response to game events):**
- High-value reveal → spectators jump up
- Close match → crowd leans forward
- Round win → cheer animation + wave
- Unexpected victory → spectators jump + confetti

**Manual reactions:** Spectators can send preset emoji reactions (🔥 😱 💪 😂 👏 💀 🎉 😤) that appear as floating bubbles above their avatar sprite in the arena. Rate-limited: 2s cooldown.

**Chat:** Preset quick messages + free text in the DOM sidebar. Preset reactions trigger both a chat message AND an arena bubble.

### Technical Architecture

#### Server-Side Changes

**Mostly unchanged.** The existing SSE infrastructure (Redis Pub/Sub), battle engine, Elo system, matchmaking queue, and API structure remain.

**Orchestrator changes (`battle-orchestrator.ts`):**
The orchestrator must switch from sequential (sleep-based) to event-based (waiting for player input) during the clash phase:

1. Draw cards for all players (5 per player from the pool)
2. SSE: `hand_dealt` to each player (only own cards visible)
3. Start timer (20s) via Redis key with TTL
4. Wait for `select-card` from all players (or timeout)
5. On timeout → random card for tardy players
6. SSE: `cards_reveal` to all (all chosen cards + values)
7. Calculate winner (highest coinValue)
8. SSE: `round_result` to all
9. Pause for animations → next round

**Waiting pattern:** Player selections written to Redis hash `battle:{id}:round:{n}:selections`. Orchestrator subscribes to Redis keyspace notifications or polls with short interval. BullMQ delayed job as timeout fallback.

**New SSE events:**
- `hand_dealt` — player-specific, contains the 5 card options for the current round
- `player_selected` — broadcast, indicates a player has chosen (no card details)
- `cards_reveal` — broadcast, contains all chosen cards with coin values
- `spectator_joined` — broadcast, contains avatar config of new spectator

**New API endpoints:**
- `POST /api/battles/[id]/select-card` — body: `{ roundIndex, cardIndex }`. Server validates ownership, round state, timer.
- `POST /api/battles/[id]/reaction` — body: `{ emoji }`. Rate-limited. Broadcast via SSE.
- `GET/PUT /api/profile/avatar-config` — load/save avatar configuration

#### Client-Side Architecture

**PixiJS 8.17.x integration with Next.js 16 / React 19:**

**SSR protection:** All PixiJS imports behind a single boundary:
```typescript
// components/arena/arena-canvas.tsx
"use client";
import dynamic from "next/dynamic";
const ArenaPixi = dynamic(() => import("./arena-pixi"), { ssr: false });
```

**Code splitting:** PixiJS (~200KB gzipped) only loaded on battle pages via dynamic import.

**BattleBridge:** Central module that translates SSE events into PixiJS scene actions:
- `round_announce` → round title zoom, deal new hand cards
- `hand_dealt` → show 5 cards at bottom, flip to reveal
- `player_selected` → place face-down card in center
- `cards_reveal` → flip all cards, show values, trigger effects
- `round_result` → highlight winner, animate scores, crowd reaction
- `battle_end` → podium scene, confetti, Elo animations
- `chat` / `reaction` → spawn bubble over spectator avatar
- `spectator_joined` → place avatar on empty seat

**Responsive canvas:** Fixed 16:9 aspect ratio, scales with container div. All PixiJS positions in relative units (% of canvas size), not absolute pixels.

**Cleanup:** On navigation away: `Application.destroy()`, release all textures, close EventSource. Prevents memory leaks.

**Tweening:** PixiJS 8 has no built-in tween system. Use ticker-based interpolation with easing functions (custom utility, no external dependency needed).

#### Database Changes

**User model — new field:**
```typescript
avatarConfig: {
  hair: { style: Number, color: String },
  skin: String,
  eyes: { style: Number, color: String },
  clothing: { style: Number, color: String },
  accessory: Number
}
```

**Battle model — rounds[] extended:**
```typescript
rounds: [{
  roundIndex: Number,
  hands: [{
    player: ObjectId,
    dealtCards: [{ card: ObjectId, coinValue: Number }],  // the 5 options
    selectedIndex: Number  // which card was chosen (0-4)
  }],
  playedCards: [{ player: ObjectId, card: ObjectId, coinValue: Number }],
  winnerId: ObjectId | null,
  revealedAt: Date
}]
```

**Battle model — new sub-status:**
Add `"selecting"` to the status flow during clash phase to prevent race conditions. The status progression becomes: `waiting → ready_check → countdown → opening → clash (with selecting sub-rounds) → finished`.

### Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| PixiJS + Next.js SSR crashes (`window` not defined) | HIGH | Single entry point behind `dynamic({ ssr: false })`. ESLint rule to prevent direct pixi imports outside arena folder. |
| Orchestrator rebuild complexity (sequential → event-based) | HIGH | Redis-based waiting pattern. Player selections in Redis hash, orchestrator subscribes. BullMQ delayed job as timeout fallback. |
| WebGL memory leaks | MEDIUM | Strict cleanup in useEffect return. Asset manager with reference counting. Smoke test after 10x navigation cycles. |
| Pixel-art asset creation | MEDIUM | Layered compositing (not full sprite sheets). Each part is a small separate sprite. Can be AI-generated. |
| Mobile performance | MEDIUM | Performance tier system: low devices get fewer particles, fewer spectator animations. GPU detection on first load. |
| Cheating / card manipulation | LOW | Hand cards sent only to respective player via SSE. Selection validation fully server-side. Client never has access to opponent hand cards. |

### What Stays Unchanged

- Elo system & ranks
- Matchmaking queue (2-4 players)
- Snake-draft distribution
- Claim / Convert decision
- Coin economy (entry cost, refunds, conversion)
- Battle achievements
- Ready-check system
- SSE infrastructure (Redis Pub/Sub)
- Battle creation & joining flow

### Implementation Phases

| Phase | Scope | Est. Sessions |
|-------|-------|--------------|
| 1. Card Selection Mechanic (Backend) | Orchestrator rebuild, select-card endpoint, new SSE events, hand dealing, timer logic | 3-5 |
| 2. PixiJS Foundation | PixiJS setup, dynamic import, ArenaCanvas wrapper, stadium background, BattleBridge, cleanup | 3-4 |
| 3. Arena Gameplay in PixiJS | Card hand UI in canvas, reveal animations, score display, countdown, podium scene, coin-value effects | 5-7 |
| 4. Avatar System | Pixel-art sprites, avatar builder UI, storage, rendering in arena + spectator stands, idle animations | 3-4 |
| 5. Spectators & Reactions | Individual spectator tracking, stand filling, reactions, crowd events, chat integration | 2-3 |
| 6. Polish & Mobile | Performance optimization, mobile adjustments, sound effects, edge cases, user testing | 2-3 |
| **Total** | | **18-26** |

Each phase is independently deployable. Phase 1 alone makes the battle system significantly better even without PixiJS.

### Verification

- **Phase 1:** Create a battle with 2 players, verify hand dealing, card selection, timer timeout, round results via existing UI or API calls
- **Phase 2:** Navigate to a battle page, verify PixiJS canvas renders without SSR crash, verify cleanup on navigation away (no memory leak)
- **Phase 3:** Play a full battle in the arena, verify all phases render correctly, effects trigger at correct coin-value thresholds
- **Phase 4:** Create an avatar in the builder, verify it appears in the arena as player and as spectator
- **Phase 5:** Join as spectator, send reactions, verify bubbles appear in arena, verify crowd events trigger
- **Phase 6:** Test on mobile devices, verify performance tier detection works, test edge cases (disconnect mid-selection, 3-player with 1 timeout, etc.)
