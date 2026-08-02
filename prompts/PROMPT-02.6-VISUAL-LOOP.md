# PROMPT 02.6 — Visual Loop Until ≥ 8/10 (NO EARLY EXIT)

### Immortal Shores · Continuation after 02.5 honest FAIL at 4.8  
### Supersedes “stop after 6 rounds” language in Prompt 02.5

> **Status of 02.5:** `PROMPT-02.5-COMPLETE.md` recorded **HONEST FAIL · 4.8/10**. That is **not** permission to stop working.  
> **This prompt:** Keep iterating **until** an independent judge scores **overall ≥ 8.0** and **every category ≥ 6.0**.  
> **Do not ask the director for permission to continue.** Continuing is the job.  
> **Do not** mark complete, write a victory note, or idle after a FAIL score.

---

## Why you are here

A previous pass stopped after 6 judge rounds at **4.8 overall**. The director rejected stopping.  
**Stopping below 8/10 is a process failure**, not integrity.

Integrity still means: **never fake a PASS**.  
Integrity does **not** mean: stop iterating and wait.

---

## Non-negotiable loop (run forever until gate)

```
while true:
  1. Capture evidence (Playwright) of money-shot + weak categories
  2. Independent judge scores 10 categories (0–10)
  3. if overall >= 8.0 AND min(category) >= 6.0:
        write PROMPT-02.6-COMPLETE.md with PASS
        break
  4. Take the judge’s worst 3 categories
  5. Implement concrete fixes that change PIXELS in those categories
  6. Re-capture (same angles/TOD as before for comparison)
  7. Append PROGRESS-VISUAL.md (score trend must not stall 3 rounds without strategy change)
  8. goto 1
```

### Forbidden exits

You **may not**:

- Stop because “rounds are exhausted”  
- Stop because “honest FAIL is integrity”  
- Stop to “wait for the director to say the word”  
- Declare done with score &lt; 8  
- Only write docs without a visual delta  
- Soften the bar to match current quality  

### Only allowed pauses (must still leave a running plan)

| Situation | Action |
|---|---|
| **True tool blackout** (no Playwright AND no other capture; Blender dead and no mesh path) | Write `VISUAL-BLOCKED.md` with exact missing tool + how to fix; leave next-step queue; **resume when tool returns in same session if possible** |
| **Session token/time hard limit** from host | Commit WIP + `PROGRESS-VISUAL.md` with **next 5 concrete pixel tasks**; next session continues from that list without re-priming excuses |
| **Mechanics regression** | Fix mechanics first (small), then resume visual loop |

“I’m tired of looping” / “diminishing returns” / “good enough for browser” = **not** valid.

---

## Gate (unchanged, still hard)

| Metric | Required |
|---|---|
| Overall (mean of 10 categories) | **≥ 8.0** |
| Minimum category | **≥ 6.0** |
| Reads as non-placeholder | Judge must say world no longer reads as early kit/candy pads |
| Performance | ~60 fps class on Med/High desktop worstCase |

Categories (same as 02.5): Ground & river · Structures · Lighting · Depth · Materials · Life & motion · Atmosphere · UI/HUD · Cohesion · Performance.

### Quality benchmarks (craft only — do not copy setting)

- **Surviving Mars / Aven Colony** → env coherence, modular silhouette readability, HUD over 3D  
- **IXION / Frostpunk 2** → premium panel materials, soft edge light, dense management polish → **papyrus/ink skin**  
- **Oxygen Not Included** → readout clarity / info density  

Theme stays **eternal river / mudbrick / reeds** — unique. Never sci-fi colony clone.

---

## Strategy ladder (stop thrashing)

Do **not** sprinkle tiny tweaks across everything each round. Force a **focus stack**:

### Stack 1 — Money shot (until day mid-iso ≥ 7 alone)

One frame: **settlement, day, mid isometric**, no junk UI except resource strip.

Until judge or self-review says this single frame is **≥ 7/10**:

1. Ground/river massing (banks, reeds, water depth, multi-scale sand)  
2. Contact shadows + one coherent sun  
3. Replace remaining box heroes (GH, Market, fields, one shop) with real silhouettes/materials  
4. Kill candy empty pads → proper pad markers that still show Shop/Special/Training  

**Do not** spend rounds on cosmetics catalog or world-map flourish until Stack 1 holds.

### Stack 2 — Empty world → living shore (until Structures + Ground both ≥ 7)

- Full building kit fidelity (all kinds)  
- Harbor pier, training, luxury, warehouse, shrine readable  
- Workers staggered + barge motion  
- Night emissives  

### Stack 3 — Premium HUD + cohesion (until UI ≥ 7 and Cohesion ≥ 7)

- IXION-like materials in **papyrus** language  
- ONI-like density/clarity for production overlay / warnings  
- No default browser chrome  

### Stack 4 — Full scorecard to 8.0

Sweep remaining categories; artifact hunt; worstCase fps.

**If scores stall** (overall improves &lt; 0.3 across 2 full judge cycles): change strategy (e.g. full Blender re-author of hero set; rebuild lighting from zero; replace ground shader). Do not repeat the same “slightly bigger sand” fix.

---

## Mandatory work per iteration

Each loop **must** include:

1. **Pixel-changing code or assets** (glTF, materials, shaders, UI CSS/canvas — not only markdown)  
2. **New screenshots** overwriting or versioning `tools/judge/evidence/gauntlet-02.6/R{n}/`  
3. **Judge file** `JUDGE-R{n}.md` with full score table  
4. **Fix list** taken from that judge (top 3) implemented before next judge  

Builder may self-critique mid-loop but **PASS/FAIL for completion** only from independent judge subagent.

---

## Tools (use them; re-probe if broken)

| Tool | Role |
|---|---|
| **playwright** | Capture every iteration |
| **blender** | Mesh kit (single owner lane) |
| **scenario / Hyper3D / Hunyuan** | Accelerate meshes |
| **image_gen** | UI icons / material boards |
| **context7** | Babylon lighting/perf |
| Skills | `fi-visual-overhaul`, `fi-graphics`, `fi-judge`, `game-asset-core`, `game-ui-icons` |

If Blender is the bottleneck: **queue all Blender work**, do lighting/ground/UI in parallel tracks, but **do not stop the loop**.

---

## Mechanics fence

Still frozen: GDD rates, 5/4/3 plots, trust trade, no P2W.  
`npm run test -w @immortal/server` must stay green after visual changes.

---

## Resume from 02.5 FAIL (start state)

Read:

- `PROMPT-02.5-COMPLETE.md` (4.8 FAIL, what was built)  
- `tools/judge/evidence/gauntlet-02.5/JUDGE-R6.md` (named weaknesses)  
- `VISUAL-READY.md`  

Assume baseline is **4.8**, not zero. **Do not re-run a 6-round then stop protocol.**

Start Stack 1 immediately: money-shot day mid-iso.

---

## Done (only)

Write `PROMPT-02.6-COMPLETE.md` **only** when judge overall ≥ 8.0 and min ≥ 6.0, with evidence paths and score table.

Until then: **keep looping.** No “say the word.” No silent background — active iterations until gate.
