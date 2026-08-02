# DIRECTOR PLAY PASS — Immortal Shores (02.8 / 02.9 Step 3)

**Date:** 2026-08-02  
**Fence:** Economy / plots / trust-trade frozen  
**Law:** Approved storyboard + approved standard view (no map edge)

## Checkboxes

| # | Requirement | Status |
|---|---|---|
| 1 | Fixed board camera (full settlement, no wheel zoom) | ✅ |
| 2 | Player cannot see hard map edge (vast sand + sand clear color) | ✅ |
| 3 | Fog = subtle heat only (not soup; density ≤ ~0.016) | ✅ |
| 4 | Workers sim-driven (no forced 14–26 crowd); soft max 4–8 | ✅ |
| 5 | Workers tiny scale (~0.42) vs buildings | ✅ |
| 6 | No black ring mesh stamps under buildings (`shadowBlob` no-op) | ✅ |
| 7 | No kitLoader contact disc + rake shadow boxes | ✅ |
| 8 | No worker foot shadow boxes | ✅ |
| 9 | Pad rims sand-toned thin (not thick black rings) | ✅ |
| 10 | Buildings / pads / desert are heroes; people accents | ✅ |
| 11 | Server tests green | ✅ (run at ship) |

## Worker note

Visible agents ≈ `min(softMax, max(1, settlement.workers))` with softMax by quality (4/6/8).  
Board-approval mode still caps at 1–2 for scale checks.

## Captures

- `tools/judge/evidence/standard-view/STANDARD-VIEW-DAY.png`  
- Re-check after edge + craft: open `http://127.0.0.1:5173/?board=1`

## Residual (optional later)

- Pathing fully constrained to road graph only (promenade may still clip mass)  
- Blender re-author if heroes still read as boxes vs boards  

## Verdict

**Director play pass presentation layer implemented** under approved POV + no map edge.
