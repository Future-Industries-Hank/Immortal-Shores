# /goal — BUILDINGS FIRST (do not stop)

### Immortal Shores · The main problem is the buildings  
### Fog/workers/shadows are secondary — stop leading with them

---

## /goal (one sentence)

**Every plot building on the settlement board must read as a solid, artboard-quality structure — not an outline, wire ghost, grey slab, or stacked boxes — and you do not stop until a cold viewer agrees and overall craft is ≥ 8/10.**

---

## What needs the most help (PRIMARY — 80% of effort)

Director and play still show: **outlines / ghost frames / non-buildings where real buildings should be.**  
Approved artboards exist. glTF files may exist on disk. **The on-screen result still fails the eye.**

### Primary FAIL (must clear before anything else counts as “ready”)

| Priority | What is wrong | Done means |
|---:|---|---|
| **P0** | Buildings look like **outlines, wireframes, hollow frames, or grey boxes** | **Solid** meshes: filled walls, roofs, readable mass, real materials |
| **P0** | Buildings do **not** match approved artboard silhouettes | Side-by-side: board vs in-game close-up for each hero — same massing language |
| **P0** | glTF “kit” is still a **thin stand-in** (or procedural fallback) | `kitLoader` shows dense authored glTF; no CreateBox hero; no wireframe as finished art |
| **P0** | Empty pads / construction sites look more finished than “buildings” | Built plots clearly beat empty pads in richness |

### Hero list (rebuild until each passes the eye test)

Against `docs/visual-inspiration/buildings/` (and `/storyboard/buildings/`):

1. **Great House** ← `01-great-house.jpg`  
2. **Market** ← `02-market.jpg`  
3. **Emmer field / clay pit / reed bed** ← `08-emmer-field.jpg` (+ analogy)  
4. **Ration house + mudbrick yard** ← `09` + `03`  
5. **Harbor + barge** ← `04-harbor-pier-barge.jpg`  
6. **Shrine, training, luxury, remaining shops** ← rest of boards  

**Per building deliverable (mandatory):**

- [ ] Blender re-author or major densify of the **.glb** (new bytes on disk)  
- [ ] Playwright **close-up** `tools/judge/evidence/goal-ready/buildings/{kind}.png`  
- [ ] **Side-by-side** with artboard: 3 sentences — silhouette match / still wrong / next fix  
- [ ] No outline-only, no pure wireframe, no single-box prim as the whole building  

**Structures score rule for every judge:**  
If the money-shot or close-up still reads as outline/ghost/box → **Structures ≤ 3**. Ignore prior 7–8 structure scores.

---

## Secondary (only after heroes are solid)

Do these **after** P0 buildings pass a director-shaped eye check — not instead of buildings:

| Issue | Fix |
|---|---|
| Black rings / rectangular shadow stamps | Delete kitLoader rake/box shadows, shadowBlob, worker foot boxes |
| Fog soup / wheel zoom | Fixed board camera; fog near zero |
| Workers too big / too many / clip | Small scale; count from sim; road paths only |
| Camera too tight | Locked full-shore standard view |

If you spend an iteration only on fog or worker density while buildings are still outlines → **that iteration is a process fail**. Re-do with a building glTF change.

---

## Non-stop rule

```
while true:
  Capture full board + close-ups of GH, Market, one field, one shop
  if any P0 building still outline/box/ghost:
      Blender-fix THAT building (or load path if glTF not showing)
      commit new glTF / materials
      recapture
      continue   # do not judge overall yet
  Fix any secondary issues still visible
  Independent judge (Structures honesty rule)
  if overall >= 8 and min >= 6 and all P0 eye-checks pass:
      write GOAL-GRAPHICS-READY-COMPLETE.md
      break
  else:
      fix worst buildings first, then other fails
```

### Forbidden

- Stopping for “review pause” / provisional 8 / round budget  
- Leading progress reports with fog/mist/HUD while buildings are outlines  
- Claiming kit complete because `.glb` files exist (must **look** solid in browser)  
- Importing artboard JPGs as final sprites  

---

## AAA quality (craft only)

When buildings are solid, raise materials/light/UI craft toward:

- **Surviving Mars / Aven Colony** — readable high-angle solid structures  
- **IXION / Frostpunk 2** — premium polish (papyrus skin)  
- **ONI** — clear HUD  

Theme stays mudbrick river from **approved artboard**.

---

## Acceptance

1. **Building gallery:** every hero close-up is solid and artboard-adjacent  
2. **Full board still:** entire shore, fixed camera, buildings are the subject  
3. No outline/ghost buildings; no grey shadow-box stamps  
4. Judge ≥ 8.0 / min ≥ 6 with honest Structures  
5. `GOAL-GRAPHICS-READY-COMPLETE.md`  

---

## Start in the next 30 minutes

1. Playwright: full board + close-ups of GH, Market, emmer, mudbrick.  
2. Write `BUILDING-FAIL-LIST.md`: which kinds are outline / box / solid.  
3. **Blender (or force-fix glTF load): Great House first** until close-up is solid vs board 01.  
4. Market second. Field third.  
5. Only then secondary presentation cleanup.  
6. **Do not stop.**
