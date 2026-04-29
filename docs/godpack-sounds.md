# Godpack — Audio-Cues

Die Cosmic-Intro stapelt mehrere Sound-Layer für maximalen Wow-Effekt. Vier dedizierte Slots sind in `components/packs/use-pack-sounds.ts` reserviert; die mp3-Files liegen unter `public/sounds/`. Falls einer ausfällt, fallen die Cues weich auf die existing Keys (`epic`, `burst`, `legendary`, `rain`, `shimmer`, `chime`) zurück.

## Aktuell installierte Files (Mixkit, Free SFX License)

Heruntergeladen via direkter CDN-URL `https://assets.mixkit.co/active_storage/sfx/{id}/{id}-preview.mp3`:

| Slot | Mixkit-ID | Tags |
|---|---|---|
| `godpackBuildup` | 488 | Movie · Cinematic · Drum · Heartbeat |
| `godpackBoom` | 788 | Cinematic · Impact · Hit |
| `godpackFanfare` | 2290 | Brass · Orchestra · Cinematic · Transition |
| `godpackSparkle` | 869 | Fairy · Sparkle · Magic |

Alle vier fallen unter die [Mixkit Free SFX License](https://mixkit.co/license/#sfxFree): freie Nutzung in Web-Projekten und kommerziellen Apps, kein Credit Pflicht, Resale verboten. Falls du einen Slot lieber durch ein eigenes Sample ersetzen willst — Filename behalten, einfach überschreiben.

## Slots & Charakter

| Slot | Datei | Dauer | Charakter | Triggert bei |
|---|---|---|---|---|
| `godpackBuildup` | `public/sounds/godpack-buildup.mp3` | ~0.9 s | Tiefer Sub-Bass-Drone, „Inception-BWAAAH", langsamer Crescendo | Phase A — Tension (t=0) |
| `godpackBoom` | `public/sounds/godpack-boom.mp3` | ~0.5 s | Cinematic Boom-Hit + Brass-Stab, kein Reverb-Tail mehr als 800 ms | Phase B — BOOM (t=700 ms) |
| `godpackFanfare` | `public/sounds/godpack-fanfare.mp3` | ~1.5 s | Triumphierende Brass-Fanfare (Trailer-Style), nicht zu poppig | Phase C — Confetti-Wave 1 (t=1500 ms) |
| `godpackSparkle` | `public/sounds/godpack-sparkle.mp3` | ~1.0 s | Glitzer/Magic-Sparkle-Cascade, hohe Frequenzen, kein Bass | Phase C — Confetti-Wave 2 (t=2400 ms) |

## Empfohlene Free-Quellen

Alle CC0 / Royalty-Free, mp3-Export möglich:

- **[Pixabay Music & Sound Effects](https://pixabay.com/sound-effects/)**
  - Suchbegriffe: `cinematic boom`, `epic riser`, `trailer hit`, `brass fanfare`, `magic sparkle`, `victory`
  - Lizenz: Pixabay Content License — frei nutzbar, kein Credit nötig
- **[Mixkit Free SFX](https://mixkit.co/free-sound-effects/)**
  - Categories: „Cinematic", „Game", „Magic"
  - Lizenz: Mixkit License — frei nutzbar
- **[Freesound](https://freesound.org/)**
  - CC0 / CC-BY filter setzen
  - Mehr Vielfalt, dafür uneinheitliche Qualität — vor dem Mastering kurz normalisieren
- **[Zapsplat](https://www.zapsplat.com/)**
  - Account erforderlich (gratis), kostenlose Lizenz für Indie-Projekte mit Credit

## Konkrete Vorschläge

### `godpackBuildup`
Zentraler Effekt: tiefer Drone der unter 800 ms in einen ramp-up übergeht.

- Pixabay → „cinematic riser deep" oder „epic tension drone"
- Mixkit → „Tense cinematic riser" (zappable auf 0.9 s)
- Falls zu lang: in Audacity die ersten 0.9 s croppen, mit Fade-out 200 ms ausklingen lassen

### `godpackBoom`
Punch + Brass-Akzent. Soll IN den Camera-Shake reinknallen (auf 720 ms).

- Pixabay → „cinematic boom impact" oder „trailer hit boom"
- Mixkit → „Cinematic suspense impact"
- Alternativen: Layer aus „deep sub kick" + „brass stab" + „white noise burst" mischen

### `godpackFanfare`
Der „YES!"-Moment. Brass-Trompeten in Major-Tonart, nicht zu Disney-haft.

- Pixabay → „cinematic brass fanfare", „trailer brass announcement"
- Mixkit → „Achievement Bell" passt nicht — eher „Cinematic intro"
- Lieber zu kurz als zu lang — 1.5 s reicht, danach soll der Sparkle übernehmen

### `godpackSparkle`
Hochfrequenter Glitzer-Schauer für die zweite Confetti-Welle.

- Pixabay → „magic sparkle cascade", „shimmer twinkle"
- Mixkit → „Game level up"
- Wichtig: niedriger Bass, sonst frisst er den Fanfare-Tail

## Mastering-Tipps

- **Loudness**: alle vier Files auf etwa **-14 LUFS integrated** normalisieren, damit sie sich nicht gegenseitig totstampfen.
- **Peak**: max. **-1 dBTP**, sonst clippen die Web-Audio-Engines auf manchen Endgeräten.
- **Fade-out**: jedes File mit ~50 ms Fade-out exportieren, sonst klickt es beim Cleanup.
- **mp3 vs. ogg**: mp3 reicht — alle Browser supporten es. ogg gibt 10–15 % kleinere Files, wenn dir Bandbreite wichtig ist (Audio-Tag würde dann beide Quellen nehmen, aber das ist ein größerer Umbau im Audio-Wrapper).

## Test im Browser

1. File ablegen unter `public/sounds/godpack-<name>.mp3`
2. Server hat Hot-Reload — keine Restart-Aktion nötig
3. Counter forced: `db.godpackcounters.updateOne({}, { $set: { totalPacksOpened: 100, nextTriggerAt: 101 } })`
4. Pack öffnen, Lautsprecher hörbar an

Wenn ein Sound zu laut/leise wirkt: in `godpack-intro.tsx` die Volume-Werte (zweites Argument bei `cue(...)`) feinjustieren. Die Master-Volume des Users skaliert das Ganze.
