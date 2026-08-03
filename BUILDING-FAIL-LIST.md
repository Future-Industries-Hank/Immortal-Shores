# BUILDING-FAIL-LIST — GOAL-GRAPHICS-READY

**Date:** 2026-08-02 (R3 — full Blender re-author)
**Method:** Live browser close-ups (`?closeup=<kind>` capture camera) + full fixed board + glTF byte diffs
**Rule:** outline / box / solid — solid required for heroes; heroes must be artboard-adjacent

## Heroes (close-up priority)

| Kind | Artboard | glTF | Status (R3 live browser) |
|---|---|---|---|
| `great_house` | `buildings/01-great-house.jpg` | `great_house.glb` 68.8k | **solid + artboard-adjacent**: two-tier battered mass, stone band, external stair + stringer, loggia pergola w/ lattice + hanging rug, striped door awning, gold disc, yellow window awnings, pots |
| `market` | `buildings/02-market.jpg` | `market.glb` 75.5k | **solid + artboard-adjacent**: stepped limestone base, battered end/back walls, 5-column colonnade, heavy bordered roof slab, roof mats, sloped cloth awnings, counters w/ textile tops + baskets, amphorae, corner steps |
| `emmer_field` | `buildings/08-emmer-field.jpg` | `emmer_field.glb` 116k | **solid + artboard-adjacent**: 4 quadrant crop beds w/ two-tone rows + tuft spikes, irrigation cross w/ wet channels + banks, banded-brick shed w/ lattice roof, rush fence, grain pile + baskets |
| `mudbrick_yard` | `buildings/03-mudbrick-yard.jpg` | `mudbrick_yard.glb` 85.3k | **solid + artboard-adjacent**: stepped battered kiln w/ soot band + ember crown + glowing mouth, brick stacks, drying rack, brick mats, shade canopy, clay baskets |
| `harbor` | `buildings/04-harbor-pier-barge.jpg` | `harbor.glb` 115k | **solid + artboard-adjacent**: mudbrick warehouse w/ cornice + blue clerestory + roof mats/rolls, planked L-pier on posts, bollards + rope coils, amphorae, moored cargo barge w/ prow/stern + sacks + oar |

All five heroes re-authored in Blender (procedural kit generator `tools/kit-pipeline/author_kits.py`),
exported as NEW .glb bytes, meshes merged per material (13–18 meshes/kit, ~1–2k tris),
verified **in the live browser** at close-up and board distance.

## Support kits re-authored (were polluting hero frames)

| Kind | Was | Now |
|---|---|---|
| `river_clay_pit` | amorphous low-poly mound ("m1/m2/pit.001" junk) | terraced dig w/ wet clay pool, plank ramp, clay balls, baskets |
| `marsh_reed_bed` | flat blue slab + sticks | bermed paddies w/ solid rush clumps, seed heads, cut bundles |
| ambient barges (scene.ts) | grey slab sail box kit | artboard cargo barge: low hull, raised prow/stern, deck mat, sacks — slab sail deleted |

## Code crimes removed this round

- `ghost-<pad>` foundations were **alpha 0.75 translucent** → now solid packed earth
- `reedMassMat` bank clumps were **alpha 0.85 ghost boxes** → opaque
- bank mist: 5–8-unit ellipsoid pancakes over pier/bank → small, water-only, alpha 0.15, pier reach skipped
- `farHaze` 42×50 plane filmed the whole settlement → far-desert only, alpha 0.09
- scene EXP2 fog washed 28% grey at board radius 48 → `boardApprovalFog` now actually applied (density ×0.35)
- foam blobs sat on the bank (white pills on dirt) → moved into the water
- pale rocks read as paper scraps → warm sandstone
- kits faced away from camera (axis chain) → 180° bake at export; facades on Babylon −Z
- desert falloff planes were olive-grey → warm golden family, thinner alphas

## Secondary still open (not on screen in current evidence)

shrine, training_grounds, ration_house, warehouse, vessel/basket/luxury shops — old modular kits,
not present in the evidence settlement; re-author with the same generator when they enter frame.

## Structures judge rule

If hero still reads outline/box vs artboard → Structures ≤ 3.
R3: heroes **solid + artboard-adjacent** in live browser → rule not triggered.
