# PROMPT 02 — Immortal Shores: Visual & Production Gauntlet

### Future Industries · Final visual goal  
### Run only after Prompt 01 **and** Prompt 01.5 are complete

> **Phase:** 2 of 3 (final)  
> **Prerequisites:**  
> - `PROMPT-01-COMPLETE.md` (playable core — baseline `9f0479d`+)  
> - `PROMPT-01.5-COMPLETE.md` (2026 systems: trust trade, PWA, onboarding, QoL)  
> **Fence:** Rewrite **rendering, assets, lighting, animation, atmosphere, UI chrome, map presentation** — **do not** change GDD rates, plot counts, economy math, or reintroduce escrow/P2W.  
> **Do not ask questions.** Push until the impartial judge PASSes.

---

## Mission

Immortal Shores **plays** and has **2026 product systems**. Your job is to make it **mind-blowing** visually — high-end isometric river-empire presentation that holds up next to commercial strategy titles — while preserving **60 fps**, practical loads, and the soul of limited-plot mudbrick shores.

Read first:

| Doc | Role |
|---|---|
| `PROMPT-01-COMPLETE.md` / `PROMPT-01.5-COMPLETE.md` | Run instructions, visual debt |
| `docs/MODERN-2026.md` §1 Visual + §2 spatial composition | Presentation requirements |
| `docs/STYLE-CONTRACT.md` | Thesis, palette, UI language |
| `docs/BUILD-CONTEXT.md` | visualReference, antiReference, worstCase, transitions |
| `docs/GDD.md` | Mechanics frozen |
| `docs/REV1-REVIEW.md` | Rev 1 visual debt list |

---

## Architecture constraints (do not break)

- TypeScript + Vite + Babylon.js **isometric orthographic**  
- WebGPU primary / WebGL2 fallback; quality tiers  
- Server remains economy authority; trust trade model from 01.5  
- Original first-party assets only (code, shaders, Blender/Scenario → committed)  
- No marketplace dumps; no tracing commercial art into ship  
- **No** extra plots, speed-ups, or pay-to-win cosmetics that grant power  

### Tools / MCPs

| Tool | Use |
|---|---|
| **playwright** | Frame sheets, multi-angle, UI, mobile layouts |
| **blender** | Buildings, props, barges, LODs, glTF (**single agent owns Blender**) |
| **scenario** | Style-locked singular concepts → implement systematically |
| **context7** | Babylon materials / post / perf |
| **image_gen / image_edit** | Icons, banners, UI set → in-engine |
| Skills | `fi-visual-overhaul`, `fi-graphics`, `fi-judge`, `fi-audio`, Grok game-asset skills |

---

## Visual goals (Immortal Shores thesis)

Eternal river civilization: sun-baked mudbrick, pale stone, green reeds, deep blue water, soft gold prestige.

Maximize:

1. **Spatial readability** — river left; fields by water; GH+Market center; 5 shops; 4 special with Harbor pier; 3 training outer; generous spacing (MODERN-2026 §2).  
2. **Empty plot clarity** — color + icon by Shop / Special / Training; instant limited-slot literacy.  
3. **High-contrast isometric kit** — silhouettes readable at a glance; contact shadows.  
4. **Materials** — mudbrick vs stone vs crops vs water distinguishable in grayscale.  
5. **Lighting** — one coherent sun; warm day; dusk; night emissives on GH/workshops.  
6. **Life** — phase-staggered Workers; workshop loops; barge motion and river foam.  
7. **Atmosphere** — subtle heat haze / dust / soft river fog (not muddy).  
8. **Day/night** continuous.  
9. **UI chrome** — papyrus/ink production values; trade cards; Tablet Wall; Harbor load UI; production overlay legibility.  
10. **World map** — beautiful river curve, province bands, monument/ancestral markers.  
11. **Accessibility presentation** — dark mode + color-blind-safe resource/plot cues (from 01.5 hooks, polish visuals here).  
12. **Monument / Legacy feedback** — active bonus readouts feel premium.

Preserve: **60 fps** in worstCase; progressive load; dual input; quality tiers under thermal pressure.

---

## Capture & artifact hunt

Frame sheets across:

- Settlement low / mid / high iso  
- Pan/zoom  
- Day → dusk → night  
- Empty pad hover + place building  
- Worker assign feedback  
- Production overlay on/off  
- Market / Tablet Wall / barge ETA UI  
- Tutorial key beats (if still visible)  
- World map + province  
- Mobile portrait panels  
- Dark mode + color-blind palette check  

**Eliminate by name:** seams, z-fighting, banding, popping, aliasing, lighting errors, texture issues, shimmer, effect FPS drops (see classic FI artifact table).

---

## Goal verification — impartial judge (non-negotiable)

Create an **independent judge subagent**. Builder does not grade own work.

### Mandate

1. FI **`JUDGE-RUBRIC.md` categories** adapted to **isometric city-empire** — binary PASS/FAIL.  
2. Side-by-side against **Anno 1800/2205**, high-end isometric historical city/empire, polished browser strategy — **not** free-roam Skylines as primary fantasy.  
3. Located criticism (shot, frame region, fix class).  
4. Verdict table form; `OVERALL: PASS` only if every category passes.

### Integrity

- Complete only on judge **OVERALL: PASS**.  
- Forbidden to soften criteria.  
- **5 blocking rounds** (Production tier). Exhausted → honest FAIL in `ai_manifest.json`.  

### Evidence

`tools/judge/evidence/` — multi-angle, TOD cycle, placement, trade/mail UI, map, mobile, worstCase, fps note.

---

## Protocol

1. Confirm 01 + 01.5 complete; smoke loop still plays; trust trade still works.  
2. Inventory draw paths; overhaul plan without touching sim math.  
3. Parallel tracks (mesh, materials, UI, map, VFX); Blender single-owner.  
4. After each major pass: 60 fps + complete loop + plot limits intact.  
5. Judge → fix → re-judge within round budget.  
6. On PASS: `visual_tier_achieved: 3`, `PROMPT-02-COMPLETE.md`, dashboard update.

---

## Done criteria

- Judge **OVERALL: PASS**  
- GDD rates + 5/4/3 plots + trust trade unchanged  
- 60 fps worstCase measured  
- Evidence pack on disk  
- `PROMPT-02-COMPLETE.md` with run notes and before/after  

Push hard. Do not stop until the judge approves.
