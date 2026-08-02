# JUDGE-R3 — Immortal Shores Prompt 02.5 (ROUND 3)

**Role:** Independent visual judge (did not build this; no loyalty to R1/R2 scores beyond written records).  
**Bar:** Craft only — Surviving Mars / Aven environment coherence, IXION panel materials, ONI density — ancient river theme.  
**Gate:** Overall ≥ 8.0 **and** every category ≥ 6.0.  
**Evidence reviewed (R3 shots only):**  
`settlement-day.png`, `settlement-dusk.png`, `settlement-night.png`, `hud-dense.png`, `map.png`, `mobile.png`, `FPS-NOTE.md`.  
Side-by-side with `00-baseline/*` and written `JUDGE-R1.md` / `JUDGE-R2.md` for delta only — scores are on R3 evidence as shipped, not “effort.”

**R3 claims checked:** vast ground (no floating island); deep dark multi-layer river; pads nearly invisible sand plinths (not candy); denser reed bank; heat haze fog; more workers; denser Blender heroes GH/harbor/market; shadows; premium dark bottom bar.

---

## 1. Numeric scores

| # | Category | Score | Notes (strict) |
|---|---|---:|---|
| 1 | Ground & river | **5** | **Real delta:** continuous sand fills the frame — floating rectangular island on void is gone. River shows a darker near-shore / channel band + lighter body + diagonal striation / dash “current.” Reed fringe denser than baseline; pale wet strip present. **Still short of craft bar:** water remains layered matte slabs (not depth/refraction/foam); bank is a hard linear corridor; wet strip is a flat color band; orange path still owns the shore read. Not Surviving Mars / Aven shore quality. |
| 2 | Structures | **5** | Heroes hold: multi-tier Great Hall (darker roof + mass), open market shed with posts, pier as posts+deck + barge silhouette, circular plinth. **“Pads nearly invisible sand plinths” is false** — board is still dominated by cream / peach / yellow / coral / tan squares with gem/dot markers. Saturated pad language is the primary plot identity. Mudbrick/reed architecture not readable at craft-bar density across empty lots. |
| 3 | Lighting | **4** | Day: soft contact shadows under GH / market / pier — “shadows” claim true, not ambient-flat. Dusk: global orange grade, not a low key sun with long raking contact. Night: near-black terrain + two flat yellow emissive roof planes — not window / hearth / torch local light. Time modes exist; one-sun staging still weak. |
| 4 | Depth / staging | **5** | Continuous ground is the R3 win vs R2’s void island. Soft blob contact under heroes. **Still diorama:** hard rectangular river channel edges, no atmospheric distance falloff, no occlusion stack of consequence, isometric board-game read. Place is better staged than R2; not yet a river valley. |
| 5 | Materials | **4** | Sand grit mottling visible; dark roof vs light wall; wood pier posts; reed stalks. Water still plastic layered cyan; empty pads pure albedo hue-codes; no clay roughness vs crop canopy vs wet silt grammar. Grayscale test still fails for most of the board. Far from PBR or strong stylized material separation. |
| 6 | Life & motion | **3** | ~1–2 worker dots near the path/GH, static barge, sparse crop/reed grid, reed posts. Claim “more workers” not evidenced at density — settlement still empty and frozen. No staggered labor, path traffic, multi-barge harbor life, or workshop activity. |
| 7 | Atmosphere | **2** | Claim “heat haze fog” **not evidenced**. Day is sharp plastic air; dusk/night are palette / exposure swaps, not dust, river mist, heat shimmer, or particulate. Atmosphere remains effectively zero. |
| 8 | UI / HUD | **5** | Dark bronze bottom chrome confirmed; Shore select (blue) on `hud-dense`; production overlay table ONI-clear; cream + gold-border panels. Still flat CSS cards — no IXION-grade metal/edge/panel material, no papyrus fiber/ink weight. Map content visible on `mobile.png` (schematic river + pad list); `map.png` in package is another settlement still, not a dedicated map capture. Mobile stacks Welcome + Map without clean collapse. |
| 9 | Cohesion | **5** | Systems copy (emmer, mud, seals, shore/harbor, reed bed, river clay, Gold Reach, mudbrick yard) + continuous sand shore + pier + reed language support ancient river thesis; no sci-fi. Visual execution still toy-block / pad-plot, so thesis is stronger in UI text than in world craft. Continuous ground slightly tightens thesis vs R2 void island. |
| 10 | Performance | **8** | `FPS-NOTE.md`: high/med capture, starter + glTF + shadows, smooth Playwright interaction, ~60fps class target, no particle death. Accept ~60-class for this density. |

---

## 2. Overall mean

**Overall = 4.6**  
\((5 + 5 + 4 + 5 + 4 + 3 + 2 + 5 + 5 + 8) / 10 = 4.6\)

## 3. Min category

**min = 2** (Atmosphere)

Categories still **below 6.0:** Ground & river (5), Structures (5), Lighting (4), Depth/staging (5), Materials (4), Life & motion (3), Atmosphere (2), UI/HUD (5), Cohesion (5).  
Only Performance clears the floor.

## 4. Verdict

# **FAIL**

Does not meet overall ≥ 8.0 or min ≥ 6.0.

**Delta vs R2 (written 4.3 FAIL) and baseline:** Honest incremental improvement on staging, not a craft leap.  
- **Kept / improved:** continuous vast sand (no floating island), multi-band river read, denser reed fringe, hero silhouettes, soft contact shadows, dark bottom chrome, production overlay.  
- **Unchanged / claim-failed at gate level:** candy pad grid still owns the board (“nearly invisible” **false**); heat haze / fog **not visible**; life still near-empty; night still roof-flood planes; materials still hue-first; atmosphere still zero.  
Overall moved ~4.3 → **4.6**. Still far from ship bar (8+).

**Claims audit (strict):**

| Claim | Evidence? | Note |
|---|---|---|
| Vast ground (no floating island) | **True** | Continuous sand fills frame; major R3 staging win |
| Deep dark multi-layer river | **Partial** | Darker channel band + lighter body + striation; still slab/plastic, not depth water |
| Pads nearly invisible sand plinths (not candy) | **False** | Pads remain dominant colored squares + gems |
| Denser reed bank | **True** | Vertical green fringe denser than baseline |
| Heat haze fog | **False** | Not visible in day/dusk/night evidence |
| More workers | **Mostly false** | ~1–2 dots; not a living density pass |
| Denser Blender heroes GH/harbor/market | **Partial** | Heroes readable; density vs R2 incremental, not transformative |
| Shadows | **True** | Soft contact under heroes |
| Premium dark bottom bar | **True (dark)** | Premium/IXION material still no |

---

## 5. Top 3 named failures (with fix class)

| Rank | Failure | Category | Fix class |
|---:|---|---|---|
| 1 | **Empty colored pads still own the board** — “nearly invisible sand plinths” claim fails; heroes cannot carry a pad field | Structures + Materials | **Kill pad-as-building-ID:** packed-earth footprints, low mudbrick curbs, or ghosted kit previews; reserve saturated color for UI only; grayscale-pass every empty lot |
| 2 | **No air** — heat-haze claim unsupported; dusk/night are grade swaps | Atmosphere | **Air pass:** subtle heat shimmer / dust motes day; river mist at bank dusk; stop relying on ToD color grade alone |
| 3 | **Settlement still empty and frozen** — 1–2 workers, one barge, no traffic | Life & motion | **Populate pass:** staggered path workers, multi-barge harbor, crop/workshop activity; density must read at first glance |

*Also sub-6 (do not ignore):* Ground & river still short of bank/foam/refraction craft despite multi-band slab; Lighting (true low-sun dusk + interior night emissives, not roof flood planes); UI (IXION-adjacent panel material); Depth (atmospheric falloff, break hard rectangular channel); Cohesion rises only when world craft matches copy.

---

## 6. Placeholder / procedural read

**Yes — still reads as improved blockout / early prototype, not a shippable ancient-river settlement environment.**

Strongest surfaces: continuous sand staging (R3), systems language, production QoL table, dark nav chrome, three hero silhouettes, multi-band river intent.  
Weakest: candy pad field (claim failed), atmosphere zero (claim failed), life near-zero, night roof planes, plastic water.

**Ship gate status:** **Closed.**  
Re-submit only when **min ≥ 6** and **mean ≥ 8** with new evidence that (a) actually replaces pad candy at board scale, (b) shows visible heat/dust/mist air, (c) shows living density at a glance, (d) sells water as depth not layered cyan. Side-by-side with this R3 set is mandatory for R4.

---

## 7. Score summary (copy block)

```
Ground&river     5
Structures       5
Lighting         4
Depth/staging    5
Materials        4
Life&motion      3
Atmosphere       2
UI/HUD           5
Cohesion         5
Performance      8
-----------------
Overall          4.6
Min              2
Verdict          FAIL
```
