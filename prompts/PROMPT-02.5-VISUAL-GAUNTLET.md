# PROMPT 02.5 · GOAL — Visual Overhaul Gauntlet (8/10 bar)

### Immortal Shores · Brutal graphics pass · After primer GO only

> **Prerequisite:** `VISUAL-READY.md` with **GO** from `PROMPT-02.5-PRIMER-READINESS.md`.  
> **Prior art:** Prompt 02 shipped minor gains; director rates ~**1.5/10**. That is a **FAIL**. This pass is not done until **≥ 8/10**.  
> **Fence:** Rendering, assets, lighting, animation, atmosphere, UI chrome, map art **only**. **No** GDD rate/plot/economy/trust-trade changes. No P2W.  
> **Do not ask the director questions.** Infer, build, capture, judge, iterate.

---

## Mission

Make Immortal Shores look like a **premium browser isometric management game** in its **own** eternal-river / mudbrick identity — not a tech demo of boxes.

You will use commercial titles as **quality benchmarks only**. You will **not** copy their sci-fi/ice settings, layouts, labels, or UI arrangements.

### Quality benchmarks (craft bar — do not mimic content)

| Title | Quality to match (translated into our theme) |
|---|---|
| **Surviving Mars** & **Aven Colony** | Coherent environment (dust/heat/sand for *us*), modular readable buildings, high-angle clarity, HUD that feels designed to sit on 3D |
| **IXION** & **Frostpunk 2** | Premium panel materials (for *us*: dark papyrus glass / ink, soft edge light, restrained accents — gold/teal not neon sci-fi), dense management polish |
| **Oxygen Not Included** | Status/readout clarity and information density without clutter |

**Anti-goals:** Reskin of current boxes; “good enough for browser”; stopping after one material tweak; claiming PASS without side-by-side honesty.

---

## Absolute stop condition

You may **not** mark complete until:

1. An **independent judge subagent** scores the game **≥ 8.0 / 10 overall** (mean of category scores below), **and**  
2. No category is below **6.0**, **and**  
3. Judge states the game no longer reads as “placeholder / early procedural,” **and**  
4. Side-by-side: our frames vs reference **quality** (screenshots of benchmarks or clear memory of craft bar) — **not** style matching.  

**Forbidden:** Softening the bar, redefining 8 as 4, negotiating with the judge, or counting UI-only polish as full 8/10 if the 3D world is still boxy.

If rounds exhaust without 8/10: write honest FAIL + structural cause (e.g. “no mesh pipeline”) — do not ship fake PASS.

---

## Category scorecard (judge uses this)

Score each **0–10**. Target overall ≥ 8; floor 6 per category.

| # | Category | 8/10 means (Immortal Shores) |
|---|---|---|
| 1 | **Ground & river** | Banks, reeds, wet edge, depth in water, no obvious tile stamp |
| 2 | **Structures** | Every building identifiable by silhouette; mudbrick/stone/reed materials; Harbor pier real; no candy cubes |
| 3 | **Lighting** | One sun, contact shadows, dusk/night emissives, no banding, coherent bounce |
| 4 | **Depth / staging** | Contact with ground, occlusion, atmospheric distance on map/settlement |
| 5 | **Materials** | Metal/clay/cloth/water/crops distinct without color (grayscale test) |
| 6 | **Life & motion** | Workers staggered, workshops alive, barges move; nothing fully dead |
| 7 | **Atmosphere** | Heat haze/dust/soft fog **subtle** and themed — not generic bloom soup |
| 8 | **UI / HUD** | Premium panels (IXION-like material language, papyrus/ink skin), ONI-like readout clarity; icons coherent |
| 9 | **Cohesion** | One ancient-river thesis; no sci-fi chrome bleed; no mixed fidelity |
| 10 | **Performance** | ~60 fps worstCase mid-high; no particle death; quality tiers still work |

Overall = mean of 10. **Complete only if overall ≥ 8.0 and min ≥ 6.0.**

---

## Technical constraints (still)

- TypeScript + Vite + **Babylon.js isometric orthographic**  
- WebGPU primary / WebGL2 fallback; Low/Med/High tiers  
- First-party assets only (Blender / Scenario / code / Imagine → committed)  
- No Unity/Godot pivot; no asset-store dumps  
- Keep 5 shop / 4 special / 3 training plot layout readable  

### MCP / skills (use aggressively)

| Resource | Role |
|---|---|
| **playwright** | Continuous capture; before/after; mobile; frame sheets |
| **blender** | Building kit, LODs, barges, props — **one agent owns Blender** |
| **scenario** / Hyper3D / Hunyuan (via Blender) | Mesh ideation → cleanup → export glTF |
| **context7** | Babylon materials, shadows, performance |
| **image_gen / image_edit** | UI icon set, banners, material concept boards |
| Skills | `fi-visual-overhaul`, `fi-graphics`, `fi-judge`, `game-asset-core`, `game-ui-icons`, `game-animation-frames` |

If a tool dies mid-run: log to `VISUAL-READY.md` addendum; degrade plan honestly; do not silently ship 3/10.

---

## Execution protocol

### Phase A — Strip placeholder lie

Inventory every draw path that is still a colored box or unlit primitive. List in `PROGRESS-VISUAL.md`.  
**Rule:** No building type may ship at “box with emoji” fidelity at end of pass.

### Phase B — Environment first (biggest quality jump)

1. River left: volume, foam line, color depth, bank geometry.  
2. Ground: multi-scale sand/soil, field crops, reed beds.  
3. Lighting rig: day / golden / night; contact shadows; IBL or sky.  
4. Empty pads: **icon + color** by Shop / Special / Training (readable limited slots).

### Phase C — Building kit (modular, themed)

Produce a **consistent kit**: Great House tiers, Market, fields, clay/reed, shops, warehouse, shrine, harbor+pier, training, luxury works.  
Silhouette-first; shared mudbrick material language; LODs for density.  
Surviving Mars / Aven lesson: **modular readability**, not their sci-fi meshes.

### Phase D — Life

Worker proxies with phase-staggered walks; workshop loops; barge dock motion.  
Prefer instancing + cheap animation over 1k unique skinned meshes if perf demands.

### Phase E — HUD / chrome (premium management sim)

Translate IXION/Frostpunk **materials** into **papyrus dark-glass + soft rim light + gold/teal accents**.  
ONI lesson: production overlay, ration warnings, timers — **legible under stress**.  
Do **not** copy their panel layouts or labels.

### Phase F — Capture & artifact hunt

Frame sheets: day/dusk/night, pan/zoom, placement, overlay on, trade UI, map, mobile.  
Kill: seams, z-fighting, banding, popping, aliasing, flat lighting, dead idle, UI default browser look.

### Phase G — Independent judge loop

1. Spawn **new** judge subagent with **no** builder self-praise in context.  
2. Provide evidence pack + benchmark craft instructions (quality only).  
3. Require numeric scorecard (categories + overall).  
4. If overall < 8 or any category < 6 → fix the **named** failures → re-capture → re-judge.  
5. Max **6** judge rounds this gauntlet. If still < 8: honest FAIL + what would unlock 8 (tools, time, scope).  

**Integrity:** Builder may not edit judge criteria. Factual rebuttal with new screenshots only.

---

## Evidence pack (required)

`tools/judge/evidence/gauntlet-02.5/`

- `00-baseline/` (from primer)  
- `settlement-day.png`, `settlement-dusk.png`, `settlement-night.png`  
- `hud-dense.png` (overlay + resources + one panel)  
- `map.png`, `mobile.png`  
- `buildings-close.png` (silhouette sheet if possible)  
- `JUDGE-R{n}.md` each round with scores  
- Performance note: fps in worstCase  

---

## Done criteria

Write `PROMPT-02.5-COMPLETE.md` only when:

- [ ] Judge overall **≥ 8.0**, min category **≥ 6.0**  
- [ ] Mechanics fence intact (spot-check rates/plots/trade still work)  
- [ ] 60 fps class maintained on Med/High desktop  
- [ ] Evidence pack committed or linked  
- [ ] `ai_manifest.json` visual notes updated honestly  

If director previously accepted a fake PASS at ~1.5/10 quality, **this document supersedes it**. That PASS is void for shipping pride.

---

## Start order (after primer GO)

1. Confirm `VISUAL-READY.md` GO  
2. Baseline scores in PROGRESS-VISUAL.md  
3. Environment + light (B)  
4. Building kit (C) — Blender lane first  
5. Life + HUD (D–E)  
6. Capture → judge → iterate until 8/10  
7. COMPLETE note  

**Mindset:** You are not “improving slightly.” You are replacing the visual product until a cold judge calls it **eight**.
