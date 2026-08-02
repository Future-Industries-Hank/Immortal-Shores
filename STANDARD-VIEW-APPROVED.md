# STANDARD VIEW APPROVED — Immortal Shores

**Date:** 2026-08-02  
**Prompt:** 02.9 Step 2  
**Capture:** `tools/judge/evidence/standard-view/STANDARD-VIEW-DAY.png`

## Director answers

| Question | Answer |
|---|---|
| **(A)** Perspective / angle OK? | **Yes** |
| **(B)** Building size vs person size OK? | **Yes** |
| **(C)** Whole play area visible without zooming? | **Yes** |

## Condition (implemented)

> “Yes this looks good just make sure the player cant see the map edge.”

**Done:**

- Vast continuous ground (160×140) + outer sand skirt (220×200)
- Day clear color matches desert sand (`#C4B490`) — no blue void fringe
- Removed vertical far-edge “wall” plate
- Fixed board camera remains law (`prepareStandardBoard` is default)

## Camera lock (product)

- High classic isometric full-board framing  
- No wheel zoom / free orbit  
- Open: `http://127.0.0.1:5173/` or `?board=1` for labeled capture  

## Next

**Step 3** craft (02.8 director play issues) may proceed with this view as law.
