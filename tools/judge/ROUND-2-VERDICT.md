# ROUND-2 VERDICT — Immortal Shores (Prompt 02 visual)

**Judge role:** Impartial visual judge (not builder).  
**Comparables:** Anno 1800/2205 production readability · high-end isometric historical empire · polished browser strategy.  
**Prior:** `ROUND-1-VERDICT.md` — **OVERALL: FAIL** on **C5** (night proof) and **C6** (worker contrast) only.  
**NEW priority evidence:** `r2-day.png`, `r2-night.png`.  
**Carryover evidence:** `r1d-map.png`, `r1d-mobile.png`, `FPS-NOTE.md` (and R1 spatial/material notes where R2 stills reconfirm).  
**Art honesty:** Presentation remains a **good procedural primitive kit** (boxes/cylinders/capsules), not AAA glTF. Categories that meet the bar on readability/presentation still PASS; FAIL only on real bar misses.  
**Fairness notes (explicit):** Night in `r2-night.png` is **intentionally dark** — that is correct night, not a wash. Workers wear **dark robes with gold sashes** — high-contrast design, not camouflage.

---

## Binary table (C1–C12)

| ID | Category | Verdict | Located notes |
|----|----------|---------|---------------|
| C1 | Spatial readability | **PASS** | `r2-day.png` full frame: river band left; reed/emmer/clay by water; GH (stepped stone + gold roof) + market canopy at civic center; luxury/red mass NE; shop pad cluster S; training pads SE; harbor on pier N. Path graph readable. Starter spacing not cramped. Reconfirms R1 C1. |
| C2 | Empty plot literacy | **PASS** | `r2-day.png` / `r2-night.png` pad clusters: Shop = cream pad + gold disc; Special = cream pad + red diamond; Training = warmer pad + teal wedge. Shape **and** color both carry category at a glance (legend still “Pads: ○ Shop · ◇ Special · △ Training” in map evidence). |
| C3 | Silhouette kit | **PASS** | Mid-iso kinds readable without labels: GH tower + gold roof, market canopy, harbor shed+crane, field grid, reed blocks, clay pit, red luxury mass, pad markers. Contact shadow blobs under buildings present. Procedural kit meets silhouette bar. |
| C4 | Materials | **PASS** | Mudbrick (warm tan), stone pale (GH), crop green, water teal, sand ground, gold roof accents, luxury seal-red — separable in a grayscale mental model at mid iso. Night still preserves prestige gold vs dark ground. |
| C5 | Lighting & TOD | **PASS** | **Shot:** `r2-night.png` vs `r2-day.png`. **Region:** full-frame sky + ground + prestige/workshop emissives. **Day:** coherent sun, bright clear sky, full sand fill. **Night:** TOD control locked to **Night**; sky is dark navy/`#121820` family (not day blue-grey); sun down; ground heavily underexposed. **Emissives read as night lights:** GH gold roof(s) pop bright against dark fill; warm kiln/workshop glow on dark mass mid-settlement. **Delta vs R1 FAIL:** `r1d-night.png` was day-lit under a “night” label; `r2-night.png` is unambiguously night. Dusk third still optional — day + proven night meets bar. |
| C6 | Life & motion | **PASS** | **Shot:** `r2-day.png` mid iso. **Region:** paths + yards + river. **Workers:** dark robes + gold sashes break sand-on-sand camouflage; multiple staggered agents visible on path network at a glance (Anno “see life” bar met). **River:** barge legible on left water band. **Night:** agents recede into darkness (acceptable — intentionally dark night); prestige/kiln lights supply freeze-frame life cue. Workshop spin/bob still soft in stills but not a fail once workers and barge read clearly. **Delta vs R1 FAIL:** R1 sand-tan capsules were ground noise; R2 contrast fix lands. |
| C7 | Atmosphere | **PASS** | Day (`r2-day.png`): clear sky family, no muddy ground wash. Night (`r2-night.png`): dark clear, not fog-white wedge; intentional underexposure preserves emissive contrast. R1 fog regression remains fixed. |
| C8 | UI chrome | **PASS** | Thin papyrus top/bottom resource bars; quality/TOD/Map compact top-right; **First Week Goals** and Map open as floating popups over the world (`r2-day.png`, `r1d-map.png`) — not a permanent fat tray. Trade/map/goals copy readable. |
| C9 | World map | **PASS** | `r1d-map.png` + `r1d-mobile.png` (unchanged carryover): curved river SVG, province markers (Delta / Clay / Gold…), site list with kind glyphs (founding ○, monument ▲). Pad legend present. Mobile portrait still shows full map panel content. |
| C10 | A11y presentation | **PASS** | Critical pad cues are **shape + color**, not color-only. UI exposes Dark mode + Color-blind toggles (hooks from R1 codebase skim; presentation bar). Worker gold sash + dark robe also improves non-color-only agent cue vs sand. |
| C11 | Performance | **PASS** | `FPS-NOTE.md` carryover: client `getFps()` ~60 on med/high, starter mid scene, no hitch loops; worker caps 12/18. Target ≥55 mid scene **met on capture machine**. No R2 regression claim against that note. |
| C12 | Sim fence | **PASS** | Client-only presentation track; no evidence of rate/plot/escrow rewrites for this visual pass. Trust trade intact in UI goals (“Complete a trade”). Atmosphere/buildings/workers remain presentation-only. |

---

## OVERALL: PASS

Round 1’s only hard misses are closed by the R2 evidence pack:

1. **C5 night is proven** — dark sky, sun down, GH gold roof emissive, kiln glow.  
2. **C6 life is legible** — high-contrast workers (dark robe + gold sash) staggered on paths; barge present.

All twelve categories meet a strict-but-fair bar for a polished procedural browser iso kit.

---

## Round 1 blockers — disposition

| Prior blocker | Status | Evidence |
|---------------|--------|----------|
| C5 — Prove night | **CLOSED** | `r2-night.png`: locked Night, dark sky, prestige gold + kiln emissives |
| C6 — Worker readability | **CLOSED** | `r2-day.png`: dark robes / gold sashes, multiple path agents |
| C6/C5 freeze-frame light cue | **CLOSED** | Night GH gold + kiln glow read when paused |

---

## Non-blocking notes (do not fail overall alone)

- Art level remains honest procedural kit — acceptable; all categories pass.
- Training triangle is still a short wedge mesh; distinct from special diamonds in R2 stills.
- Map desktop capture wastes horizontal space (black void); content itself is fine; mobile map is usable.
- Dusk not shipped as a third still — optional polish if a TOD cycle gallery is desired later.
- Night intentionally hides most agents; that is correct atmosphere, not a C6 regression, given day still proves life.
- FPS note is Round-1 session text; no contradictory R2 hitch evidence.

---

## Evidence integrity (this round)

| File | Role in verdict |
|------|-----------------|
| `r2-day.png` | Primary day settlement — C1–C4, C6 life, C7 day, C8 base |
| `r2-night.png` | **C5 PASS driver** — true night + GH gold + kiln glow |
| `r1d-map.png` / `r1d-mobile.png` | C8–C9 carryover PASS |
| `FPS-NOTE.md` | C11 carryover PASS |
| `ROUND-1-VERDICT.md` | Prior FAIL scope (C5, C6 only) |

---

*End of Round 2 verdict.*
