# PROMPT 02 — Immortal Shores: Visual & Production Overhaul

### Future Industries · Final visual goal · Run only after Prompt 01 is complete

> **Phase:** 2 of 2  
> **Prerequisite:** `PROMPT-01-COMPLETE.md` exists and the game **plays** end-to-end (`has_complete_loop=true`).  
> **Fence:** Rewrite **rendering, assets, lighting, animation, atmosphere, UI chrome** — **do not** change GDD mechanics, rates, economy math, or authority rules.  
> **Do not ask questions.** Push until the impartial judge PASSes.

---

## Mission

**Immortal Shores** already plays. Your job is to make it **mind-blowing** visually and in production values — isometric riverside empire quality that holds up next to high-end commercial strategy presentation — while staying inside the locked technical architecture and preserving **60 fps** and practical load times.

Read:

| Doc | Role |
|---|---|
| `PROMPT-01-COMPLETE.md` | What ships, how to run, known visual debt |
| `docs/GDD.md` | Do not change mechanics |
| `docs/STYLE-CONTRACT.md` | Thesis, palette, camera, UI language |
| `docs/BUILD-CONTEXT.md` | visualReference, antiReference, worstCase, transitions |
| `docs/ARCHITECTURE.md` | Stack constraints |
| `BUILD-CHECK.md` | Baseline must stay green |

---

## Architecture constraints (do not break)

- TypeScript + Vite + Babylon.js isometric orthographic  
- WebGPU primary / WebGL2 fallback; quality tiers  
- Server remains economy authority; no Colyseus pivot  
- Original first-party assets only (code, shaders, Blender/Scenario generation committed to repo)  
- No marketplace dumps; no tracing commercial art into ship  

### Tools / MCPs

Use aggressively when available:

| Tool | Use |
|---|---|
| **playwright** | Frame sheets, multi-angle captures, UI sequences |
| **blender** | Building/props/barge meshes, LODs, glTF export (**single agent owns Blender**) |
| **scenario** | Style-locked singular assets / concept → rebuild systematically |
| **context7** | Babylon material/post/perf docs |
| **image_gen / image_edit** | Concept and UI icon sets → implement in-engine |
| Skills | `fi-visual-overhaul`, `fi-graphics`, `fi-judge`, `fi-audio`, Grok game-asset skills |

Delegate parallel tracks (materials, UI, particles, world map art) except Blender single-owner.

---

## Visual goals

Maximize, within Immortal Shores thesis (eternal river, mudbrick, pale stone, reeds, deep blue water, soft gold prestige):

- Settlement density and readable isometric silhouettes  
- Lighting quality (one coherent sun; warm day; dusk; night emissives)  
- Material fidelity (mudbrick vs stone vs water vs crops)  
- Atmospheric effects (heat haze, dust, soft fog on river — subtle)  
- Particle systems (workshop, water spray, barge wake) lit by the scene  
- Animations of city life (Workers phase-staggered; workshops; barges)  
- Day/night continuous  
- UI/HUD production values (papyrus/ink system, icon set, trade cards, Tablet Wall)  
- World map: beautiful river curve, province bands, monument/ancestral markers  

Prefer intentional, high-quality assets and generation over crude procedural leftovers. Procedural is fine when it **reads as designed**.

Preserve:

- Smooth **60 fps** in `worstCase` (BUILD-CONTEXT)  
- Practical load times; progressive streaming  
- Dual input; mobile thermal respect via quality tiers  

---

## Capture & artifact hunt

Systematically capture **sheets of frames** across:

- Settlement gameplay (low / eye / high isometric)  
- Camera pan/zoom  
- Day → dusk → night  
- Building placement / upgrade complete  
- Worker assign feedback  
- Mail / gift / escrow / Market / Tablet Wall  
- Barge depart/arrive  
- World map and province view  
- Mobile layout  

**Eliminate by name:**

| Artifact | Fix class |
|---|---|
| Seams | padding, snap, welding |
| Z-fighting / sort flicker | depth bias, stable sort keys |
| Banding | dither, noise in gradients |
| Popping | LOD hysteresis, cross-fades |
| Aliasing | TAA/FXAA tiers, geo LODs, shadows |
| Lighting errors | one sun agreement, color spaces, IBL |
| Texture issues | mips, anisotropy, sRGB vs linear |
| Shimmer | no unseeded per-frame draw RNG |
| Effect FPS drops | pools, caps, quality culls |

---

## Goal verification — impartial judge (non-negotiable)

Create an **independent judge subagent**. The builder must not grade their own work.

### Mandate

1. Use FI **`JUDGE-RUBRIC.md` categories** (Ground · Structures · Lighting · Depth · Materials · Particles/atmosphere · Animation · Transitions · UI/HUD · Cohesion · Performance) adapted to **isometric city-empire** presentation — binary **PASS/FAIL**.  
2. Compare **screenshots and frame captures** of Immortal Shores against high-end commercial references appropriate to this genre (**Anno 1800 / 2205**, high-end isometric historical city/empire builders, polished browser strategy presentation — not free-roam Skylines as the primary fantasy).  
3. Detailed, **located** criticism (which shot, where in frame, fix class).  
4. Verdict table:

```
CATEGORY            VERDICT   CRITICISM
1 Ground and tiles  FAIL      ...
...
OVERALL: BLOCKED — N categories failing.
```

or `OVERALL: PASS` only when **every** category passes.

### Integrity

- You may **not** complete this prompt until the judge states comparable visual/production quality (`OVERALL: PASS`).  
- **Forbidden** to soften, renegotiate, or edit judge criteria.  
- Factual rebuttal with new evidence only.  
- **5 blocking rounds** (Production tier). Exhausted rounds → honest FAIL + structural cause in `ai_manifest.json` — never manufacture PASS.

### Evidence pack

`tools/judge/evidence/`: multi-angle settlements, day/dusk/night, placement transitions, trade/mail UI, chat cards, world map, mobile, worstCase density, performance note (fps / frame time).

---

## Protocol

1. Confirm Prompt 01 complete; re-run smoke (game still plays).  
2. Inventory draw paths and assets; plan overhaul without touching sim math.  
3. Parallel visual tracks; continuous Playwright capture.  
4. After each major pass: re-check 60 fps + complete loop still works.  
5. Run impartial judge; fix FAILs; repeat within round budget.  
6. On PASS: set `ai_manifest.json` → `visual_tier_achieved: 3`, write `PROMPT-02-COMPLETE.md`, update `REVIEW-DASHBOARD.html`.

---

## Done criteria

- Judge **OVERALL: PASS**  
- Mechanics unchanged vs GDD (spot-check rates, trade, ticks)  
- 60 fps worstCase measured and recorded  
- Evidence pack on disk  
- `PROMPT-02-COMPLETE.md` with run instructions and before/after notes  

You are capable of reaching this bar. Push hard. Do not stop until the judge approves.
