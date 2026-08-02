# PROMPT 02.7 — HARD RESTART: Buildings From Inspiration Boards

### Immortal Shores · Visual reset · Boxes are not buildings  
### Supersedes thrash-loops that polish sand while structures stay cubes

> **Director fact (non-negotiable):** After R10 the **live game still reads as square/box buildings**.  
> Judge scores that put **Structures at 6–7** while the money-shot is cubes are **invalid for completion**.  
> **You will restart structure craft from `docs/visual-inspiration/`**, not from “slightly better boxes.”

---

## Mission

1. **Stop** micro-tweaking atmosphere/sand as the main progress narrative.  
2. **Open** every file under `docs/visual-inspiration/` (README + all JPGs).  
3. **Re-author in Blender** each hero building so the **in-game glTF** matches the board’s **silhouette, massing, and material read** — not a stack of `CreateBox` primitives.  
4. **Prove** with Playwright side-by-side: board vs in-game.  
5. Only after heroes read as real buildings, resume the full 02.6 scorecard loop to **≥ 8.0**.

Economy / plots / trust-trade remain frozen.

---

## Why previous loops failed

| What agents optimized | What the eye saw |
|---|---|
| Night windows, mist, foam, HUD | Cubes with paint |
| Structures self-scored 7 | “Still squares” |
| glTF present in `/models/buildings/` | Still blocky kit / procedural `buildings.ts` boxes dominate |

**Rule:** If a building can be described as “a few boxes with a roof plane,” **Structures ≤ 3** for that frame. Period.

---

## Inspiration boards (starting point — NOT final assets)

**Folder:** `docs/visual-inspiration/`  
**Rules:** `docs/visual-inspiration/README.md`

| Board | glTF target (under `apps/client/public/models/buildings/`) |
|---|---|
| `buildings/01-great-house.jpg` | `great_house.glb` |
| `buildings/02-market.jpg` | `market.glb` |
| `buildings/03-mudbrick-yard.jpg` | `mudbrick_yard.glb` |
| `buildings/04-harbor-pier-barge.jpg` | `harbor.glb` + `barge.glb` |
| `buildings/05-training-grounds.jpg` | `training_grounds.glb` |
| `buildings/06-shrine.jpg` | `shrine.glb` |
| `buildings/07-luxury-works.jpg` | `luxury_material.glb` / `luxury_workshop.glb` |
| `buildings/08-emmer-field.jpg` | `emmer_field.glb` (+ clay/reed siblings by analogy) |
| `buildings/09-ration-house.jpg` | `ration_house.glb` (+ vessel/basket shops by analogy) |
| `settlement/10-settlement-money-shot.jpg` | Full scene composition target |

### How to use boards (allowed / forbidden)

| Allowed | Forbidden |
|---|---|
| Look at silhouette, roof language, pier massing, kiln, colonnade | Import JPG as sprite/billboard |
| Block-out in Blender to match proportions | Trace as final ship mesh without craft |
| Bake/export glTF into `public/models/buildings/` | Claim Structures ≥ 6 while money-shot is boxes |
| PBR mudbrick/stone from STYLE-CONTRACT | Sci-fi / ice colony mimic |

---

## Hard structure gate (before any “overall 8” talk)

### Phase A — Inventory (do first, write `STRUCTURE-RESET.md`)

For **every** `BuildingKind` in the game:

1. Is the on-screen mesh from **glTF** (`kitLoader`) or **procedural boxes** (`buildings.ts` CreateBox path)?  
2. Screenshot one building close-up.  
3. Score honestly: **box / slab / real silhouette**.  
4. List which glTF files need full re-author (expect: most of them).

If procedural box path is still used for heroes when glTF exists: **fix load order / fallback** so glTF always wins once loaded. Prefer deleting or hard-gating box heroes for kinds that have a board.

### Phase B — Blender rebuild (mandatory order)

**One agent owns Blender.** Queue others.

Rebuild **in this order** (money-shot heroes first):

1. `great_house` ← board 01  
2. `market` ← board 02  
3. `emmer_field` + `river_clay_pit` + `marsh_reed_bed` ← board 08 + analogy  
4. `ration_house` + `mudbrick_yard` ← boards 09 + 03  
5. `harbor` + `barge` ← board 04  
6. Remaining shops, `warehouse`, `shrine`, `training_grounds`, luxury ← boards  

**Each building deliverable:**

- [ ] Blender scene or export log  
- [ ] New/updated `.glb` committed under `public/models/buildings/`  
- [ ] Playwright close-up `tools/judge/evidence/gauntlet-02.7/structures/{kind}.png`  
- [ ] Side-by-side note: board vs game (3 sentences: silhouette match, materials, still-wrong)  

**Minimum geometry bar (not optional):**

- Not a single box; not three stacked boxes alone  
- At least: base + wall volume + roof language + one character prop (door, kiln, pier, colonnade, crop rows, racks)  
- Roof edge or eave that breaks the cube outline  
- Footprint matches plot scale  

### Phase C — Money-shot acceptance

Capture settlement day mid-iso (same as Stack 1).

**Reject Structures ≥ 6** unless:

- GH, Market, at least one field, one shop, and Harbor (if visible) are **clearly not cubes** to a cold viewer  
- Composition moves toward board `10-settlement-money-shot.jpg` (river left, spacing, massing)

Write `MONEY-SHOT-CHECK.md`: PASS/FAIL with images.

### Phase D — Only then resume full 8/10 loop

After **MONEY-SHOT-CHECK PASS** (structures honesty):

- Resume `PROMPT-02.6` style loop: fix → capture → independent judge → fix top 3  
- **Overall ≥ 8.0, min ≥ 6.0** still required  
- Independent judge must be told: **if buildings still read as boxes, Structures ≤ 3** regardless of prior inflated scores  

---

## Independent judge instructions (inject every round)

```
You are judging Immortal Shores screenshots only.
If primary buildings read as cubes/slabs/stacked boxes, set Structures ≤ 3
and Materials ≤ 4, even if the code claims glTF. Do not score "intent."
Compare structure craft to docs/visual-inspiration boards when provided.
Gate: overall ≥ 8.0 and min ≥ 6.0.
```

---

## Forbidden this pass

- Calling R11+ “progress” if only mist/sand/HUD changed  
- Raising Structures score without new glTF bytes for that kind  
- Stopping below 8 with honest FAIL after N rounds (use 02.6 no-exit)  
- Using inspiration JPGs as in-game textures for buildings  
- Asking the director whether to continue  

---

## Tools

| Tool | Use |
|---|---|
| **Blender MCP** | Re-author every hero glTF (single owner) |
| **Playwright** | Close-ups + money-shot + side-by-side evidence |
| **Imagine boards** | Already in `docs/visual-inspiration/` — open them |
| **image_gen** | Only if a missing board is needed — prefer existing set |
| **context7** | Babylon glTF load / materials |

If Blender is down: write `VISUAL-BLOCKED.md` and stop claiming structure progress — do not fake box polish as 7.

---

## Done

`PROMPT-02.7-COMPLETE.md` only when:

1. `STRUCTURE-RESET.md` + all hero glTFs re-authored against boards  
2. `MONEY-SHOT-CHECK.md` **PASS** (not boxes)  
3. Independent judge **overall ≥ 8.0** and **min ≥ 6.0** with Structures honesty rule  

Until then: rebuild buildings. Loop. Do not declare almost-done at 6.x with square houses.
