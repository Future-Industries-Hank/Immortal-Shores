# PROMPT 01.9 — Art Storyboard (mandatory style-guide gate)

### Immortal Shores · Phase 1.9 · Director yes/no on inspiration boards  
### FI skills: `fi-art-storyboard` + `fi-html-game`

> **Purpose:** Lock look targets **before** multi-round visual loops (so you never “discover” at R10 that buildings should not be squares).  
> **Boards are not final assets** — style guide + inspiration only.  
> **Status for this repo:** Inspiration boards already exist under `docs/visual-inspiration/` (Imagine, 2026-08-02). **Director must still Yes/No them** (or revise) and write approval.

---

## Mission

1. Open `docs/visual-inspiration/README.md` and every JPG.  
2. Open or seed `ART-STORYBOARD-REVIEW.html` (copy from FI pack-kit if missing) with the inventory table.  
3. **Stop for the director** — each required board: **Yes · No · Revise**.  
4. On Revise/No: regenerate that board only; re-review.  
5. When all required are Yes → write `ART-STORYBOARD-APPROVED.md` and set `art_storyboard_approved: true` in `ai_manifest.json`.  
6. Only then allow Prompt 02.7 / visual overhaul loops to treat boards as **binding craft targets**.

If boards are missing for a hero kind, generate them with image_gen using STYLE-CONTRACT, then review.

---

## Required slots (Immortal Shores)

| ID | Board | Guides |
|---|---|---|
| S01 | `settlement/10-settlement-money-shot.jpg` | Full composition |
| B01 | `buildings/01-great-house.jpg` | `great_house` |
| B02 | `buildings/02-market.jpg` | `market` |
| B03 | `buildings/03-mudbrick-yard.jpg` | `mudbrick_yard` |
| B04 | `buildings/04-harbor-pier-barge.jpg` | `harbor` + barge |
| B05 | `buildings/05-training-grounds.jpg` | `training_grounds` |
| B06 | `buildings/06-shrine.jpg` | `shrine` |
| B07 | `buildings/07-luxury-works.jpg` | luxury works |
| B08 | `buildings/08-emmer-field.jpg` | `emmer_field` (+ clay/reed analogy) |
| B09 | `buildings/09-ration-house.jpg` | `ration_house` (+ shop analogy) |

---

## Relationship to other prompts

| Prompt | After 1.9? |
|---|---|
| 01 / 01.5 playable + systems | May run without 1.9 (placeholders) |
| 02 / 02.5 / 02.6 visual loops | **Should have had 1.9 first** — now gate recovery |
| **02.7 restart from boards** | Requires approved (or director-confirmed) boards |

---

## Done

- [ ] Review HTML decisions exported or recorded  
- [ ] `ART-STORYBOARD-APPROVED.md` present  
- [ ] `ai_manifest.json` → `art_storyboard_approved: true`  
- [ ] Rejected directions listed under Forbidden in STYLE-CONTRACT if needed  
