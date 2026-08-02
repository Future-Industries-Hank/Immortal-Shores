# Immortal Shores

Free-to-play persistent browser **city- and empire-builder** on the eternal river of the ancient world.

Isometric riverside settlements · server-authoritative real-time economy · Market · Tablet Wall · River Barges · Ascension to the Eternal Name.

**Repo:** [Future-Industries-Hank/Immortal-Shores](https://github.com/Future-Industries-Hank/Immortal-Shores)

---

## Agent build: two prompts only

| Order | Prompt | Goal | Stop when |
|---|---|---|---|
| **1** | [`prompts/PROMPT-01-PLAYABLE.md`](./prompts/PROMPT-01-PLAYABLE.md) | Build the full playable game | Game plays as expected; `PROMPT-01-COMPLETE.md` |
| **2** | [`prompts/PROMPT-02-VISUAL.md`](./prompts/PROMPT-02-VISUAL.md) | Visual / production overhaul | Impartial judge **OVERALL: PASS**; `PROMPT-02-COMPLETE.md` |

**Do not start Prompt 02 until Prompt 01 is complete.**  
**Prompt 01 must not run the AAA visual judge loop.**

### How to run an agent

1. Clone this repo.  
2. Paste **only** `prompts/PROMPT-01-PLAYABLE.md` (plus “read docs/* as referenced”).  
3. When playable and `PROMPT-01-COMPLETE.md` exists, start a **new** session with `prompts/PROMPT-02-VISUAL.md`.

---

## Design docs (canonical)

| File | Contents |
|---|---|
| [`docs/GDD.md`](./docs/GDD.md) | Full game design & numbers |
| [`docs/BUILD-CONTEXT.md`](./docs/BUILD-CONTEXT.md) | Core verb, V1 slice, visual tier |
| [`docs/STYLE-CONTRACT.md`](./docs/STYLE-CONTRACT.md) | Art / UI / light |
| [`docs/ECONOMY.md`](./docs/ECONOMY.md) | Ticks, vault, escrow, barges, Seals |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Stack, authority, hosting shape |

---

## Status

- Design + architecture + dual prompts: **locked**  
- Implementation: **not started** (awaiting Prompt 01 agent)

## Host

[Future Industries](https://futureindustries.ai) — Arcade / hosted-games client + co-hosted social/economy API.
