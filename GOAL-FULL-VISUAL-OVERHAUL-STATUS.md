# GOAL — FULL VISUAL OVERHAUL · Status after 10 judged rounds

**Date:** 2026-08-03 · **Branch:** main · **Evidence:** `tools/judge/evidence/full-overhaul/` (31 shots, regenerated every round)
**Method:** build round → regenerate the whole 31-shot gallery from the live game → 4 independent art-director judges (structures/cohesion, environment, UI, product) score the *whole* gallery → fix their exact findings → repeat.

---

## Where it landed

| Round | Mean | Min | Headline |
|---|---:|---:|---|
| R1 | 3.7 | 2.7 | 15 kits + full UI skin land; environment is a tan void |
| R2 | 4.6 | 3.0 | artifact purge (mist, ghosts, farHaze); sun path animates |
| R3 | 4.8 | 3.4 | macro sand, boulder rocks, mobile root-cause fix |
| R4 | 5.6 | 3.4 | **baked AO in all 15 kits**; PCF shadows |
| R5 | 6.4 | 5.0 | WaterMaterial Nile, cinematic grade |
| R6 | 6.3 | 4.5 | sky-gold hunt, life density |
| R7 | 6.7 | 5.6 | scrub anchoring, olive banks, summed night lamps |
| R8 | 6.7 | 5.3 | painted AO carpet, occupancy-gated roads, inspect scrim |
| R9 | 5.8 | 4.2 | *harsher panel (3× zoom)*; kit transparency root cause found |
| **R10** | **6.0** | **4.8** | contact discs, palm rebuild, shop-tier identity, greybox purge |

R9/R10 panels zoomed to 3× and found defects earlier rounds never saw, so the
numbers dip while the product improves — compare `board-day.png` across rounds
in git history rather than trusting the scalar.

### Current per-category (R10, min across 4 judges)

| Category | Score | Category | Score |
|---|---:|---|---:|
| **UI / HUD** | **7.9** | Materials | 6.0 |
| **Mobile** | **7.4** | Life & motion | 5.9 |
| **World map** | **7.2** | Cohesion | 5.6 |
| Structures | 6.4 | Ground & river | 5.2 |
| Lighting | 6.3 | Depth / staging | 5.0 |
| First impression | 6.2 | Atmosphere | 4.8 |

**Gate (mean ≥ 8.0 / min ≥ 6) is NOT met.** UI, mobile and the world map are at
or near the bar. The 3D environment is the whole remaining gap.

---

## What actually shipped

**Buildings — all 15 kinds authored in Blender** (`tools/kit-pipeline/author_kits.py`,
one procedural generator, ~4.5k lines): great_house, market, emmer_field,
mudbrick_yard, harbor, river_clay_pit, marsh_reed_bed, ration_house, vessel_shop,
reed_basket_shop, luxury_material, luxury_workshop, warehouse, shrine,
training_grounds. Each is a solid multi-material mass with props, 10–20 meshes,
1–2.5k tris, **baked Cycles ambient occlusion + painted value jitter in COLOR_0**.
Shop tier now differentiated by silhouette, hero prop and roof treatment
(beehive silos/plank · stepped kiln+chimney/tile · basket tower/thatch).

**Environment:** displaced dune terrain outside the play field, 1024px macro sand
texture (tonal blotches + dune crescents + grit), palm/scrub/rock/dune scatter,
reflective animated `WaterMaterial` Nile, varying shoreline, linear aerial-perspective
fog, PCF shadows, per-building contact discs, day/dusk/night with a moving sun path
and summed quarter lamps at night.

**Life:** sim-driven shaped workers (headcloth, kilt, A-stance, carried loads),
three cargo barges seated in the water, night window lamps across the whole city.

**UI — every surface skinned** (`UI-SURFACE-LIST.md`, 28 surfaces): design tokens +
papyrus texture + display serif, login key art, glyph resource chips, icon nav,
panel shell, shore/build/wall/tablets/allies/military/harbor panels, inspect popup
with level-path table, tutorial + goals, toasts, dark mode, mobile at 390px,
and an authored inline-SVG world map (860px set piece, province borders,
arc-placed markers, ownership wash, 7-state legend, collision-relaxed labels).

**Camera:** fixed board tightened 48 → 30 per the owner's "zoom it in" note.

---

## The remaining gap (what a next pass must do)

Ordered by judge-score leverage. These are art-direction investments, not bug fixes —
the bug class is exhausted.

1. **Atmosphere (4.8) & Depth (5.0).** No particulate life anywhere: no dust drift,
   no heat shimmer, no smoke over a kiln district, no birds, no water motion beyond
   barge drift. A smoke attempt was cut in R6 because opaque puffs photographed as
   floating rocks — it needs a proper soft-particle/billboard system, not meshes.
   The board also has ~45% empty sand; it wants a framing element (far dune ridge
   silhouette band, distant cliff) to close the composition.
2. **Ground & river (5.2).** The river is still a straight diagonal of flat value
   bands meeting at a hard seam. It needs a genuine meandering ribbon mesh with a
   shore blend gradient, foam at the waterline, and depth falloff — not stacked boxes.
3. **Cohesion (5.6).** Every building sits on its own rectangular plot tray in a
   slightly different beige; the settlement reads as tiles pasted on sand. Fix:
   remove per-kit aprons entirely and let a single painted ground layer carry the
   packed-earth wear.
4. **Kit awnings** are untapered flat quads whose poles do not always meet the
   ground — the "orange billboard" the R10 panel flagged in five frames.
5. **Villagers** are visibly a fidelity tier below the architecture at close zoom.

---

## Repro / tooling

```bash
# author + export every kit (Blender 4.0.2 headless, bakes AO)
blender -b -P tools/kit-pipeline/author_kits.py

# regenerate the full 31-shot judge gallery from the live game
npm run dev            # then:
node tools/kit-pipeline/capture-gallery.mjs
```

`tools/kit-pipeline/probe.mjs` dumps live mesh names/positions/materials near a
world coordinate — it is how the transparency, floating-barge and misplaced-AO
bugs were located.

### Root causes worth remembering

- **Kit meshes rendered semi-transparent** because Babylon auto-sets
  `hasVertexAlpha` when `COLOR_0` has 4 components (our AO bake), pushing every
  kit into the alpha-blend pass. Fixed with `mesh.hasVertexAlpha = false`.
- **A world-space painted AO carpet kept mis-registering** (DynamicTexture
  `invertY` double-flip) and read as casterless shadow smudges. Replaced with
  per-building contact discs parented to the building transform.
- **`boardApprovalFog` was set but never read** — scene fog was washing 28% grey
  over every building at the fixed camera distance.
- **Mobile overflow** was caused by grid items defaulting to `min-width:auto`;
  the 7-tab nav widened the whole game column past the viewport.
