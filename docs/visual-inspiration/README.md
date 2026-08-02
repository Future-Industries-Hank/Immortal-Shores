# Visual inspiration board — Immortal Shores

**Purpose:** Give the graphics builder a **look-at target** for silhouettes, materials, and settlement composition.  
**Not:** Drop-in game assets. **Not:** textures to paste. **Not:** meshes to reverse-import.

Generated with Grok Imagine (2026-08-02) for Prompt **02.6** after the 4.8/10 stall.

---

## Rules for the builder (mandatory)

1. **Inspire Blender authoring** — block out proportions and silhouette in Blender/glTF to *feel like* these images.  
2. **Do not** ship these JPGs as sprites, billboards, or UI.  
3. **Do not** trace pixel-for-pixel or train/import as final mesh.  
4. **Do** match STYLE-CONTRACT: mudbrick, pale stone, reed green, river deep blue, soft gold prestige.  
5. **Do** keep isometric orthographic readability (unique silhouette at mid zoom).  
6. Economy/plots frozen — art only.

If Blender was only used for thin kit pieces, use these boards to **re-author heroes** (Great House, Market, Harbor, shops, fields) until the money-shot matches the craft bar of `settlement/10-settlement-money-shot.jpg` more than the current in-game capture.

---

## Building sheets

| File | Maps to game kind(s) | Look for |
|---|---|---|
| `buildings/01-great-house.jpg` | `great_house` | Prestige massing, stone + mudbrick, gold lintel, gallery |
| `buildings/02-market.jpg` | `market` | Open colonnade, stalls, awnings, trade activity |
| `buildings/03-mudbrick-yard.jpg` | `mudbrick_yard` | Kiln, clay stacks, industrial ancient craft |
| `buildings/04-harbor-pier-barge.jpg` | `harbor` + barge | Pier into river, warehouse, cargo barge |
| `buildings/05-training-grounds.jpg` | `training_grounds` | Packed earth, racks, butts — not European castle |
| `buildings/06-shrine.jpg` | `shrine` | Pale stone sacred, offerings, calm vertical |
| `buildings/07-luxury-works.jpg` | `luxury_material` / workshop | Specialty craft, ochre/dye/gold detail |
| `buildings/08-emmer-field.jpg` | `emmer_field` | Crop plot, irrigation, shed — not empty green plane |
| `buildings/09-ration-house.jpg` | `ration_house` | Oven/bakery massing, jars, warm kiln |

## Settlement composition

| File | Use |
|---|---|
| `settlement/10-settlement-money-shot.jpg` | **Primary bar** for Stack 1 money-shot: river LEFT, fields by water, GH+Market center, shops right, special inland, training outer, generous sand |

Compare Playwright `settlement-day.png` to this sheet every iteration.

---

## How this pairs with looping

| Approach | When |
|---|---|
| **Blind loop** (no refs) | Tends to stall ~4–6/10 with micro-tweaks |
| **Refs + Blender re-author** | Breaks plateau — silhouette/materials jump |
| **Refs alone without mesh work** | Wasted — images don’t change the Babylon scene |

**Recommended:** Keep 02.6 loop, but each iteration must show Blender/glTF or material changes **measured against these boards**.

```text
Open docs/visual-inspiration/ and README.
Author/improve glTF in Blender to match silhouettes of boards 01–09.
Money-shot must move toward settlement/10-settlement-money-shot.jpg.
Do not import JPGs into the client as final art.
```
