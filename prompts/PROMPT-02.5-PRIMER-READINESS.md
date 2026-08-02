# PROMPT 02.5 · PRIMER — Visual Gauntlet Readiness Check

### Run **before** the visual gauntlet goal. Do not start art production yet.

> **Purpose:** Prove this session can actually reach **≥ 8/10** visual quality for Immortal Shores.  
> **Output:** `VISUAL-READY.md` — go / no-go, tool matrix, missing deps, plan.  
> **Do not** begin the full overhaul until `VISUAL-READY.md` says **GO** (or the director overrides with known risks).

---

## Context (read first)

| Fact | Detail |
|---|---|
| Game | Immortal Shores — isometric ancient river city/empire (unique theme) |
| Mechanics | Prompt 01 + 01.5 **done** — do not reopen economy/plots/trust trade |
| Prior art pass | Prompt 02 ran once; director scores ~**1.5/10** (was ~1/10). **Insufficient.** |
| Target | **≥ 8/10** under browser + Babylon isometric constraints |
| Style | Eternal Nile / mudbrick / papyrus — **not** sci-fi colony. Benchmarks below are **quality only** |

### Quality benchmarks (NOT style/setting to copy)

Use these for **craft bar only** — materials, lighting discipline, HUD density, industrial modular readability, premium management-sim polish.  
**Do not** mimic sci-fi, ice, or their layouts, labels, or button arrangements. Immortal Shores stays ancient river civilization.

| Benchmark | Steal *quality of* (not content) |
|---|---|
| **Surviving Mars** & **Aven Colony** | Arid/dusty environmental coherence, modular building silhouettes, high-angle readability, HUD sitting cleanly over 3D |
| **IXION** & **Frostpunk 2** | Dark semi-transparent panel materials, soft edge lighting, cool accent restraint, dense premium management-sim polish |
| **Oxygen Not Included** | Information density + clarity of status/readouts (not the cartoon art) |

---

## Step 0 — Inventory tools (mandatory)

List **actually connected** tools this session. Do not assume.

### MCP servers (probe each)

| MCP | Required for 8/10? | Probe |
|---|---|---|
| **playwright** | **Required** | Can open `http://127.0.0.1:5173`, screenshot settlement + HUD + map |
| **blender** | **Strongly required** for 8/10 mesh pass | Scene info / execute code works; single-instance rule |
| **scenario** | Recommended | Model search / generate available |
| **context7** | Recommended | Babylon docs fetch works |
| **gestalt** | Optional | Log decisions |
| **meshy** | Optional accelerator | Often failed handshake — note status |
| **godot** | N/A | Do not pivot engine |

### Built-in / skills

| Tool / skill | Use |
|---|---|
| `image_gen` / `image_edit` | Concept, UI icons, material boards |
| `fi-graphics`, `fi-visual-overhaul`, `fi-judge` | If available in client — load them |
| Grok `game-asset-core`, `game-ui-icons`, `game-animation-frames` | When generating assets |
| `check-work` / `review` | After large diffs |

### Local toolchain

Confirm and record versions/paths:

```text
node -v && npm -v
npm run dev   # or how client+server start
# Blender binary if MCP needs it
# GPU / WebGPU: Chrome available?
```

---

## Step 1 — Baseline the current look (honest)

1. Pull latest `main`, install, `npm run dev`.  
2. Capture **before** frames (Playwright if available):  
   - Settlement day mid zoom  
   - Settlement night  
   - HUD with panels open  
   - World map  
   - Mobile width if possible  
3. Score current art honestly 0–10 on: ground, buildings, lighting, life/animation, UI, cohesion, performance.  
4. Director prior: ~**1.5/10** overall — if you score higher, justify with pixels not hope.

Save to `tools/judge/evidence/baseline-02.5/`.

---

## Step 2 — Gap analysis vs 8/10

For each category, write **what “8” looks like in *our* format** (isometric Babylon browser, mudbrick theme):

| Category | 1–2/10 (current class) | 8/10 target (our theme) |
|---|---|---|
| Ground / river | Flat tint planes | Layered banks, reed beds, wet/dry sand, readable river depth |
| Buildings | Colored boxes / thin kits | Distinct silhouettes, PBR mudbrick/stone, LODs, pier/harbor massing |
| Lighting | Default sun | One sun + sky, contact shadows, dusk/night emissives, no banding |
| Life | Static or sparse | Staggered workers, barge motion, workshop loops |
| UI / HUD | Generic panels | Papyrus/ink **premium** chrome: soft edge light, semi-transparent density, clear readouts (ONI density, IXION materials — ancient skin) |
| Cohesion | Placeholder mix | One thesis: eternal river heat, not sci-fi grey |
| Perf | — | Sustained ~60 fps mid/high on desktop |

---

## Step 3 — Readiness matrix (fill in)

```markdown
| Capability | Status (YES / NO / DEGRADED) | Notes |
|---|---|---|
| Playwright screenshots | | |
| Blender MCP mesh pipeline | | |
| Scenario or Hyper3D/Hunyuan via Blender | | |
| image_gen available | | |
| Chrome + WebGPU or WebGL2 path | | |
| Game boots without economy regression | | |
| fi-judge / vision comparison possible | | |
```

### Hard stop rules

| Missing | Action |
|---|---|
| **No Playwright and no other screenshot eyes** | **NO-GO** for 8/10 judge loop — flag to director |
| **No Blender and no 3D gen MCP** | **NO-GO** for mesh 8/10 — can only do shader/procedural ceiling (~4–5/10); flag director |
| **No image_gen** | DEGRADED UI icons — still GO if Blender + Playwright |
| **Meshy down** | OK if Blender Hyper3D/Hunyuan or hand-modeled in Blender |
| **Godot only** | Ignore — wrong stack |

If NO-GO: write `VISUAL-READY.md` with **NO-GO**, list exact installs/keys needed, **stop**. Do not pretend.

If GO with DEGRADED: state max honest ceiling (e.g. “procedural-only ceiling ~5/10”) and ask whether to proceed anyway — **except** if director already said push to 8; then list what must be installed first.

---

## Step 4 — Plan only (no full production yet)

In `VISUAL-READY.md` include:

1. Tool matrix + go/no-go  
2. Before scores  
3. Asset list for 8/10 (buildings, ground, river, workers, barges, UI kit, map)  
4. Parallel tracks (who owns Blender — **one agent only**)  
5. Capture schedule (frame sheets for judge)  
6. Confirm mechanics fence (no GDD edits)  
7. Explicit: **will not stop at “slightly better boxes”** — bar is **8/10**

---

## Done (primer)

Write `VISUAL-READY.md` then:

- **GO** → proceed to `prompts/PROMPT-02.5-VISUAL-GAUNTLET.md`  
- **NO-GO** → stop and report missing tools to director  

Do not start the gauntlet body until this primer completes.
