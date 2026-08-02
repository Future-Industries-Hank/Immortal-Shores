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
| **1.9** | [`prompts/PROMPT-01.9-ART-STORYBOARD.md`](./prompts/PROMPT-01.9-ART-STORYBOARD.md) | **Art storyboard — director Yes/No** | Boards ready → **you approve** |
| **2** | [`prompts/PROMPT-02-VISUAL.md`](./prompts/PROMPT-02-VISUAL.md) | First visual pass | Ran — ~1.5/10 (not enough) |
| **2.5–2.6** | primer + loop | Toward 8/10 | Stalled ~6.x; boxes still |
| **2.7** | [`prompts/PROMPT-02.7-RESTART-FROM-BOARDS.md`](./prompts/PROMPT-02.7-RESTART-FROM-BOARDS.md) | Rebuild glTF from approved boards | After 1.9 Yes |
| Review UI | [`ART-STORYBOARD-REVIEW.html`](./ART-STORYBOARD-REVIEW.html) | Click Yes/No/Revise per board | **Open this** |
| Inspiration | [`docs/visual-inspiration/`](./docs/visual-inspiration/) | Style guide JPGs (not final art) | Generated |

**FI skills (general pack):** `fi-art-storyboard` · specialized HTML: `fi-html-game` (Future Industries `.claude/skills/`).

Mechanics pre-check: [`CRITICAL-AUDIT-PRE-02.md`](./CRITICAL-AUDIT-PRE-02.md) (green).  
Do not reopen escrow, plot counts, or GDD rates.

### Planner kickoff — structure restart (current)

```text
Pull latest main. Economy frozen.

R10 ~6.1 FAIL with Structures inflated while buildings still read as squares.
Execute prompts/PROMPT-02.7-RESTART-FROM-BOARDS.md (or paste PROMPT-02.7-KICKOFF.txt).

Open docs/visual-inspiration/ boards FIRST. Blender-reauthor glTF heroes to match
silhouettes (great_house, market, fields, shops, harbor). No more sand-only rounds.
Structures ≤ 3 if still boxes. Then money-shot PASS, then loop to overall ≥ 8.0.
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
