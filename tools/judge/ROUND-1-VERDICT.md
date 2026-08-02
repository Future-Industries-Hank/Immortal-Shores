# ROUND-1 VERDICT — Immortal Shores (Prompt 02 visual)

**Judge role:** Impartial visual judge (not builder).  
**Comparables:** Anno 1800/2205 production readability · high-end isometric historical empire · polished browser strategy.  
**Evidence pack:** `tools/judge/evidence/` — priority `r1d-no-fog.png`, `r1d-night.png`, `r1d-map.png`, `r1d-mobile.png`, `FPS-NOTE.md`; priors `r1b`/`r1c`/`r1-*` for fog regression context.  
**Code skim (read-only):** `atmosphere.ts`, `buildings.ts`, `padMarkers.ts`, `scene.ts`, thin UI bars / map popup, shared rates untouched for this client-only visual track.  
**Art honesty:** Presentation is a **good procedural primitive kit** (boxes/cylinders/capsules), not AAA glTF. Categories that meet the bar on readability/presentation still PASS; FAIL only on real bar misses.

---

## Binary table (C1–C12)

| ID | Category | Verdict | Located notes |
|----|----------|---------|---------------|
| C1 | Spatial readability | **PASS** | `r1d-no-fog.png` full frame: river band left; reed/emmer/clay by water; GH (stepped stone + gold roof) + market canopy at civic center; luxury/red mass NE; shop pad cluster S; training pads SE; harbor on pier N. Path graph readable. Spacing not cramped for starter settlement. |
| C2 | Empty plot literacy | **PASS** | `r1d-no-fog.png` pad clusters + map legend: Shop = cream pad + gold hex/disc; Special = cream/white pad + red diamond; Training = warmer pad + teal wedge/triangle. Shape **and** color both carry category (see `padMarkers.ts` + legend “Pads: ○ Shop · ◇ Special · △ Training”). At-a-glance OK for Anno-style empty-plot literacy. |
| C3 | Silhouette kit | **PASS** | Mid-iso kinds readable without labels: GH tower, market canopy, harbor shed+crane, field grid, reed blocks, clay pit, red luxury mass, circular market-adjacent pad. Contact shadow blobs under buildings present (soft ground contact). Procedural kit, not AAA mesh — still meets silhouette bar. |
| C4 | Materials | **PASS** | Mudbrick (warm tan), stone pale (GH), crop green, water teal, sand ground, gold roof accents — separable in a grayscale mental model at mid iso. Luxury seal-red is intentionally high-contrast prestige. |
| C5 | Lighting & TOD | **FAIL** | **Shot:** `r1d-night.png` (vs `r1d-no-fog.png`). **Region:** full-frame sky + ground + prestige emissives. **Issue:** labeled night still reads as **day** — light blue-grey clear sky, bright yellow sand, full sun fill; no dark clear (`#121820` family), no dusk wash, no readable GH gold / kiln night emissive boost. Older `r1-settlement-night.png` likewise day-lit under tutorial popup. Code in `atmosphere.ts` / `animateBuildingKit(..., nightFactor)` *implements* TOD+emissives, but **round evidence does not prove night**. **Fix class:** capture integrity + presentation QA — freeze `setDayPhase("night")` (or auto at night phase), verify dark sky + reduced sun + prestige/workshop emissives in stills before re-submit. |
| C6 | Life & motion | **FAIL** | **Shot:** `r1d-no-fog.png` / `r1d-night.png` mid iso. **Region:** paths + building yards + river. **Issue:** barge on river is legible (good); **workers are not** — sand-tan capsules (`#D4B896` / `#C4A882` / `#E0C4A0` on sand field) read as ground noise or invisible at this zoom; no clear staggered agents on paths in stills. Workshop spin/bob/pulse not readable in evidence. FPS note claims workers/barge in session, but the **visual bar is “see life”** (Anno production readability), not “code spawns agents.” **Fix class:** worker silhouette/contrast (tunic accent, head contrast, slight scale-up), ensure mid-iso stills show ≥several agents on paths; optional one workshop motion cue that survives a freeze-frame. |
| C7 | Atmosphere | **PASS** | Day: clear sky family, no muddy ground wash (`r1d-no-fog.png`). Priors `r1b`/`r1c` documented EXP2 fog wedge; r1d pack shows day fog off / no white ground wedge. Subtle night haze not evidenced (see C5) but day atmosphere bar is met. |
| C8 | UI chrome | **PASS** | Thin papyrus top/bottom resource bars; quality/TOD controls compact; **Map** and **Shore** open as floating popups over the world (`r1d-map.png`, `r1-settlement-day-popup.png`) — not a permanent fat tray. First Week Goals card is papyrus/ink. Trade/map copy readable. |
| C9 | World map | **PASS** | `r1d-map.png` + `r1d-mobile.png`: curved river SVG, province dots (Delta / Clay / Gold…), site list with kind glyphs (founding ○, monument ▲). Pad legend present. Mobile portrait still shows full map panel content. (Desktop capture has large empty black aside — chrome waste, not a content fail.) |
| C10 | A11y presentation | **PASS** | Critical pad cues are **shape + color**, not color-only. UI exposes Dark mode + Color-blind toggles (`html.dark` / `html.cb` in `styles.css`; Settings buttons). CB remaps greens/gold/seal accents. No evidence still of dark mode UI, but hooks + non-color-only world cues meet presentation bar. |
| C11 | Performance | **PASS** | `FPS-NOTE.md`: client `getFps()` ~60 on med/high, starter mid scene, no hitch loops observed; worker caps 12/18. Target ≥55 mid scene **met on capture machine**. Full L15 stress not claimed — out of round-1 mid-scene scope. |
| C12 | Sim fence | **PASS** | Client-only presentation track; no evidence of rate/plot/escrow rewrites for this visual pass. Shared `rates.ts` / production helpers remain GDD source; UI still states trust trade (no bank escrow). Atmosphere/buildings/padMarkers are presentation-only. |

---

## OVERALL: FAIL

Two hard misses against the Anno-readable bar:

1. **Night does not show as night** in the priority night still.
2. **Life is not legible** at mid iso (workers camouflaged / absent in stills).

All other categories meet a strict-but-fair bar for a polished procedural browser iso kit.

---

## Top 3 blocking fixes (only)

1. **C5 — Prove night:** Capture with phase locked to night (or auto at night); sky must go dark, sun/hemi drop, optional light night haze only. GH roof + kiln/workshop emissives must *read* as night lights against the darker fill. Re-ship `r1d-night.png` that is unambiguously night next to day.

2. **C6 — Worker readability:** Break sand-on-sand camouflage (accent tunic/head colors, stronger contact shadow, modest scale). Mid-iso stills must show staggered agents on path network so production “life” is obvious at a glance.

3. **C6/C5 — One freeze-frame motion/light cue:** Ensure at least one workshop loop (spin/bob/smoke) or kiln glow is obvious when paused/night-frozen so life and night emissives are not “code-only” claims.

---

## Non-blocking notes (do not fail overall alone)

- Art level is honest procedural kit — acceptable if categories pass.
- Training “triangle” is a short wedge mesh; still distinct from special diamonds in r1d stills.
- Map desktop capture wastes horizontal space (black void); content itself is fine; mobile map is usable.
- Day fog disable was the correct fix for the r1b/r1c white-wedge wash.
- Dusk not evidenced as a third still — optional for next pack if night is solid.

---

## Evidence integrity

| File | Role in verdict |
|------|-----------------|
| `r1d-no-fog.png` | Primary day settlement — C1–C4, C7–C8 base |
| `r1d-night.png` | **C5 FAIL driver** — does not show night |
| `r1d-map.png` / `r1d-mobile.png` | C8–C9 PASS |
| `FPS-NOTE.md` | C11 PASS |
| `r1b` / `r1c` | Fog-wash priors; fixed in r1d day |
| `r1-settlement-night.png` | Confirms night labeling history still day-lit |

---

*End of Round 1 verdict.*
