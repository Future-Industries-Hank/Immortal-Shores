# /goal — Full graphical overhaul (whole product)

### Immortal Shores · Everything the player sees  
### GH + Market progress is **not** enough — rest of game still bad

---

## /goal

**Overhaul every visual surface of Immortal Shores to a coherent, artboard-led, premium browser product — settlement board, every building kind, environment, life, world map, and all menus/UI — and do not stop until the entire product looks ready, not just two hero buildings.**

- **Keep iterating** until the acceptance gallery + independent judge both pass.  
- **Forbidden:** stop after GH/Market, “provisional PASS”, review pause, round budget, idle.  
- **Fence:** economy / plots / trust-trade frozen.  
- **Locks:** approved artboard (`docs/visual-inspiration/`, `/storyboard/`); fixed full-shore settlement POV (no wheel zoom).

---

## Reality check (why this goal exists)

Prior goal work improved **Great House** and **Market**.  
Director still sees the **rest of the game looking really bad**: remaining buildings, fields/pits, pads, shadows, workers, fog, world map, menus/HUD chrome.

**Success is product-wide cohesion.** One nice GH next to junk shops/fields/UI = FAIL.

---

## Scope map — every surface you must raise

Work in **waves**. Do not declare done until **all waves** pass eye-check.

### Wave A — Settlement 3D (all of it)

| Surface | Done means |
|---|---|
| **All building kinds** | Solid glTF, artboard-adjacent silhouette, real materials — not outline/ghost/box. List: GH, market, emmer, clay, reed, ration, mudbrick, vessel, basket, luxury mat/workshop, warehouse, shrine, harbor, barge, training ×3 |
| **Empty pads** | Clean category markers; **no** black rings; don’t look better than unfinished buildings |
| **Construction scaffold** | Timber/real, not random wire cube as “final” |
| **Ground / desert** | Coherent sand (near→far), no grey stamp carpet of fake shadows |
| **River / banks / reeds** | Readable water depth, banks, foam — not matte teal slabs only |
| **Roads / paths** | Dirt→packed language; agents stay on them |
| **Workers** | Small, sparse, **sim-accurate count**, no clip through solids |
| **Lighting / TOD** | One sun, contact shadows (soft real only), day/dusk/night; **no fog soup** |
| **Camera** | Fixed full-board standard view (locked) |

**Artboard mapping (inspiration → glTF, not JPG import):**  
`01` GH · `02` market · `03` mudbrick · `04` harbor/barge · `05` training · `06` shrine · `07` luxury · `08` emmer/fields · `09` ration/shops · settlement money-shot composition.

### Wave B — World map

| Surface | Done means |
|---|---|
| River provinces map | Intentional illustration / clean vector board — not programmer SVG default |
| City / monument / empty site markers | Distinct, on-theme icons |
| Selection / hover | Polished, readable |

### Wave C — Menus & full UI chrome (required — often skipped)

Treat UI as **half the product**. IXION / Frostpunk 2 craft bar → **papyrus / ink / soft edge light** (STYLE-CONTRACT). ONI bar → density/clarity.

| Screen / panel | Done means |
|---|---|
| **Boot / login / register / found settlement** | Designed title plate, not bare form on default CSS |
| **Main settlement HUD** | Resource strip, seals, day/time — cohesive, legible, premium |
| **Bottom/top nav** | Harbor, Private Tablets, Allies, Tablet Wall, Map, Shore — icon set + states |
| **Shore / build / inspect popups** | Panel frames, type scale, buttons; match chrome language |
| **Tablet Wall / chat / trade cards** | Designed cards, not raw list boxes |
| **Market / mail / gifts / barges** | Same language; clear hierarchy |
| **Military / monuments / envoys** | Not afterthought panels |
| **Tutorial / First Week Goals** | Styled, on-theme |
| **Settings / quality / pause production** | Consistent |
| **Mobile / narrow** | Usable; no broken overflow |
| **Modals / toasts / errors** | Themed |

Inventory every panel in `ui.ts` / `styles.css` / `inspectPopup.ts` / `modern.ts` into `UI-SURFACE-LIST.md` and check each off.

### Wave D — Audio-visual juice (light)

- Core actions still have SFX; optional soft ambient under UI  
- No silent broken feel on menu clicks  

---

## AAA quality benchmarks (craft only — not theme)

| Title | Use for |
|---|---|
| **Surviving Mars / Aven Colony** | Whole-board readability, solid modular buildings, env coherence |
| **IXION / Frostpunk 2** | Menu/HUD materials, edge light, management density |
| **Oxygen Not Included** | Status/readout clarity |

**Do not** copy sci-fi/ice art or their layouts. Identity = approved mudbrick river artboard.

---

## Non-stop loop

```
while true:
  1. Capture gallery (see Acceptance A)
  2. List remaining FAILs by wave (buildings first if any weak)
  3. Fix the worst WAVE A building OR worst WAVE C menu — pixels this iteration
  4. Recapture affected stills
  5. Independent judge on full gallery (not GH-only crops)
  6. if all acceptance checks pass AND overall ≥ 8.0 AND min ≥ 6.0:
        write GOAL-FULL-VISUAL-OVERHAUL-COMPLETE.md
        break
  7. else continue — no pause
```

**Judge instruction (every round):**  
Score the **whole product**. If shops/fields/UI look like placeholders while GH is good → Cohesion FAIL and overall cannot be 8. Structures ≤ 3 for any outline/box building still visible.

---

## Forbidden

- “GH and Market done so we pause”  
- Judge crops that hide bad buildings/UI  
- Leading reports with fog/mist while half the kits are weak  
- Provisional / review-pause COMPLETE  
- Importing artboard JPGs as final assets  

---

## Acceptance

### A. Evidence gallery (`tools/judge/evidence/full-overhaul/`)

| Shot | Required |
|---|---|
| `board-day.png` | Full settlement, fixed camera |
| `board-dusk.png` / `board-night.png` | TOD |
| `buildings/{kind}.png` | **Every** building kind close-up |
| `board-vs-art/{kind}.png` | Side-by-side vs artboard for each hero |
| `empty-pads.png` | No black rings |
| `workers-scale.png` | Small, few, sim-linked |
| `world-map.png` | Polished map |
| `ui-login.png` | Login/found |
| `ui-hud.png` | Settlement HUD |
| `ui-tablet-wall.png` | Chat/trade |
| `ui-market.png` | Market |
| `ui-build-inspect.png` | Build/inspect |
| `ui-mobile.png` | Narrow layout |

### B. Director-shaped checklist

- [ ] No outline/ghost/box buildings on the board  
- [ ] Every kind approaches artboard quality (not only GH/Market)  
- [ ] No grey/black mesh shadow stamps  
- [ ] Fixed full board; fog not soup; workers correct  
- [ ] Menus/HUD look designed as one system  
- [ ] World map not programmer-default junk  
- [ ] Cohesion: one game, not two hero props + scrapyard  

### C. Judge

- [ ] Independent: overall ≥ 8.0, min ≥ 6.0 on **full gallery**  
- [ ] Cohesion and UI categories cannot be ignored  

### D. Ship

- [ ] `GOAL-FULL-VISUAL-OVERHAUL-COMPLETE.md`  
- [ ] Server tests green  

---

## Start order (next session)

1. Inventory: `BUILDING-STATUS.md` (every kind: solid / weak / outline) + `UI-SURFACE-LIST.md`.  
2. Raise **all weak buildings** to solid artboard-adjacent (Blender single-owner queue).  
3. Environment + kill shadow stamps.  
4. **Full UI/menu skin pass** (styles + panels + login).  
5. World map pass.  
6. Full gallery → judge → fix weakest surfaces → loop.  

**Do not stop until the entire game looks ready.**
