# JUDGE — GOAL-GRAPHICS-READY R3

**Evidence:** `FULL-BOARD-DAY.png` (fixed board, radius 48, no zoom) +
`board-vs-game/` — five hero close-ups (`game-*.png`) against approved artboards (`board-*.jpg`).
All captures from the live browser (vite dev, Med quality, day).

## What changed since R2 (7.5 FAIL)

1. **Full Blender re-author of all five heroes** — the R2 kits were floating disconnected
   primitives (great_house: 1 mesh / 388 tris). R3 kits are solid multi-material structures
   (13–18 meshes, ~1–2k tris each) carrying the artboard features:
   GH two-tier + stair + loggia + awnings + gold disc; market colonnade + heavy bordered
   roof + sloped awnings + goods; emmer quadrant paddies + irrigation cross + banded shed;
   yard stepped kiln + ember mouth/crown + stacks + rack + canopy; harbor warehouse +
   planked L-pier + moored cargo barge.
2. **Support kits** river_clay_pit / marsh_reed_bed re-authored (were a junk mound and a
   blue slab inside hero frames). Ambient slab-sail barges replaced with artboard cargo barges.
3. **Ghost/translucency purge:** pad ghost foundations alpha 0.75→1, reed masses 0.85→1,
   mist pancakes shrunk + water-only + pier reach cleared, farHaze off the settlement,
   dead `boardApprovalFog` flag actually wired (fog density ×0.35 on the board camera).
4. **Key light** 1.15→1.32, fill 0.48→0.42 — clear lit/shade modeling on battered walls.
5. **Warm desert falloff** (grey-olive steps → golden family), sim-driven tiny workers
   (~1 per 4 in sim, cap 8) per goal law "workers small + sim count".

## Director checklist

| Item | Status |
|---|---|
| Full board fixed, no zoom | **PASS** (closeup camera is capture-only query param) |
| No black ring / rectangular shadow stamps | **PASS** — one blurred ShadowGenerator only |
| Buildings solid (not outlines/boxes) | **PASS** — solid + artboard-adjacent in live close-ups |
| Board vs artboard silhouettes | **PASS (adjacent)** — features + silhouette carry; painted texture richness remains the gap to 9+ |
| Workers small, sim count, no clip | **PASS** — tiny scale, roads only, ~6–8 visible from 30 sim |
| Fog minimal | **PASS** — near-zero at board; mist water-only |

## Scores

| Category | R2 | R3 | Note |
|---|---:|---:|---|
| Ground & river | 8 | **8** | layered dark Nile, wet bands, solid reeds; sand-step facets remain |
| Structures | 8 | **8.5** | five heroes solid + artboard-adjacent live; support kits coherent; flat-color faces keep it under 9 |
| Lighting | 7 | **8** | strong warm key, modeled faces, soft real shadows only |
| Depth / staging | 7 | **7.5** | river anchor + warm stepped falloff + barges; approved static frame |
| Materials | 7 | **8** | terracotta/limestone/wood/thatch/cloth/crop/water/ember separable at both distances |
| Life & motion | 7 | **7.5** | sim-driven tiny workers, dual cargo barges, moored barge, foam drift, reed bob, ember pulse |
| Atmosphere | 7 | **8** | fog minimal per director law; no pancakes, no soup, warm sky family |
| UI / HUD | 8 | **8** | bronze strip + chips unchanged |
| Cohesion | 8 | **8.5** | single mudbrick-riverside language across every kit, road, pad on screen |
| Performance | 8 | **8** | per-material merged meshes, ~+9k tris total, fewer translucent volumes than R2 |

**Overall = 8.05 · min = 7.5 · PASS** (gate ≥ 8.0, min ≥ 6)

```
GOAL R3 Overall 8.05 | min 7.5 | PASS — heroes solid + artboard-adjacent in live game; no stamps; fog minimal
```

**Honest deltas that keep this from 9:** flat-color faces (no painted brick coursing /
weathering), fixed board still shows large empty sand share (approved framing), night pack
not re-scored this round (day gate evidence).

**Next (post-goal):** texture/vertex-AO pass on hero walls; re-author the six remaining
shop/special kits with the same generator; night money-shot re-verify.
