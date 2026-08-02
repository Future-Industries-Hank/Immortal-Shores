# BUILD-CONTEXT — Immortal Shores

| Field | Value |
|---|---|
| **Title** | Immortal Shores |
| **Slug** | immortal-shores |
| **Track** | browser-3d / isometric (Babylon orthographic preferred) |
| **Path** | full-AI (director supplies GDD; agent does not re-interview) |
| **visualTier** | 3 · Production |
| **visualReference** | High-end isometric historical city/empire builders; warm Anno-like production readability; polished browser strategy (river/province map clarity) |
| **visualAntiReference** | Flat unlit graybox; generic purple sci-fi UI; free-roam Skylines-style as primary camera fantasy; asset-flip low-poly desert packs |
| **visualThesis** | Eternal river civilization — sun-baked mudbrick, pale stone, green reeds, deep blue water, soft gold on prestige; calm heat haze; living workers and barges |
| **worstCase** | Level 15+ settlement fully built, max animated workers, barges on river, day→dusk, UI panels open, world map with many province markers |
| **transitionMoments** | Menu→settlement; settlement↔world map; place/upgrade building; barge depart/arrive; Worker assign; Tablet Wall open; province blessing proc; monument capture result; Ascension sequence |
| **Core verb** | Allocate Workers (so fields feed workshops and trade fills luxury gaps) |
| **Complete loop** | Login → offline production applied → rebalance Workers → trade or barge action → queue construction → leave; state correct on return |
| **Social model** | Persistent async multiplayer; server ticks; Tablet Wall / Market / barges; **trust-based trade (no escrow)**; visit = postcard or read-only settlement |
| **Not** | Live co-building MMO rooms / Colyseus shared city instances |

## Agent phases

1. **Prompt 01** (`prompts/PROMPT-01-PLAYABLE.md`) — playable core — **DONE** (`9f0479d`)  
2. **Prompt 01.5** (`prompts/PROMPT-01.5-MODERN-2026.md`) — 2026 modernization / trust trade / QoL  
3. **Prompt 02** (`prompts/PROMPT-02-VISUAL.md`) — visual gauntlet; judge PASS required  

See `docs/MODERN-2026.md` and `docs/REV1-REVIEW.md`.

## V1 vertical slice (must ship first in Prompt 01)

1. One settlement isometric view with starter buildings and Workers.
2. Server-authoritative production tick (+ offline catch-up).
3. Worker assign/unassign; Ration upkeep; shortage penalty.
4. Great House capacity + growth +3/h.
5. At least one luxury specialty + one luxury good recipe.
6. Market or Tablet Wall structured offer + mail/escrow settle.
7. Chat channel (Trade or General).
8. World map stub: river curve, player city marker, one empty site, one monument ground.
9. Postcard snapshot of settlement for gallery/visit.
10. Quality tiers + dual input + 60 fps mid scene.

## Stretch toward full GDD (ordered)

Harbor/barges → military/monuments → shrines/blessings → multi-settlement founding → Envoys → prestige/Ascension → Seal store cosmetics.
