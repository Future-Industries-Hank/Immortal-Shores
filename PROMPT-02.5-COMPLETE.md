# PROMPT 02.5 COMPLETE — Visual Gauntlet (HONEST FAIL)

**Status:** **FAIL** — independent judge never reached ≥ 8.0 overall / min ≥ 6.0  
**Terminal score:** **4.8 overall** (JUDGE-R6) · min **2** (Atmosphere)  
**Date:** 2026-08-02  
**Fence:** Mechanics frozen (rates / 5·4·3 plots / trust-trade). Server tests **7/7**.

---

## Verdict (integrity)

| Gate | Required | Achieved |
|---|---|---|
| Overall | ≥ 8.0 | **4.8** |
| Min category | ≥ 6.0 | **2** |
| Not placeholder | Yes | **Still reads as early procedural / soft kit** |
| Rounds | ≤ 6 | **6 / 6 exhausted** |

**Do not treat this as ship-quality art.** Prior Prompt 02 “PASS” at ~1.5–2/10 quality remains void for shipping pride. This document supersedes fake confidence.

---

## Judge trajectory

| Round | Overall | Min | File |
|---|---:|---:|---|
| R1 | 3.2 | 2 | `JUDGE-R1.md` |
| R2 | 4.3 | 2 | `JUDGE-R2.md` |
| R3 | 4.6 | 2 | `JUDGE-R3.md` |
| R4 | 4.6 | 2 | `JUDGE-R4.md` |
| R5 | 4.8 | 2 | `JUDGE-R5.md` |
| **R6** | **4.8** | **2** | `JUDGE-R6.md` |

Evidence: `tools/judge/evidence/gauntlet-02.5/`

---

## What was built (real deltas)

| Area | Delivery |
|---|---|
| **Blender kit** | 16 glTF buildings under `apps/client/public/models/buildings/*.glb` (GH/harbor/market densified with bevels) |
| **Client loader** | `@babylonjs/loaders` + `kitLoader.ts` (preload/clone; procedural fallback) |
| **Environment** | Vast sand ground + grit texture, multi-layer river, wet bank, reed fringe, rocks, dust motes |
| **Lighting** | Directional blur shadow map, day/dusk/night atmosphere, EXP2 fog |
| **Pads** | Candy cubes reduced → soft sand + ink rims/icons |
| **Life** | Larger high-contrast workers, forced higher count, path fallbacks, barge |
| **UI** | Dark premium bottom chrome, gold rim panels, papyrus glass popups |
| **Primer** | `VISUAL-READY.md` upgraded to **GO undegraded** (Blender MCP live) |

---

## Structural cause (unlock 8.0)

From JUDGE-R6 — not another density tweak round:

1. **Art production regime** — densified kits on **all** empties, hand/sculpted or high-detail glTF + albedo/roughness maps (not box stacks), depth water, night local lights.  
2. **Presentation that survives mid-iso stills** — haze/life must read in PNGs at settlement zoom (current fog/dust/workers do not).  
3. **Time** — two full craft passes (air+life, then water+kits+night+UI materials), not parallel claim lists.

Floor-scraping every category at 6.0 still averages 6.0 and **fails** the mean-8 gate.

---

## Mechanics fence (spot-check)

```text
npm run test -w @immortal/server   # 7/7
```

No GDD rates / plot counts / trust-trade changes in this pass.

---

## ai_manifest

`visual_tier_achieved` remains **below 3 for shipping pride**. Prompt 02.5 does **not** upgrade visual tier to production 8/10.

---

## How to continue (next session)

1. Keep Blender MCP live; single owner mesh lane.  
2. Author **textured** building LODs (not beveled cubes only).  
3. Ghost architecture on empty pads.  
4. Particle/heat system that reads at mid-iso.  
5. Worker sprites or larger LOD crowd.  
6. Re-run gauntlet from baseline with capture checklist forbidding HUD-as-map mistakes.

**Ship gate: CLOSED.**
