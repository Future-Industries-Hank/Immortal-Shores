# STYLE-CONTRACT — Immortal Shores

## Thesis

**“A living shore on the eternal river — hospitable enough to farm, hard enough to need neighbors.”**  
Sun and dust, green against sand, deep water as the spine of empire. Prestige is gold leaf and pale stone, never neon.

## Camera & projection

- **Isometric orthographic** (or fixed isometric perspective with negligible FOV distortion).
- Settlement view: readable plots, building silhouettes unique at a glance.
- World map: long **curved river**, province bands, icons for cities / founding sites / monuments / ancestral markers.
- No free-fly FPS camera as default.

## Palette (locked tokens)

| Token | Role | Hex (starting lock — refine in-engine, keep family) |
|---|---|---|
| `--sand-light` | Ground, paths | `#E8D4B0` |
| `--sand-deep` | Shadows on earth | `#C4A574` |
| `--mudbrick` | Common buildings | `#C9956C` |
| `--stone-pale` | Higher tiers, monuments | `#E5E0D4` |
| `--reed-green` | Fields, marsh | `#5F8F4E` |
| `--field-green` | Emmer | `#7FA85A` |
| `--river-deep` | Water body | `#1E4D6B` |
| `--river-light` | Highlights, shallows | `#3A7CA5` |
| `--gold-soft` | Prestige accents | `#D4A84B` |
| `--ink-ui` | Text | `#2A2118` |
| `--papyrus` | UI panels | `#F3E6C8` |
| `--seal-accent` | Sacred Seals / premium | `#8B3A4A` |

Materials must remain distinguishable in grayscale (mudbrick matte vs stone slightly cooler/smoother vs water specular).

## Light

- One primary sun, warm; soft fill from sky (slightly cool blue).
- Day/dusk/night cycle continuous; night emissives on Great House and workshops (subtle).
- Contact shadows under buildings and Workers mandatory.

## Motion

- Workers: short walk cycles, staggered phases (never lockstep).
- Workshops: subtle loop (smoke, wheel, kiln glow).
- Barges: slow river motion; dock bob.
- UI: eased transitions; no linear snaps; interruptible panels.

## UI / HUD

- Clean functional **papyrus + ink** chrome; river-teal accents sparingly.
- Always-visible: key resources (Emmer, Clay, Reeds, Rations, Mudbricks, Seals) + production timers on focus.
- Nav icons: **Harbor · Private Tablets · Allies · Tablet Wall** (+ World Map, Settlement).
- Tooltips on everything economic.
- Trade cards on Tablet Wall: structured, readable shorthand, deep-link to offer id.
- Mobile: large touch targets; portrait-friendly stack; resource strip collapsible.

## Audio character

- Soft organic: clay taps, reed rustle, water lap, market murmur bed.
- Pitch-up for gains/rewards; pitch-down for shortage/desertion.
- Synthesize SFX first (FI audio doctrine).

## Forbidden

- Sci-fi HUD, pure black glassmorphism, Comic Sans / default system UI sprawl.
- Rainbow particle spam.
- Marketplace asset mash of mismatched cultures.
