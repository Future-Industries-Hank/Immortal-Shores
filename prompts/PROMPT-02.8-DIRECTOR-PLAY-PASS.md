# PROMPT 02.8 — Director playtest pass (camera, fog, workers, presentation)

### Immortal Shores · After R17 “provisional 8.0”  
### Source: real director play on `9775230` — **not** judge self-scores

> **Context:** Judge R17 claimed overall 8.0 and paused for review. Director played the game. Feedback below **overrides** judge celebration.  
> **Fence:** Economy / plots / trust-trade frozen. Keep approved building craft if good; **fix presentation layer**.  
> **Boards:** `docs/visual-inspiration/` still style targets for buildings — director likes building detail and desert setting.

---

## Director feedback (binding)

| Issue | What director sees | Root cause (code) |
|---|---|---|
| **Too much fog** | Scene washed / atmosphere heavy | `atmosphere.ts` EXP2 fog density ~0.056–0.062 — **too aggressive** |
| **Wheel changes fog** | Zoom in/out seems to thicken/thin fog | `ArcRotateCamera` radius 18–55 + EXP2 fog = density feels zoom-linked; **also wrong product** (see fixed camera) |
| **People ≈ building size** | Workers dominate frame | `spawnWorker`: body height ~1.4+ and **`root.scaling.setAll(1.18)`** — way too large vs glTF buildings |
| **Ghost through buildings** | Walk through walls | Pathing is free promenade polyline; no occlusion / plot avoidance |
| **Too many people** | Crowd not tied to economy | `syncWorkers`: **forces 14–26 agents** for “life stills” (`cap` by quality), **ignores real worker count** |
| **Zoomable “play map”** | Feels like navigable 3D, not a board | Camera attachControl + zoom radius limits |
| **Too zoomed in / people focus** | Misses whole shore | Money-shot radius ~24–32, workers oversized and dense |

### What director likes (do not burn)

- Building models detailed / improved  
- Few plots — sparse layout is correct  
- Plots look nice  
- Desert / river setting vibe is good  

**Thesis for this pass:** A **static, fully framed settlement portrait** — decoration + readable economy board — not a city sim you fly through.

---

## Product presentation model (lock this)

```
Settlement view = one fixed orthographic board
  - See ALL plots at once (small play area)
  - NO mouse-wheel zoom
  - Optional: very gentle pan OR none (prefer none for V1 presentation)
  - Buildings and empty pads are the heroes
  - Workers are sparse accents matching real assigned/total workers
  - Fog = light desert heat only, not a zoom toy
```

World map remains separate UI (SVG/map panel) — settlement 3D is **not** an open world.

---

## Required fixes (implement all)

### 1. Camera — fixed settlement board

- Detach zoom: **disable wheel zoom** on settlement camera (`inputs.attached.mousewheel` off or `upperRadiusLimit = lowerRadiusLimit = fixed`).  
- Pick **one** framing that shows river + all pads (GH, market, 5 shops, specials, training) with margin — slightly **wider** than current money-shot (director: too zoomed).  
- Start values to try: ortho framing that fits layout extents of `SETTLEMENT_PLOTS` + river left; radius/ortho such that nothing important is cropped.  
- Remove “playable free orbit” feel; beta/alpha fixed or only tiny limits.  
- Document framing in `moneyShot.ts` / scene as `SETTLEMENT_BOARD_CAMERA`.

### 2. Fog / atmosphere — calm heat, not soup

- Cut EXP2 density **hard** (order of magnitude toward subtle: e.g. ≤ ~0.012–0.02 or switch to linear fog with distant far plane only).  
- Fog must **not** be a primary “depth hack” that requires zoom to read.  
- Prefer: mild haze on far sand only; clear mid-settlement.  
- Day/dusk/night still work; night emissives stay.

### 3. Workers — scale, count, pathing

**Count (binding):**

```text
visibleWorkers = f(settlement.workers, assignments)
  - Prefer: count of assigned workers (sum of building.workers), or total workers, capped for perf
  - Cap soft max ~6–10 on High only if real count is higher; NEVER invent 14–26 for stills
  - If 0 assigned, show 0–2 idle near GH only (or none)
```

Remove the R16-era line that forces `cap` 14/20/26 for “readable crowd in stills.”

**Scale (binding):**

- Human height ≈ **0.35–0.55 world units** relative to current building kits (visually ~⅓–½ door height, not building height).  
- Drop `scaling.setAll(1.18)`; retune mesh sizes.  
- People must **not** dominate the money-shot.

**Pathing (binding):**

- Routes only on road/path nodes / pad edges — **not through building AABBs**.  
- Simple: stay on `PATH_NODES` / road graph; if inside a building footprint, push out.  
- Optional: lower opacity when overlapping a building is a hack — prefer not needed if paths are correct.  
- No ghosting through Great House / Market / shops.

### 4. Composition priority

Frame order of visual importance:

1. **Plots + buildings + river + desert**  
2. UI chrome  
3. Sparse workers as life accents  

If stills for judge crop people as the subject, framing is wrong.

### 5. Keep / don’t regress

- Building glTF detail, desert palette, plot markers, pier/harbor if good  
- Inspiration boards still guide silhouettes — do not re-box buildings  
- 60 fps on Med; fewer workers should **help** perf  

---

## Explicit non-goals this pass

- Another full judge climb on atmosphere categories alone  
- Claiming 8/10 while director issues above remain  
- Adding more particles/mist/foam to “sell depth”  
- Zoom-as-feature  

---

## Acceptance (director-shaped, not vanity scores)

Write `DIRECTOR-PLAY-PASS.md` with before/after and checkboxes:

- [ ] Full settlement visible at default view without scrolling zoom  
- [ ] Mouse wheel does **not** zoom (or zoom disabled) and does **not** change fog feel  
- [ ] Fog is subtle; plaza/buildings readable  
- [ ] Worker count tracks sim (screenshot + numbers from settlement.workers / assignments)  
- [ ] Workers clearly smaller than buildings; not the focus of the frame  
- [ ] No walking through solid buildings on a 10s watch  
- [ ] Playwright: `settlement-board-day.png` full board; close-ups optional  

Only after those, optional independent scorecard — **director list above is the gate**.

---

## Suggested code touch list

| File | Change |
|---|---|
| `apps/client/src/render/scene.ts` | Camera lock; `syncWorkers` count; worker scale; pathing |
| `apps/client/src/render/moneyShot.ts` | Wider fixed board framing |
| `apps/client/src/render/atmosphere.ts` | Fog density cut / mode |
| Worker path assign | Road graph only |

---

## Start order

1. Read this file + R17 day still vs director notes.  
2. Fix **camera lock + wider frame**.  
3. Fix **worker scale + count from sim**.  
4. Fix **pathing / no clip**.  
5. Fix **fog**.  
6. Capture board stills; fill `DIRECTOR-PLAY-PASS.md`.  
7. Do **not** resume R18 atmosphere climb until director list is green.
