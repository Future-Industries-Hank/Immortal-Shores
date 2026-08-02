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
| **2.7** | [`prompts/PROMPT-02.7-RESTART-FROM-BOARDS.md`](./prompts/PROMPT-02.7-RESTART-FROM-BOARDS.md) | Rebuild glTF from boards | Ran / partial |
| **2.8** | [`prompts/PROMPT-02.8-DIRECTOR-PLAY-PASS.md`](./prompts/PROMPT-02.8-DIRECTOR-PLAY-PASS.md) | Director play issues (reference) | Nested in 02.9 Step 3 |
| **2.9** | [`prompts/PROMPT-02.9-APPROVAL-THEN-CRAFT.md`](./prompts/PROMPT-02.9-APPROVAL-THEN-CRAFT.md) | Storyboard → standard view | **DONE** (locked) |
| **03** | [`prompts/PROMPT-03-APPROVED-GAUNTLET.md`](./prompts/PROMPT-03-APPROVED-GAUNTLET.md) | **Boards + AAA quality → ≥ 8/10** | **RUN THIS** |
| Kickoff | [`prompts/PROMPT-03-KICKOFF.txt`](./prompts/PROMPT-03-KICKOFF.txt) | Paste block | Copy-paste |
| Review UI | [`ART-STORYBOARD-REVIEW.html`](./ART-STORYBOARD-REVIEW.html) | Yes/No boards | Open when locking look |
| Inspiration | [`docs/visual-inspiration/`](./docs/visual-inspiration/) | Style guide JPGs | Generated |

**FI skills (general pack):** `fi-art-storyboard` · specialized HTML: `fi-html-game` (Future Industries `.claude/skills/`).

Mechanics pre-check: [`CRITICAL-AUDIT-PRE-02.md`](./CRITICAL-AUDIT-PRE-02.md) (green).  
Do not reopen escrow, plot counts, or GDD rates.

### Planner kickoff — approval then craft (current)

```text
Pull latest main. Economy frozen.

Execute prompts/PROMPT-02.9-APPROVAL-THEN-CRAFT.md (or PROMPT-02.9-KICKOFF.txt).

STEP 1: Open ART-STORYBOARD-REVIEW.html for director Yes/No on inspiration boards.
        WAIT. Write ART-STORYBOARD-APPROVED.md when done.

STEP 2: Fixed full-settlement STANDARD VIEW (no zoom; few buildings + pads;
        0–3 tiny workers for scale). Capture STANDARD-VIEW-DAY.png.
        Director confirms POV + building/people scale. STANDARD-VIEW-APPROVED.md

STEP 3: Only then craft — fog/shadow stamps/workers/camera per director play notes.
```### Future packs (FI)

Phase **1.9 art storyboard** is now mandatory in `fi-game-build` / `FI-PLAYBOOK` before multi-round visual overhaul. Browser titles use specialized skill **`fi-html-game`**.---

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
