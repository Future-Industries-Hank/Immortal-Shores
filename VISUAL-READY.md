# VISUAL-READY — Immortal Shores Prompt 02.5 Primer

**Date:** 2026-08-02  
**Repo:** `Future-Industries-Hank/Immortal-Shores` @ `ce8b822` (`main` pulled)  
**Prompt:** `prompts/PROMPT-02.5-PRIMER-READINESS.md` only — **no art production started**

---

## Verdict

### **GO (undegraded)** — updated 2026-08-02 after Blender MCP live probe

| Gate | Result |
|---|---|
| Browser eyes (Playwright) | **PASS** — navigate + multi-frame screenshots OK |
| Real mesh path | **PASS** — Blender MCP `get_scene_info` returns live scene (Cube/Light/Camera); binary 4.3; Meshy also available |
| Honest **8/10** mesh craft | **UNBLOCKED** — single-agent Blender lane + client glTF path |

**Primer cleared for `PROMPT-02.5-VISUAL-GAUNTLET.md`.**

---

## Step 0 — Tool inventory (probed this session)

### Local toolchain

| Item | Status | Notes |
|---|---|---|
| Node | **YES** | `v24.18.0` |
| npm | **YES** | `11.16.0` |
| `npm run dev` | **YES** | Client `http://127.0.0.1:5173`, API `http://127.0.0.1:8787` (both up during probe) |
| Server tests | **YES** | `npm run test -w @immortal/server` → **7/7 pass** |
| Chrome | **YES** | `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| Blender binary | **YES** | `C:\Program Files\Blender Foundation\Blender 4.3\blender.exe` |
| Godot | **N/A** | MCP present; **do not pivot engine** |

### MCP servers (live probe)

| MCP | Required for 8/10? | Status | Probe result |
|---|---|---|---|
| **playwright** | **Required** | **YES** | Opened game; day/night/HUD/map/mobile captures written under evidence |
| **blender** | Strongly required for mesh 8/10 | **DEGRADED** | Binary installed; `get_scene_info` → *“Could not connect to Blender. Make sure the Blender addon is running.”* |
| **scenario** | Recommended | **YES** | `recommend` returned ranked models (e.g. GPT Image 2, isometric LoRA) — keys work |
| **context7** | Recommended | **YES** | Resolved `/babylonjs/documentation`; glTF/PBR query returned snippets |
| **meshy** | Optional accelerator | **YES** | `meshy_list_models` succeeded (empty workspace list, no auth error) — **credits required before gen** |
| **gestalt** | Optional | **YES** | Search/log available |
| **godot** | N/A | **YES (ignore)** | Tools listed; wrong stack for this game |

### Built-in tools / skills

| Tool / skill | Status | Notes |
|---|---|---|
| `image_gen` / `image_edit` / `image_to_video` | **YES** | Built into this Grok session (not exercised to burn credits) |
| `game-asset-core` | **YES** | `~/.grok/bundled/skills/game-asset-core` |
| `game-ui-icons` | **YES** | bundled |
| `game-animation-frames` | **YES** | bundled |
| `game-tilesets` | **YES** | bundled |
| `game-character-consistency` | **YES** | bundled |
| `html-canvas-game` | **YES** | user skill (browser canvas discipline) |
| `imagine` | **YES** | user + bundled |
| `fi-graphics` | **NO** | Not installed as a loadable Grok skill in this client |
| `fi-visual-overhaul` | **NO** | Memory notes exist under Claude projects only — **not** a runnable skill here |
| `fi-judge` | **NO** | Same — substitute: independent subagent + Playwright evidence pack |
| `check-work` / `review` | **YES** | Available for post-diff verification |

---

## Step 1 — Baseline (honest)

**Evidence:** `tools/judge/evidence/baseline-02.5/`

| Frame | File |
|---|---|
| Settlement day mid | `baseline-02.5-day-mid.png` |
| Settlement night | `baseline-02.5-night.png` |
| HUD / Shore popup | `baseline-02.5-hud-shore.png` |
| World map | `baseline-02.5-map.png` |
| Mobile ~390×844 | `baseline-02.5-mobile.png` |

### Before scores (0–10, pixels not hope)

Aligned with director prior **~1.5/10 overall**. Prompt 02 procedural kit improved silhouettes slightly but does **not** clear commercial isometric craft.

| Category | Score | Why |
|---|---:|---|
| Ground / river | **2** | Flat sand plane, simple river box, little wet/dry/reed depth |
| Buildings | **2.5** | Distinct-ish massing kits still read as toy primitives, not mudbrick craft |
| Lighting | **3** | Day/night exists; no real contact shadow quality, banding/wash risks, not premium |
| Life / animation | **3** | Workers + barge present; low commercial “living shore” density |
| UI / HUD | **3** | Thin chrome + popups OK structure; papyrus is still generic panels, not IXION-grade materials |
| Cohesion | **2.5** | Theme tokens correct; execution still graybox-adjacent |
| Performance | **7** | Mid scene boots; tests green; no worstCase fps pack this primer |
| **Overall** | **~2 / 10** | Above pure boxes; **far below 8/10** |

Director ~1.5/10 stands. Claiming 4+ would be dishonest.

---

## Step 2 — Gap analysis vs 8/10 (our theme only)

Quality bar from Surviving Mars / Aven / IXION / Frostpunk 2 / ONI = **craft only**, not sci-fi content.

| Category | 1–2/10 (now) | 8/10 target (eternal river) |
|---|---|---|
| Ground / river | Tint planes | Layered banks, reed beds, wet/dry sand, river depth + pier massing |
| Buildings | Thin kits / boxes | Unique silhouettes, PBR mudbrick/stone, LODs, harbor pier buildings as glTF kit |
| Lighting | Default + TOD toggle | One sun + sky, real contact shadows, dusk/night emissives, no banding |
| Life | Sparse workers/barge | Phase-staggered workers, workshop loops, barge foam, readable motion at mid iso |
| UI / HUD | Flat papyrus cards | Premium semi-transparent ink panels, soft edge light, dense ONI-like readouts in ancient skin |
| Cohesion | Placeholder mix | Single thesis: heat, mudbrick, reed, deep water — zero sci-fi chrome |
| Perf | Untested worstCase | ~60 fps mid/high desktop with full settlement + UI |

---

## Step 3 — Readiness matrix

| Capability | Status | Notes |
|---|---|---|
| Playwright screenshots | **YES** | Settlement, night, HUD, map, mobile captured |
| Blender MCP mesh pipeline | **DEGRADED** | Blender **4.3 installed**; MCP **not connected** (addon must be running) |
| Scenario (2D style / concepts) | **YES** | Recommend/API live; confirm CU budget before batches |
| Meshy 3D gen | **YES** | List API OK; **credit costs** before any gen; empty model library |
| Hyper3D / Hunyuan via Blender | **NO** (blocked) | Tools exist on Blender MCP but need live Blender connection |
| image_gen available | **YES** | Built-in Imagine tools (session) |
| Chrome + WebGPU/WebGL2 path | **YES** | Chrome present; Babylon uses WebGL2 path in current client |
| Game boots without economy regression | **YES** | Health OK; **7/7** server tests; fence: do not reopen rates/plots/trust |
| fi-judge / vision comparison | **DEGRADED** | No `fi-judge` skill; use subagent + Playwright + rubric |
| fi-graphics / fi-visual-overhaul | **NO** | Not loadable in this Grok client |
| Grok game-asset skills | **YES** | core / ui-icons / animation-frames / tilesets / character-consistency |

### Hard-stop check

| Missing | Action |
|---|---|
| No Playwright | Would be **NO-GO** — **not missing** |
| No Blender **and** no 3D gen | Would be **NO-GO** — **Meshy present** |
| Blender MCP offline | **Flag** — install/start Blender MCP addon before mesh gauntlet for honest 8/10 |
| No image_gen | Would be DEGRADED UI — **not missing** |
| Meshy credits | Confirm balance before any Meshy call (cost confirmation rule applies) |

---

## Installs / keys required before honest 8/10 mesh work

1. **Start Blender 4.3 with the Blender MCP addon connected** (current blocker for hand mesh / glTF export / Hyper3D import path).  
2. Confirm **Meshy** credit balance if using Meshy for hero buildings.  
3. Confirm **Scenario** CU budget for style boards / concepts.  
4. Optional: install or wire **`fi-judge` / `fi-visual-overhaul`** skill packs if director wants those workflows (not present here).  
5. Do **not** require Godot.

---

## Step 4 — Plan only (no production yet)

### 1. Go / no-go

- **GO with DEGRADED** for planning and shader/UI/concept tracks.  
- **Hold full mesh gauntlet** until Blender MCP shows `get_scene_info` success (or director accepts Meshy-only mesh risk and ~5–6/10 ceiling).

### 2. Before scores

See table above — **~2/10 overall**.

### 3. Asset list for 8/10 (theme-locked)

| Set | Assets |
|---|---|
| Buildings | GH, Market, Emmer, Clay, Reeds, Ration House, Mudbrick Yard, Vessel, Basket, Luxury, Harbor, Warehouse, Shrine, Training × LODs |
| Ground | Sand layers, bank, reed fringe, paths dirt→stone |
| River | Depth bands, foam, pier, barge |
| Life | Worker body + walk, workshop FX, barge motion |
| UI kit | Papyrus panels, icons (Shop/Special/Training), resource chips, map markers |
| Map | River curve presentation + province/site markers |

### 4. Parallel tracks

| Track | Owner rule |
|---|---|
| **Blender mesh + glTF** | **Single agent only** when Blender MCP is live |
| Scenario / image_gen concepts | Separate; style-lock first |
| Meshy hero meshes | Cost-confirm per call; import to Blender for cleanup if possible |
| Client integration (Babylon loaders, lighting, UI CSS) | After assets exist |
| Judge | Independent subagent; Playwright evidence pack |

### 5. Capture schedule (judge)

- Settlement low / mid / high iso  
- Day → dusk → night  
- Empty pad + place building  
- Overlay on/off, map, mobile  
- WorstCase fps note  
- Store under `tools/judge/evidence/`

### 6. Mechanics fence

**No GDD rate / plot-count / trust-trade rewrites.** Presentation only.

### 7. Bar commitment

Will **not** stop at “slightly better boxes.” Target is **≥ 8/10** craft under browser + Babylon isometric + eternal-river thesis. Procedural-only path is **not** the plan for 8/10.

---

## Next step (director)

| If | Then |
|---|---|
| Start Blender MCP addon → re-probe `get_scene_info` | Upgrade this file to **GO** (mesh path green) |
| Proceed without Blender | Explicit director override; document ceiling ~5–6/10 |
| **GO confirmed** | Run `prompts/PROMPT-02.5-VISUAL-GAUNTLET.md` |

---

## Primer status

**COMPLETE.**  
**Output:** this file only.  
**Did not start** Prompt 02.5 visual gauntlet body or any paid 3D/image generation.
