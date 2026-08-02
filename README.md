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

1. **Found settlement** (new name) — only **Great House, Market, Emmer Field, Clay Pit, Reed Bed**. Workers start **unassigned**. You are assigned **one unique luxury specialty** (not a building yet).  
2. **Sparse typed pads** (not a free grid): **5 shop**, **4 special** (Harbor / Warehouse / Shrine / Luxury Works), **3 training**. Click a pad — only allowed buildings for that category appear.  
3. Early order matters: Mudbrick Yard + Ration House on shop pads, then vessels/baskets for GH upgrades, Luxury Works on its special pad to produce *your* luxury.  
4. **Other luxuries only via multiplayer trade** (Market / Tablet Wall / barges) inside your **Province**.  
5. Construction is real-time sequential. Shore → **Time** (+1h / +8h) is the only speed-up for testing.

See [`HOSTING.md`](./HOSTING.md) for env vars, backups, and FI Arcade shape.

---

## Agent build: two prompts only

| Order | Prompt | Goal | Stop when |
|---|---|---|---|
| **1** | [`prompts/PROMPT-01-PLAYABLE.md`](./prompts/PROMPT-01-PLAYABLE.md) | Build the full playable game | Game plays as expected; `PROMPT-01-COMPLETE.md` |
| **2** | [`prompts/PROMPT-02-VISUAL.md`](./prompts/PROMPT-02-VISUAL.md) | Visual / production overhaul | Impartial judge **OVERALL: PASS**; `PROMPT-02-COMPLETE.md` |

**Prompt 01 status: COMPLETE** — see [`PROMPT-01-COMPLETE.md`](./PROMPT-01-COMPLETE.md) and [`BUILD-CHECK.md`](./BUILD-CHECK.md).  
**Do not start Prompt 02 until you open a new session with only Prompt 02.**

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

## Layout

```
apps/client/     Vite + Babylon isometric client
apps/server/     Fastify API + tick engine + ledger
packages/shared/ GDD rates & types
docs/ prompts/ tools/
docker-compose.yml
```

## Tests

```bash
npm run test -w @immortal/server
```

## Host

[Future Industries](https://futureindustries.ai) — Arcade / hosted-games client + co-hosted social/economy API.
