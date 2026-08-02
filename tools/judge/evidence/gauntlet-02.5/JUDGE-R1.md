# JUDGE-R1 — Immortal Shores Prompt 02.5

**Role:** Independent visual judge (did not build this game).  
**Bar:** Overall ≥ 8.0 **and** every category ≥ 6.0. Prior director bar ~1.5/10; only 8+ ships.  
**Evidence reviewed:** `settlement-day.png`, `settlement-dusk.png`, `settlement-night.png`, `hud-dense.png`, `map.png`, `mobile.png`, `FPS-NOTE.md`, and `00-baseline/*` for delta.  
**Claims noted:** Blender glTF kit export, shadows, layered ground/river, premium CSS chrome.

---

## 1. Numeric scores

| # | Category | Score | Notes (strict) |
|---|---|---:|---|
| 1 | Ground & river | **2** | Sand plane + solid cyan slab. Orange path reads as road, not bank. No reeds on waterline, no wet edge, no depth/refraction/foam. “Layered” claim not visible at craft bar. |
| 2 | Structures | **3** | Central hall / open shed have slight stepped mass vs pure cubes; most of board remains colored flat pads (red/cream/brown “candy”). Harbor is a blue pad + diamond, not a pier silhouette. Mudbrick/stone not readable as material—only hue. |
| 3 | Lighting | **3** | Day nearly shadowless / ambient flat. Dusk is global orange grade, not a believable low sun with long contact shadows. Night goes near-black with two flat yellow emissive roofs—not window/hearth emissives. Time modes exist; coherence of one sun + contact is weak. |
| 4 | Depth / staging | **2** | Floating rectangular island on void. Hard edges; no occlusion stack, no ground contact darkening of consequence, no atmospheric distance. Reads as UI mock diorama. |
| 5 | Materials | **2** | Grayscale mental test fails: clay/stone/water/crops are same plastic matte, differentiated only by hue. Water has no specular band; earth no grit; wood no grain. |
| 6 | Life & motion | **2** | One tiny worker, one static barge, sparse crop grids. No staggered labor, no workshop activity, no traffic on paths. Settlement feels empty and frozen. |
| 7 | Atmosphere | **2** | No heat shimmer, dust, river fog, or dusk particulates. Dusk/night are palette swaps, not air. |
| 8 | UI / HUD | **4** | Cream + gold-border panels and dark bronze bottom bar are a step up from pure flat chrome; production table is ONI-clear. Still flat CSS cards—no papyrus fiber, ink weight, or IXION-grade material surface. Map modal is schematic, fine for clarity, not premium. |
| 9 | Cohesion | **4** | Copy and systems language (emmer, mud, seals, shore/harbor, river map) support ancient river thesis; no sci-fi. Visual execution still toy-block, so thesis is claimed more than shown. |
| 10 | Performance | **8** | `FPS-NOTE.md`: high/med capture, starter + glTF + shadows, smooth Playwright interaction, target ~60fps class, no particle death. Accept as ~60 class for this density. |

---

## 2. Overall mean

**Overall = 3.2**  
\((2+3+3+2+2+2+2+4+4+8) / 10 = 3.2\)

## 3. Min category

**min = 2** (Ground & river; Depth/staging; Materials; Life & motion; Atmosphere)

## 4. Verdict

# **FAIL**

Does not meet overall ≥ 8.0 or min ≥ 6.0.

**Delta vs baseline:** Real but small. Production overlay, denser chrome, dusk/night modes, slightly more massed central volumes. Same fundamental read as colored pads on a cream board next to a blue rectangle. Not a craft leap toward Surviving Mars / Aven environment coherence or IXION panel materials.

---

## 5. Top 3 named failures (with fix class)

| Rank | Failure | Category | Fix class |
|---:|---|---|---|
| 1 | **Empty pads still dominate as candy cubes / hue IDs** — built silhouettes too few; harbor not a pier | Structures | **Asset kit + silhouette pass:** replace pad language with mudbrick/reed/stone modular glTF; pier as posts + deck + mooring; empty lots as packed earth footprints, not neon squares |
| 2 | **River is a solid slab; no banks, reeds, wet edge, or water depth** | Ground & river | **Terrain/shore material pass:** bank gradient + reed fringe + wet dark strip + translucent/depth water (or layered fake depth); break hard island edge |
| 3 | **Materials are pure albedo color-codes (fail grayscale test)** | Materials | **PBR / stylized material separation:** distinct roughness for clay vs water vs crop canopy; subtle normal/detail; stop using saturated pad colors as the only identity |

*Honorable mentions (also sub-6):* Life & motion (populate workers/barges with stagger); Lighting (real key light + contact shadows + night interior emissives, not flat roof planes); Atmosphere (subtle dust/haze themed to heat).

---

## 6. Placeholder / procedural read

**Yes — still reads as placeholder / early procedural prototype.**

Not a shippable ancient-river settlement environment. UI is the strongest surface (still not premium material quality). World remains a colored-block mock with optional time-of-day recolor. Claims (glTF kit, layered river, shadows) are not evidenced at a level that moves craft past ~3/10 overall.

**Ship gate status:** Closed. Re-submit only when min category ≥ 6 and mean ≥ 8 with new evidence that survives side-by-side with `00-baseline/`.
