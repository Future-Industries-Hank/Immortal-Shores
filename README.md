# Immortal Shores

Free-to-play persistent browser **city- and empire-builder** on the eternal river of the ancient world.

Isometric riverside settlements · server-authoritative real-time economy · Market · Tablet Wall · River Barges · Ascension to the Eternal Name.

**Repo:** [Future-Industries-Hank/Immortal-Shores](https://github.com/Future-Industries-Hank/Immortal-Shores)

---

## Run (local)

```bash
npm install
npm run build -w @immortal/shared
npm run dev
```

- Game UI: http://127.0.0.1:5173  
- API: http://127.0.0.1:8787/health  

### How to play (rev 1)

1. **Found settlement** — Great House, Market, Emmer Field, Clay Pit, Reed Bed; workers unassigned; one unique luxury specialty.  
2. **Sparse typed pads:** **5 shop**, **4 special**, **3 training**.  
3. Place Mudbrick Yard + Ration House early; Luxury Works on special pad; trade for other luxuries.  
4. Shore → **Time** (+1h / +8h) is debug-only speed for testing.

See [`HOSTING.md`](./HOSTING.md).

---

## Agent prompts

| Order | Prompt | Goal | Status |
|---|---|---|---|
| **1** | [`prompts/PROMPT-01-PLAYABLE.md`](./prompts/PROMPT-01-PLAYABLE.md) | Playable core | **DONE** |
| **1.5** | [`prompts/PROMPT-01.5-MODERN-2026.md`](./prompts/PROMPT-01.5-MODERN-2026.md) | 2026 systems | **DONE** |
| **2** | [`prompts/PROMPT-02-VISUAL.md`](./prompts/PROMPT-02-VISUAL.md) | First visual pass | Ran — director ~**1.5/10** (not enough) |
| **2.5 primer** | [`prompts/PROMPT-02.5-PRIMER-READINESS.md`](./prompts/PROMPT-02.5-PRIMER-READINESS.md) | MCP/skills readiness, go-no-go | **Run first** |
| **2.5 goal** | [`prompts/PROMPT-02.5-VISUAL-GAUNTLET.md`](./prompts/PROMPT-02.5-VISUAL-GAUNTLET.md) | Graphics **≥ 8/10** | After primer **GO** |

Mechanics pre-check: [`CRITICAL-AUDIT-PRE-02.md`](./CRITICAL-AUDIT-PRE-02.md) (green).  
Do not reopen escrow, plot counts, or GDD rates.

### Planner kickoff — 8/10 visual gauntlet

```text
Pull latest main. Economy is frozen.

1) ONLY prompts/PROMPT-02.5-PRIMER-READINESS.md
   → VISUAL-READY.md (probe Playwright, Blender, Scenario, image_gen, fi-* skills).
   NO-GO if no eyes (Playwright) or no mesh path (Blender/3D gen) for an honest 8/10.

2) If GO → prompts/PROMPT-02.5-VISUAL-GAUNTLET.md
   Stop only when independent judge overall ≥ 8.0 (min category ≥ 6).
   Prior ~1.5/10 is FAIL. Quality benchmarks (craft only, do not copy setting):
   Surviving Mars, Aven Colony, IXION, Frostpunk 2, Oxygen Not Included.
```
---

## Design docs

| File | Contents |
|---|---|
| [`docs/GDD.md`](./docs/GDD.md) | Original mechanics & numbers |
| [`docs/MODERN-2026.md`](./docs/MODERN-2026.md) | 2026 product layer (trust trade, QoL, social, F2P) |
| [`docs/REV1-REVIEW.md`](./docs/REV1-REVIEW.md) | Review of builder rev 1 at `9f0479d` |
| [`docs/BUILD-CONTEXT.md`](./docs/BUILD-CONTEXT.md) | Core verb, visual tier |
| [`docs/STYLE-CONTRACT.md`](./docs/STYLE-CONTRACT.md) | Art / UI / light |
| [`docs/ECONOMY.md`](./docs/ECONOMY.md) | Ticks, vault, **trust** trade, barges, Seals |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Stack, phases, hosting |

---

## Layout

```
apps/client/     Vite + Babylon isometric client
apps/server/     Fastify API + tick engine + ledger
packages/shared/ GDD rates, plot grid, types
docs/ prompts/ tools/
```

## Tests

```bash
npm run test -w @immortal/server
```

## Host

[Future Industries](https://futureindustries.ai) — Arcade / hosted-games + co-hosted API.
