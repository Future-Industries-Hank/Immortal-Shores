# PROMPT 03 — Approved-board visual gauntlet (quality to ≥ 8/10)

### Immortal Shores · After artboard + POV lock  
### Inspiration = approved boards · Quality bar = AAA category craft (not style copy)

> **Prerequisites (already done):**  
> - Art storyboard **Yes** (inspiration boards under `docs/visual-inspiration/` / `/storyboard/`)  
> - Standard view **POV + scale locked** (fixed full-settlement board)  
> **Do not re-open storyboard or change camera product model** unless director asks.  
> **Fence:** Economy / plots / trust-trade frozen.  
> **Do not stop below overall ≥ 8.0 and min category ≥ 6.0** (honest scores, keep iterating).

---

## Mission

Make the **live game** match the **approved artboard look** (silhouettes, materials, composition) while presentation follows the **locked standard view**, and raise craft until an independent judge scores **≥ 8.0 overall** (min ≥ 6) against **AAA quality benchmarks in the same product category** — management / city / colony board, high-angle readable simulation — **without copying their sci-fi/ice setting or UI layouts**.

---

## Binding locks (from director)

### A. Artboard (inspiration → implement)

| Rule | Detail |
|---|---|
| Boards are law for look | `docs/visual-inspiration/` (and `/storyboard/` mirrors) |
| Not final textures | Do **not** paste JPGs as game sprites |
| Implement in-engine | Blender glTF / materials / lighting so **Playwright stills** approach each board |
| Money-shot | Composition toward `settlement/10-settlement-money-shot.jpg` **within locked standard framing** |

Hero mapping:

| Board | glTF / kind |
|---|---|
| 01-great-house | `great_house` |
| 02-market | `market` |
| 03-mudbrick-yard | `mudbrick_yard` |
| 04-harbor-pier-barge | `harbor` + `barge` |
| 05-training-grounds | `training_grounds` |
| 06-shrine | `shrine` |
| 07-luxury-works | luxury kits |
| 08-emmer-field | fields / pits / reeds |
| 09-ration-house | shops / ration house |

**If it still reads as a cube vs board massing → Structures ≤ 3.** No inflated scores.

### B. Standard view (product camera)

| Rule | Detail |
|---|---|
| Full shore visible | River + all pads + buildings in one frame |
| **No mouse-wheel zoom** | Fixed orthographic board |
| Not a free 3D playspace | Static-from-above product; map UI is separate |
| People are accents | Not the focus of the frame |

### C. Director play fixes (must stay green)

| Issue | Fix |
|---|---|
| Fog soup / wheel “changes fog” | Minimal haze; zoom disabled so fog isn’t a zoom toy |
| Workers ≈ building size | Scale humans to door-relative size |
| Too many workers | Count from **sim** (assigned/total); sparse; **never** invent 14–26 for stills |
| Ghost through buildings | Path on roads/pad edges only |
| Black rings under riverside kits | Remove fake mesh shadow discs/halos |
| Weird rectangular shadow boxes | Remove kitLoader rake bars / hard `shadowBlob` / worker foot boxes; one soft real shadow system max |

Keep: detailed buildings, sparse plots, desert setting.

---

## AAA quality benchmarks (craft bar only)

Use these as **how good it should feel**, not what it should look like thematically.  
**Do not** mimic sci-fi colonies, ice cities, or their HUD layouts/labels.  
Immortal Shores stays **eternal river / mudbrick / papyrus**.

| Benchmark | Steal *quality of* |
|---|---|
| **Surviving Mars** & **Aven Colony** | Readable high-angle settlement, modular building clarity, environment coherence, HUD sitting cleanly on the 3D board |
| **IXION** & **Frostpunk 2** | Premium panel materials, soft edge light, dense management polish → translate to **papyrus/ink**, not station chrome |
| **Oxygen Not Included** | Status/readout clarity and information density without clutter |

Independent judge must compare **craft** (materials, lighting discipline, silhouette readability, cohesion, UI polish) to this class — side-by-side if possible — while scoring **our** theme.

---

## Scorecard (independent judge every loop)

Categories 0–10; complete only if **overall ≥ 8.0** and **min ≥ 6.0**:

1. Ground & river  
2. Structures *(≤ 3 if boxes vs boards)*  
3. Lighting  
4. Depth / staging  
5. Materials  
6. Life & motion *(sparse, correctly scaled workers only)*  
7. Atmosphere *(subtle; no fog soup)*  
8. UI / HUD  
9. Cohesion  
10. Performance (~60 fps Med)  

**Integrity:** Never fake PASS. **Do not stop** because “rounds are exhausted” while below 8 — keep iterating (or `VISUAL-BLOCKED.md` only if tools truly dead).

---

## Work order

1. **Confirm locks** — storyboard approved; re-apply standard view camera if regressed.  
2. **Kill presentation bugs** — shadow stamps, fog, worker scale/count/pathing, fixed camera.  
3. **Board-matching structure pass** — Blender single-owner: re-author any hero still boxy vs board.  
4. **Capture** under `tools/judge/evidence/gauntlet-03/`:  
   - `STANDARD-VIEW-DAY.png` (full board)  
   - `board-vs-game/{kind}.png` side-by-sides for heroes  
   - `no-shadow-boxes.png`  
   - day / dusk / night  
5. **Independent judge** with benchmark craft instructions + structure honesty rule.  
6. **Fix top 3 fails** → recapture → re-judge until gate.  
7. Write `PROMPT-03-COMPLETE.md` only on real ≥ 8.0 + director-shaped checklist green.

---

## Director-shaped checklist (must stay true)

- [ ] Full settlement visible, no zoom  
- [ ] Fog subtle; no black rings / shadow boxes  
- [ ] Workers small, sparse, sim-accurate, no clipping  
- [ ] Buildings approach artboard silhouettes  
- [ ] Reads as premium management-board craft (AAA *quality*), ancient-river *identity*  
- [ ] Judge overall ≥ 8.0, min ≥ 6.0  

---

## Tools

Playwright · Blender (one owner) · approved boards · image_gen only for revise · context7 · fi-html-game / fi-judge discipline  

**Start:** Verify standard view + kill shadow stamps + worker scale/count, then board-matched structure climb + judge loop.
