# Pack Opening Animation — Design Spec

## Context

The current pack opening experience is purely functional: user clicks "Open Pack", sees a `?` box, taps to reveal each card's image/name/value, then decides claim/convert/skip. There are zero animations, no 3D effects, no rarity-based visual differentiation, and no sound feedback. This makes the experience feel flat and unexciting despite the inherently thrilling nature of pack openings.

**Goal:** Transform the pack opening into a cinematic, gamified experience with a 3D animated pack, physical "rip open" interaction, per-card 3D flip reveals, and coin-value-based effect tiers that make high-value pulls feel truly special.

## Design Overview

### Animation Style: Full 3D Pack

- 3D-perspektivisches Boosterpack mit CSS perspective + Framer Motion transforms
- Mouse/touch tracking for real-time parallax tilt
- Holographic shimmer effect on pack surface
- No Three.js required — CSS-based 3D is sufficient

### Interaction: Swipe Up to Rip Open

- User swipes upward (or drags upward with mouse) to tear the pack
- Progress-based ripping (0-100%) with visual feedback
- Auto-completes at 70% threshold with dramatic finish
- Mobile: also supports touch swipe gesture

### Card Reveal: Individual 3D Flip

- Cards appear one at a time, back side first
- Tap/click triggers a 3D rotateY(180deg) flip with spring physics
- After flip: Claim (cart) / Convert (coins) / Skip buttons appear
- Progress bar at top shows "Card 3/5"

### Quick Open: Skip Option

- "Quick Open" button available alongside "Open Pack (Animation)"
- Skips all animation, goes directly to review phase
- For power users who want speed over spectacle

## Phase 1 — Pack Idle

**Visual:**
- 3D pack floats with subtle up/down bobbing animation (CSS translateY keyframes)
- Pack follows mouse/touch position via perspective rotateX/rotateY transforms
- Holographic shimmer overlay shifts with mouse movement (CSS gradient animation)
- Pack has a tear line (dashed green border) indicating where it will rip
- "Swipe to Open" indicator with animated arrow below pack

**Technical:**
- `motion.div` with `onMouseMove` handler calculating rotateX/Y from pointer position
- CSS `perspective(800px)` on parent container
- Holographic overlay: CSS gradient with `background-position` animated via Framer Motion `useMotionValue`
- Floating animation: Framer Motion `animate` with `repeat: Infinity`, `repeatType: "reverse"`

**Sound:**
- Subtle ambient shimmer sound (low volume, looping)

## Phase 2 — Ripping

**Visual:**
1. User begins upward swipe — pack's top portion starts separating from bottom
2. Green tear line glows brighter proportional to swipe progress (0-70%)
3. Light beam shoots from the tear as it opens
4. At 70%: auto-complete triggers
5. Top half flies upward and fades out with rotation
6. Particle explosion from the tear line (color = highest rarity in pack — subtle Easter egg)
7. Cards become visible in the lower pack portion

**Technical:**
- Swipe detection: Framer Motion `onPan` / `onPanEnd` gesture handlers
- Progress tracking: `useMotionValue` for swipe distance → progress percentage
- Pack split: Two `motion.div` elements (top/bottom) with animated `y` and `rotateX`
- Auto-complete: When `progress >= 0.7`, trigger completion animation sequence
- Particle system: `<canvas>` overlay with custom particle engine (see Particle System section)
- Particle color: Determined client-side from returned `cards` array — find max `coinValue`, map to tier color

**Sound:**
- Paper ripping sound (crescendo matching swipe progress)
- Whoosh + explosion burst on auto-complete

**Haptics:**
- `navigator.vibrate([50, 30, 100])` on mobile at auto-complete threshold

## Phase 3 — Card Reveal

**Visual:**
- Card enters from bottom with spring animation
- Shows card back (Pack Attack branded design with `?` symbol)
- On tap/click: 3D flip to front with `rotateY(180deg)`
- Card front shows: image, name, rarity badge, coin value
- After flip: action buttons slide in from bottom

**Technical:**
- Card container: `motion.div` with `rotateY` animated from 0 to 180deg
- Two-sided card: front/back use `backface-visibility: hidden`
- Front side has `rotateY(180deg)` as base transform (so it shows correctly when container flips)
- Spring physics: `type: "spring", stiffness: 300, damping: 20`
- Tap handler: `onClick` toggles `isFlipped` state
- Action buttons: `motion.div` with `initial={{ y: 20, opacity: 0 }}` → `animate={{ y: 0, opacity: 1 }}`

**Sound:**
- Card whoosh on enter
- Card flip sound on tap
- Tier-specific sounds play during flip (see Effect Tiers)

## Phase 4 — Effect Tiers

Effect tier is determined by the card's `coinValue` (integer). Thresholds are per-box configurable, with these defaults:

### Tier 1: Normal (0-49 Coins)
- Simple 3D flip, no extra effects
- Standard flip sound
- No glow, no particles

### Tier 2: Good (50-199 Coins)
- Green glow border on card (`box-shadow: 0 0 15px rgba(155,255,0,0.3)`)
- Small sparkle particles around card (6-8 particles, green)
- Shimmer sound effect
- Card border pulses green briefly after flip

### Tier 3: Epic (200-499 Coins)
- **Slowdown before flip:** Card hesitates mid-flip (~200ms pause at 45deg) building suspense
- Golden glow border (`box-shadow: 0 0 25px rgba(255,215,0,0.3)`)
- Golden particle burst on flip completion (15-20 particles)
- Card pulses with golden light
- Dramatic reveal sound with rising tone

### Tier 4: Legendary (500+ Coins)
- **Slowmo flip:** Entire flip takes 1.5x longer, with slowdown at 90deg
- **Screen shake:** CSS transform on body/container with rapid small translations (100ms)
- **Rainbow animated border:** `hue-rotate` animation on gradient border
- **Particle explosion:** 30+ particles in rainbow colors shooting outward
- **Holographic shimmer:** Moving gradient overlay on card surface
- **Confetti rain:** Gold confetti particles falling from top of screen (2-3 seconds)
- **Epic fanfare sound:** Dramatic reveal with chord progression

## Particle System Design

Custom Canvas 2D particle engine (no external dependency):

```
ParticleEngine {
  canvas: HTMLCanvasElement
  particles: Particle[]

  emit(config: {
    x, y: number           // origin point
    count: number           // particle count
    colors: string[]        // color palette
    speed: [min, max]       // velocity range
    size: [min, max]        // particle size range
    lifetime: [min, max]    // ms before fade
    gravity: number         // downward pull
    spread: number          // emission angle spread (radians)
    shape: 'circle' | 'star' | 'square'
  })

  update(dt: number)        // physics step
  render(ctx: CanvasRenderingContext2D)

  // Uses requestAnimationFrame loop
  // Auto-cleans dead particles
  // Stops loop when no active particles
}
```

**Tier color palettes:**
- Good: `['#9BFF00', '#7ACC00', '#B8FF4D']`
- Epic: `['#FFD700', '#FFA500', '#FFEC8B', '#FFD700']`
- Legendary: `['#ff6b6b', '#FFD700', '#9BFF00', '#6bc5ff', '#c06bff', '#ff6b6b']`

## Sound Design

Sound assets needed (MP3, ~2-5KB each):
- `pack-shimmer.mp3` — ambient idle loop
- `pack-rip.mp3` — paper tearing (progressive)
- `pack-burst.mp3` — explosion on rip complete
- `card-whoosh.mp3` — card entering screen
- `card-flip.mp3` — basic flip
- `card-shimmer.mp3` — tier 2 reveal
- `card-epic.mp3` — tier 3 dramatic reveal
- `card-legendary.mp3` — tier 4 fanfare
- `confetti.mp3` — confetti rain ambient

Implementation: Use `Audio()` API (existing pattern from `coin-chest-animation.tsx`). Preload all sounds on component mount. Volume levels per tier (Normal: 0.3, Good: 0.5, Epic: 0.7, Legendary: 1.0).

## Component Architecture

```
components/packs/
  pack-opening.tsx          — Main orchestrator (MODIFY existing)
  pack-3d.tsx               — 3D pack with mouse tracking + idle animation
  pack-ripper.tsx           — Swipe-to-rip interaction + rip animation
  card-flipper.tsx          — Single card 3D flip with tier effects
  particle-canvas.tsx       — Canvas-based particle system React wrapper
  use-pack-sounds.ts        — Sound preloading + playback hook
  effect-tiers.ts           — Tier config: thresholds, colors, particle configs
```

**Existing files to modify:**
- `components/packs/pack-opening.tsx` — Add animation phase orchestration, integrate new sub-components
- `models/box.ts` — Add optional `effectTierThresholds` field (array of 3 numbers for tier boundaries)
- `app/globals.css` — Add keyframes for screen-shake, holographic shimmer, confetti

**New dependency:**
- `motion` (motion.dev, formerly framer-motion) — Latest version, tree-shakeable, ~30KB gzipped

## Data Flow

1. User clicks "Open Pack (Animation)" → existing API call `POST /api/packs/[id]/open`
2. API returns `{ packGroupId, cards: DrawnCard[] }` — unchanged
3. `pack-opening.tsx` receives cards, determines max coinValue → sets particle explosion color
4. Phase 1 (Idle) renders while API loads (optimistic: show pack immediately)
5. Phase 2 (Rip) starts when user swipes — on complete, first card enters Phase 3
6. Phase 3 repeats for each card, with tier determined from `card.coinValue`
7. After last card → existing review phase (unchanged)

**Tier determination:**
```typescript
function getEffectTier(coinValue: number, thresholds = [50, 200, 500]): 1 | 2 | 3 | 4 {
  if (coinValue >= thresholds[2]) return 4  // Legendary
  if (coinValue >= thresholds[1]) return 3  // Epic
  if (coinValue >= thresholds[0]) return 2  // Good
  return 1                                   // Normal
}
```

## Mobile Considerations

- All interactions work with touch (swipe, tap)
- Pack tilt uses touch position (not gyroscope — battery drain concern)
- Particle count reduced on mobile: 60% of desktop values
- Canvas resolution scaled with `devicePixelRatio` for crisp rendering on retina
- `will-change: transform` on animated elements for GPU acceleration
- Vibration API for haptic feedback on rip completion

## Accessibility

- `prefers-reduced-motion`: Skip all animations, go directly to card display
- Screen reader: aria-labels on pack ("Booster pack, swipe up to open"), cards ("Card 3 of 5, tap to reveal")
- Keyboard: Enter/Space to open pack, arrow keys to navigate cards, Enter to flip

## Verification Plan

1. Install `framer-motion`, verify build passes
2. Implement Pack3D component — test mouse tracking in browser
3. Implement PackRipper — test swipe gesture on desktop + mobile
4. Implement CardFlipper — test 3D flip with all 4 tiers
5. Implement ParticleCanvas — test particle emission + cleanup
6. Wire into existing pack-opening.tsx — test full flow
7. Test Quick Open bypass
8. Test recovery mode (interrupted session)
9. Test multi-pack (open 5 packs = 25 cards sequential reveal)
10. Test `prefers-reduced-motion` media query
11. Run typecheck (`tsc --noEmit`) + lint (`next lint --fix`)
12. Test on mobile device/emulator
