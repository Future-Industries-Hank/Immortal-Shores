# /goal — Graphics ready (DO NOT STOP)

### Immortal Shores · Non-negotiable continuous visual goal  
### Supersedes any “review pause”, “provisional 8.0”, “honest FAIL then wait”, or round budget

---

## /goal

**The settlement must look like a finished, playable product board — not a tech demo.**  
You may **not** stop, pause for permission, declare provisional PASS, or idle while **any** director issue below remains visible in a real browser session.

**Keep working until every acceptance checkbox is TRUE and an independent judge scores overall ≥ 8.0 with min ≥ 6.0 *and* the director checklist is green.**  
If the judge says 8 but the checklist fails, the goal is **not** met — fix pixels and continue.

Economy / plots / trust-trade stay frozen. Approved artboard + fixed full-shore POV stay locked.

---

## You are still FAILING if the director can still see

These are **hard fails**. Do not claim progress while any is true:

| # | Still broken (director) | Done looks like |
|---:|---|---|
| 1 | **Grey / black shadow boxes or rings** under buildings (esp. fields, pits, reeds) | Clean sand; soft real shadows only; **no** mesh black stamps |
| 2 | **Outlines / wire / slab stand-ins** instead of solid buildings | Solid glTF massing with roofs, walls, materials — not edges-only or ghost frames |
| 3 | **Fog soup** / zoom changes atmosphere | Fixed camera, **no wheel zoom**; fog barely there or off at settlement scale |
| 4 | **People size ≈ buildings** | Workers clearly smaller than doors/buildings |
| 5 | **Fake crowd** (dozens of agents) | Worker count tracks **sim**; sparse accents only |
| 6 | **Ghost through buildings** | Paths on roads/pads only |
| 7 | **Too zoomed; people-focused** | **One fixed board** shows entire shore + all pads |
| 8 | **Ignores artboard** | Heroes approach `docs/visual-inspiration/` silhouettes (not JPG imports) |

**If any row is still true → goal incomplete → keep looping.**

---

## Non-stop loop (run forever until gate)

```
while goal_not_met:
  1. Launch game in real browser (Playwright). Capture STANDARD full board.
  2. For each FAIL row above: name the pixel evidence.
  3. Implement code/asset fixes that change those pixels THIS iteration.
     - Prefer deleting fake shadow meshes over tweaking fog numbers.
     - Prefer solid glTF / filled materials over outline/wire densify hacks.
     - Prefer fewer, smaller workers over "life" density hacks.
  4. Recapture same angles. Diff vs previous still.
  5. Independent judge scores 10 categories (structure ≤ 3 if boxes/outlines).
  6. If checklist incomplete OR overall < 8 OR min < 6: go to 1.
  7. Only then write GOAL-GRAPHICS-READY-COMPLETE.md and stop.
```

### Forbidden exits

You **must not**:

- Stop because “review pause” / “await director” / “say the word”  
- Stop because round count hit N  
- Stop because a judge printed 8.0 while checklist items still fail  
- Stop to write long docs without a pixel change  
- Declare COMPLETE with grey boxes, outline buildings, or giant worker crowds  

### Only allowed pause

- **True tool blackout** (cannot run browser or cannot write files) → `VISUAL-BLOCKED.md` with exact fix, then **resume in the same session if possible**  
- Host kills the session → commit WIP + **next 5 pixel tasks** for the next agent; next agent continues **without** re-priming excuses  

---

## Concrete code crimes to eliminate (known)

| Symptom | Likely code | Action |
|---|---|---|
| Black rings / shadow boxes | `kitLoader.ts` contact box + rake bar; `buildings.ts` `shadowBlob`; worker foot box | **Delete** hard black mesh stamps; one soft ShadowGenerator only |
| Outline / ghost buildings | wireframe scaffold, densify wire, failed glTF → empty hit box | Ensure glTF loads; solid materials; no wireframe as “finished” |
| Fake crowd | `syncWorkers` forces 14–26 | Use `settlement.workers` / assigned sum; cap low |
| Giant people | `scaling.setAll(1.18)` + large body boxes | Scale to ~⅓ door height |
| Zoom/fog | `attachControl` + radius range + EXP2 fog ~0.05+ | Lock radius; fog density near zero or off at board distance |

---

## AAA quality bar (craft only — not theme)

While fixing the above, raise craft toward:

- **Surviving Mars / Aven Colony** — readable high-angle board, solid modular buildings  
- **IXION / Frostpunk 2** — premium UI materials (papyrus/ink), not default chrome  
- **Oxygen Not Included** — clear readouts  

**Do not** copy sci-fi/ice art. Identity = mudbrick river from **approved artboard**.

---

## Acceptance (all required)

### A. Director checklist (Playwright proof)

- [ ] `tools/judge/evidence/goal-ready/FULL-BOARD-DAY.png` — entire settlement, no zoom needed  
- [ ] No black rings under emmer/clay/reed/riverside kits  
- [ ] No rectangular grey/black shadow stamps on sand  
- [ ] Buildings solid (not outlines/wire ghosts)  
- [ ] Workers small, few, sim-linked; no clipping through solids  
- [ ] Fog not dominating; wheel does not zoom  
- [ ] Side-by-sides `board-vs-game/` for GH + Market + one field  

### B. Judge

- [ ] Independent subagent: overall ≥ 8.0, min ≥ 6.0  
- [ ] Instructed: boxes/outlines ⇒ Structures ≤ 3; shadow stamps ⇒ Materials/Depth fail  

### C. Ship note

- [ ] `GOAL-GRAPHICS-READY-COMPLETE.md` only when A and B both pass  
- [ ] Server tests green  

---

## Start now

1. Boot game. Capture current board. List which of the 8 FAIL rows are still true.  
2. **This hour:** delete fake shadow meshes + lock camera + fix worker scale/count.  
3. **Next:** solid buildings vs artboard (Blender if needed).  
4. Loop until acceptance. **Do not stop.**
