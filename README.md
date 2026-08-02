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

## Agent prompts (three phases)

| Order | Prompt | Goal | Stop when |
|---|---|---|---|
| **1** | [`prompts/PROMPT-01-PLAYABLE.md`](./prompts/PROMPT-01-PLAYABLE.md) | Playable core | `PROMPT-01-COMPLETE.md` — **DONE** at `9f0479d` |
| **1.5** | [`prompts/PROMPT-01.5-MODERN-2026.md`](./prompts/PROMPT-01.5-MODERN-2026.md) | 2026 modernization (trust trade, PWA, QoL, onboarding, social) | `PROMPT-01.5-COMPLETE.md` — **RUN NEXT** |
| **2** | [`prompts/PROMPT-02-VISUAL.md`](./prompts/PROMPT-02-VISUAL.md) | Visual / production gauntlet | Impartial judge **PASS** |

**Do not start Prompt 02 until 01.5 is complete.**  
**Prompt 01 is closed** — do not reopen the playable bar.

### Planner / agent kickoff for 01.5

```text
Pull main (at least 9f0479d). Read docs/REV1-REVIEW.md and docs/MODERN-2026.md.
Execute only prompts/PROMPT-01.5-MODERN-2026.md. Stop at PROMPT-01.5-COMPLETE.md.
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
