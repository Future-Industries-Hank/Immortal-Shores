# GOAL — FULL VISUAL OVERHAUL · Status after 16 judged rounds

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
| R10 | 6.0 | 4.8 | contact discs, palm rebuild, shop-tier identity, greybox purge |
| R11 | 6.4 | 5.2 | horizon band, unified plot trays (structures 7.2, cohesion 6.8, map 7.4) |
| R12 | 5.8 | 4.3 | **owner directive: board framing cut the dead desert** |
| R14 | 6.5 | 5.4 | framing pays off: depth 4.8→6.0, ground 4.6→6.2, **UI 8.1** |
| **R16** | **6.3** | **4.6** | geometry repair: **cohesion 8.0**, **structures 7.4** |

R9/R10 panels zoomed to 3× and found defects earlier rounds never saw, so the
numbers dip while the product improves — compare `board-day.png` across rounds
in git history rather than trusting the scalar.

### Current per-category (R16, min across 4 judges)

| Category | Score | | Category | Score |
|---|---:|---|---|---:|
| **Cohesion** | **8.0** | | Materials | 6.0 |
| **UI / HUD** | **7.8** | | Lighting | 5.9 |
| **Structures** | **7.4** | | Depth / staging | 5.8 |
| World map | 6.8 | | First impression | 5.8 |
| Mobile | 6.5 | | Ground & river | 5.6 |
| | | | Life & motion | 5.3 |
| | | | **Atmosphere** | **4.6** |

**Gate (mean ≥ 8.0 / min ≥ 6) is NOT met**, but cohesion has reached the bar and
structures/UI are within half a point. The floor is **atmosphere (4.6)** and
**life & motion (5.3)** — both dominated by the single blocked item below
(no smoke, dust, haze or water motion anywhere), plus ground & river.

Trajectory over the 16 rounds: cohesion 5.6 → **8.0**, structures 6.4 → **7.4**,
depth 5.0 → 5.8, ground 5.2 → 5.6, UI 7.9 → 7.8–8.1.

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

**Camera:** fixed board tightened 48 → 30 → **24** and recentred on the built
area per the owner's "cut out 80% of the empty desert" directive — the frame is
now settlement + river edge + a thin desert margin. `setOrtho` is aspect-aware so
portrait phones widen the frustum instead of cropping the shore.

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
6. **Particle atmosphere is blocked, not skipped.** Babylon never creates an
   internal texture for the particle sprite in this ESM build — `Texture._texture`
   stays null for both `DynamicTexture` and a data-URL `Texture`, so
   `ParticleSystem.isReady()` is false and nothing emits. Importing
   `Shaders/particles.{vertex,fragment}.js` did not help. The engine texture
   extension is the thing to chase; once a sprite is ready, the smoke/dust/gnat
   systems are a ~100-line drop-in (see git history for the reverted version).
7. **Panel top edge jumps between tabs** because the popup is vertically
   centred and each panel is a different height — anchor it to a fixed top.

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
