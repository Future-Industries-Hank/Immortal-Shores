# JUDGE-R2 — Immortal Shores Prompt 02.5 (ROUND 2)

**Role:** Independent visual judge (did not build this; no R1 memory bias beyond written `JUDGE-R1.md`).  
**Bar:** Craft only — Surviving Mars / Aven environment coherence, IXION panel materials, ONI density — ancient river theme.  
**Gate:** Overall ≥ 8.0 **and** every category ≥ 6.0.  
**Evidence reviewed (R2 shots only):**  
`settlement-day.png`, `settlement-dusk.png`, `settlement-night.png`, `hud-dense.png`, `map.png`, `mobile.png`, `FPS-NOTE.md`.  
Side-by-side with `00-baseline/*` and claims in R2 brief for delta only — scores are on R2 evidence as shipped, not “effort.”

**R2 claims checked:** denser Blender hero kits (GH / harbor / market + bevels); subtler sand plinths not candy pads; dense reed bank; wet bank strip; sand grit; shadows; night/dusk; dark premium bottom chrome.

---

## 1. Numeric scores

| # | Category | Score | Notes (strict) |
|---|---|---:|---|
| 1 | Ground & river | **4** | Real delta: mottled sand grit, pale wet-bank strip, dense vertical reed posts along waterline, barge + pier footprint. River remains a solid cyan slab with white dash “current”; island is still a hard rectangle floating on void blue; wet strip reads as a flat color band, not dark wet earth / foam / depth. Orange path still dominates bank read. Not Surviving Mars / Aven shore quality. |
| 2 | Structures | **5** | Hero kits improved: multi-tier Great Hall with darker roof + posts; pier as posts + deck (no longer pure blue candy pad); open market shed with roof mass; warehouse block; barge silhouette. **Board area still dominated by colored square plinths** (cream, coral, yellow, tan) with gem/dot markers — “subtler sand plinths” claim only half-true (some desaturation vs baseline neon; still candy ID language). Mudbrick/reed architecture not readable at craft bar density. |
| 3 | Lighting | **4** | Day: soft contact shadows under GH, market, pier — claim “shadows” is evidenced, not ambient-flat as R1. Dusk: global orange grade, not a low sun with long raking contact. Night: near-black terrain + two flat yellow emissive roof planes — not window / hearth / torch local light. Time modes exist; one-sun staging still weak. |
| 4 | Depth / staging | **3** | Same floating rectangular diorama on solid void. No occlusion stack, no atmospheric distance falloff, no soft ground contact darkening of consequence beyond soft blob shadows. Reads as UI mock island, not a place on a river valley. |
| 5 | Materials | **4** | Partial grayscale separation: dark roof vs light walls, wood pier posts, reed stalks, sand grit. Water still plastic matte cyan; empty pads pure albedo hue-codes; no clay roughness vs crop canopy vs wet silt. Far from PBR or strong stylized material grammar of the craft bar. |
| 6 | Life & motion | **3** | ~1–2 worker dots + static barge + sparse crop grid + reed posts. No staggered labor, path traffic, workshop activity, or multi-barge harbor life. Settlement still feels empty and frozen. |
| 7 | Atmosphere | **2** | No heat haze, dust, river fog, insect motes, or dusk particulate. Dusk/night are palette / exposure swaps, not air. |
| 8 | UI / HUD | **5** | Dark bronze bottom chrome is a clear R2 win vs cream baseline bar; production overlay table is ONI-clear; cream + gold-border panels; Shore select state in `hud-dense`. Still flat CSS cards — no IXION-grade metal/edge/panel material, no papyrus fiber/ink weight. Map modal is clean schematic (fine for clarity, not premium). Mobile stacks Map + Welcome without collapse. |
| 9 | Cohesion | **5** | Systems copy (emmer, mud, seals, shore/harbor, reed bed, river clay, Gold Reach) + reed bank + pier + mudbrick-yard language support ancient river thesis; no sci-fi bleed. Visual execution still toy-block / pad-plot, so thesis is stronger in UI text than in world craft. |
| 10 | Performance | **8** | `FPS-NOTE.md`: high/med capture, starter + glTF + shadows, smooth Playwright interaction, ~60fps class target, no particle death. Accept ~60-class for this density. |

---

## 2. Overall mean

**Overall = 4.3**  
\((4 + 5 + 4 + 3 + 4 + 3 + 2 + 5 + 5 + 8) / 10 = 4.3\)

## 3. Min category

**min = 2** (Atmosphere)

Categories still **below 6.0:** Ground & river (4), Structures (5), Lighting (4), Depth/staging (3), Materials (4), Life & motion (3), Atmosphere (2), UI/HUD (5), Cohesion (5).  
Only Performance clears the floor.

## 4. Verdict

# **FAIL**

Does not meet overall ≥ 8.0 or min ≥ 6.0.

**Delta vs R1 (written 3.2 FAIL) and baseline:** Honest improvement, not a craft leap.  
- **Kept / improved:** hero mass (GH, pier, market), reed bank density, wet strip, sand grit, contact shadows, dark bottom chrome, production overlay.  
- **Unchanged at gate level:** candy pad grid, void island, slab river, empty life, no atmosphere, materials still hue-first.  
Overall moved ~3.2 → **4.3**. Still far from ship bar (8+).

**Claims audit (strict):**

| Claim | Evidence? | Note |
|---|---|---|
| Denser Blender hero kits + bevels | **Partial** | GH / pier / market read as built volumes; bevels subtle at this camera |
| Subtler sand plinths not candy pads | **Mostly false** | Pads remain the dominant plot language |
| Dense reed bank | **True** | Vertical green posts along water |
| Wet bank strip | **True but weak** | Flat pale band, not wet material |
| Sand grit texture | **True** | Subtle mottling visible |
| Shadows | **True** | Soft contact under heroes |
| Night / dusk | **True (modes)** | Staging quality still low |
| Dark premium bottom chrome | **True (dark)** | Premium/IXION material still no |

---

## 5. Top 3 named failures (with fix class)

| Rank | Failure | Category | Fix class |
|---:|---|---|---|
| 1 | **Empty colored pads still own the board** — heroes improved but plot language is still candy squares + gems | Structures + Materials | **Kill pad-as-building-ID:** packed-earth footprints, low mudbrick curbs, or ghosted kit previews; reserve saturated color for UI only |
| 2 | **River = cyan slab + void island** — wet strip + reeds help, depth/bank/foam/refraction absent | Ground & river + Depth | **Shore system:** bank gradient, dark wet silt, reed clusters with height variance, water depth layers or stylized refraction; break hard rectangular coastline |
| 3 | **No air, no life density** — frozen workers, no fog/dust/heat | Atmosphere + Life & motion | **Populate + air pass:** staggered worker paths, multi-barge, smoke/dust motes, subtle river mist at dusk; stop relying on ToD grade alone |

*Also sub-6 (do not ignore):* Lighting (true low-sun dusk + interior night emissives, not roof flood planes); UI (IXION-adjacent panel material, not only dark flat bar); Cohesion will rise only when world craft matches copy.

---

## 6. Placeholder / procedural read

**Yes — still reads as early prototype / improved blockout, not shippable ancient-river settlement environment.**

Strongest surfaces: systems language, production QoL table, dark nav chrome, three hero silhouettes.  
Weakest: empty pad field, slab water, void staging, atmosphere zero, life near-zero.

**Ship gate status:** **Closed.**  
Re-submit only when **min ≥ 6** and **mean ≥ 8** with new evidence that (a) replaces pad candy language at board scale, (b) sells a river shore not a blue rectangle, (c) shows living density + air. Side-by-side with this R2 set is mandatory for R3.

---

## 7. Score summary (copy block)

```
Ground&river     4
Structures       5
Lighting         4
Depth/staging    3
Materials        4
Life&motion      3
Atmosphere       2
UI/HUD           5
Cohesion         5
Performance      8
-----------------
Overall          4.3
Min              2
Verdict          FAIL
```
