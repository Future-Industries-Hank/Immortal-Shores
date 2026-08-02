# PROMPT 01 — Immortal Shores: Playable Core

### Future Industries · Build until the game plays as expected

> **Phase:** 1 of 3  
> **Status:** **COMPLETE** on `main` at `9f0479d` — see `PROMPT-01-COMPLETE.md`.  
> **Do not re-run this prompt** unless the director reopens rev 1.  
> Next: **Prompt 01.5** (`prompts/PROMPT-01.5-MODERN-2026.md`), then Prompt 02 visual.

---

## Mission

This repository is the home of **Immortal Shores**. Implement the game from the locked design and architecture so a player can complete real sessions end-to-end.

**Read first (canonical):**

| Doc | Role |
|---|---|
| `docs/GDD.md` | Full mechanics & numbers — source of truth |
| `docs/BUILD-CONTEXT.md` | Core verb, V1 slice, visual refs |
| `docs/STYLE-CONTRACT.md` | Palette / isometric / UI lock (use as **direction**, not final art pass) |
| `docs/ECONOMY.md` | Server ticks, vault, mail, escrow, barges, Seals, ledger |
| `docs/ARCHITECTURE.md` | Stack, monorepo, authority matrix, FI hosting |

Preserve every mechanical system and confirmed number under Immortal Shores names. Do not invent competing systems.

---

## One-line pitch

Free-to-play persistent browser multiplayer **city- and empire-building** on the **eternal river** of the ancient world. Casual real-time pace (few minutes, several times a day). No download.

---

## Design summary (must match GDD.md)

**Presentation:** Isometric riverside settlements — mudbrick, pale stone, sandy warmth, green fields/reeds, deep blue river, soft gold on high tiers. Living Workers, workshop and barge motion. Clean papyrus UI; nav: Harbor, Private Tablets, Allies, Tablet Wall. World map = long river curve, Provinces, cities, founding sites, monuments.

**Start:** L1 Great House, Market, Emmer Field, River Clay Pit, Marsh Reed Bed, 18 Workers, 60 Rations, 40 Mudbricks, **one random unique luxury** of eight (Hides, Bronze, Cedarwood, Red Ochre, Eye Paint, Sacred Oil, Green Stones, Royal Gold).

**Workers:** +3/h to Great House cap (L1=30 … L22=1395). Assigned Workers −1 Ration/h; shortage reduces production. Monument Workers permanent; home regrows.

**Production:** Exact GDD rates. Luxury goods: Fine Sandals, Stone Idols, Eye Cosmetics, Sacred Perfume, Amulets. Limestone only at monuments. One construction at a time; cancel ≈25% refund.

**Seals:** Start 10; never trade below 10; spend on GH 7/10/13/16/19/22, founding 2/3/4, monument unlock, QoL.

**Trade:** Market (Rations) · Tablet Wall barter · River Barges · gifts/mail/escrow.

**Military & monuments · Shrines · Envoys · Multi-settlement (≤4) · Prestige · Ascension** — all in GDD; implement as data-driven systems (vertical slice first, then expand).

**Core verb:** Allocate Workers so fields feed workshops; trade for missing luxuries.

---

## Social / multiplayer model (locked)

| Concern | Design |
|---|---|
| Settlement play | Player cities; **server-authoritative production ticks** (incl. offline catch-up) |
| World | Persistent river Provinces; many players on one map |
| Visit | Postcard and/or **read-only** settlement view — not live co-op |
| Interaction | Tablet Wall, DMs, Market, barges, gifts, mail, escrow, military travel — **async** |
| Not in scope | Colyseus shared rooms; concurrent multi-player editing one plot |

---

## Technical architecture (required)

| Layer | Choice |
|---|---|
| Client | TypeScript + **Vite** + **Babylon.js** isometric orthographic |
| Graphics | **WebGPU primary**, WebGL2 fallback; quality tiers Low/Med/High |
| Server | TypeScript **HTTP + WebSocket** (Fastify/Hono/Express — **not** Colyseus) |
| DB | **PostgreSQL** (vaults, settlements, mail, escrow, market, barges, ledger, chat history as needed) |
| Redis | Optional (presence, rate limits) |
| Heavy client | Optional Rust WASM for density only — never economy authority |
| Assets | glTF/glb, KTX2/Basis, Draco; progressive load; instancing; LODs |

### Hard constraints

1. Small initial interactive load; stream detail after play starts.  
2. Dual input: mouse+keyboard and touch.  
3. Mobile/Safari thermal & memory respect; dynamic quality.  
4. **Never trust the client** for production totals, gifts, trades, Seals, barges, combat, vault mutations.  
5. Offline catch-up correct (no double-dip).  
6. Free-text chat is never an executable transfer — structured `offer_id` + server settle only.

### Fences

- Renderer never writes authoritative economy.  
- Server tick / lazy eval owns production, growth, upkeep, construction, travel.  
- All cross-player value: transactional + double-entry ledger.  
- All rates in data tables (not scattered magic numbers).

### Authority matrix

| Action | Client | Server |
|---|---|---|
| Camera, UX, cosmetics | yes | — |
| Assign Workers / queue build / train | intent | validate, apply |
| Production & upkeep | predict UI | authoritative tick |
| Snapshot / postcard | capture/upload | store, serve read-only |
| Chat / Tablet Wall | draft + send | validate, fan-out, rate-limit, sanitize |
| Market / gift / escrow / barge | intent | debit/credit/lock/travel/settle/ledger |
| Seals | intent | floor of 10; ledger |

### Monorepo layout

```
apps/client/          # Vite + Babylon
apps/server/          # API + WS + ticks
crates/sim/           # optional WASM
tools/                # sfx, screenshots, asset pipeline
docs/                 # GDD, ECONOMY, etc.
docker-compose.yml
ai_manifest.json
HOSTING.md
```

Full layout notes: `docs/ARCHITECTURE.md`.

---

## Future Industries delivery

- Hostable on FI: static client → `hosted-games/<slug>/` + co-hosted API via Cloudflare Tunnel pattern.  
- `ai_manifest.json` honesty badge; `HOSTING.md` with env, ports, backup.  
- Identity: support FI session / `X-FI-User` when present; local dev auth for testing.  
- Craft: complete loop before feature sprawl; sim/render split; synthesize SFX; 60 fps is a **gate for playability** (not the AAA art bar — Prompt 02).

### MCPs / skills to use when available

- **playwright** — browser verification, multi-account trade tests  
- **context7** — Babylon / Vite / server / Postgres docs  
- **gestalt** — log decisions  
- **blender / scenario** — only as needed for **readable** first-party placeholders; do **not** spend this phase on full art production  
- Skills: `fi-game-build`, `fi-playtest`, `fi-audio` (basic)

---

## Build protocol (this prompt only)

### Phase 0 — Scaffold

1. Confirm tools; scaffold monorepo; docker-compose Postgres; migrations.  
2. Seed config tables from GDD rates and GH worker caps.  
3. Update `PROGRESS.md` / `CHANGELOG.md` as you go.

### Phase 1 — Vertical slice (must work)

- Boot → isometric starter settlement (GDD start kit + unique luxury).  
- Server tick: production, Worker +3/h, Ration upkeep, shortage; **offline catch-up**.  
- Assign Workers; one construction queue; cancel ~25% refund.  
- One luxury good craft path.  
- Market **or** Tablet Wall structured offer + mail/escrow (two accounts).  
- Chat (Trade or General).  
- World map stub: river, provinces, city / empty / monument markers.  
- Postcard snapshot + read-only visit.  
- Dual input; quality tier switch; playable on Chrome (Safari best-effort this phase).  
- On-palette **procedural massing** is OK — correct footprints, contact shadows, STYLE-CONTRACT colors. Not blank/pink boxes forever.

### Phase 2 — Systems expansion (playable breadth)

Implement remaining GDD systems until the game **plays as expected** for a real session:

- Harbor + River Barges (build, travel, capacity, 11+ risk).  
- Full Market province range.  
- Tablet Wall channels: General, Trade, Province + Private Tablets + Allies.  
- Military training/upkeep/travel; monument capture/hold (max 2); Limestone; monument level bonuses.  
- Shrines + provincial blessing 10%/48h.  
- Multi-settlement founding (Seals 2/3/4, timers, unique luxury each).  
- Envoys @ GH7; prestige tracking; Ascension path (can be guided/endgame stub if timing is huge, but **must be reachable in code/data**).  
- Seal floor, spend sinks, gift/escrow/pay-on-receive all ledger-correct.  
- Audio: synthesized SFX on core actions.  
- `HOSTING.md` + health endpoints.

### Phase 3 — BUILD-CHECK (hard gate for this prompt)

Produce `BUILD-CHECK.md`:

- Zero console errors on boot  
- Assets resolve or intentional placeholders  
- Complete loop without devtools  
- Measured fps in a mid scene (target **smooth playable**; note the number)  
- Two-account trade/gift path verified  
- Offline catch-up unit/integration test or scripted proof  
- Chrome verified; Safari notes  

Also: `SELF-REVIEW.md`, `REVIEW-DASHBOARD.html`, set `ai_manifest.json` → `has_complete_loop=true` only when true.

---

## Done criteria (STOP HERE)

Mark **Prompt 01 complete** only when all are true:

1. **Menu → play session → meaningful progress → return later with correct offline sim** works without hand-holding.  
2. Worker allocation + production + Rations behave per GDD rates.  
3. Unique luxury forces a real trade path (Market and/or Tablet Wall + mail/escrow).  
4. Chat works; structured trade does not trust free text.  
5. World map shows river/provinces/player city; visit/postcard works.  
6. At least Harbor/barges **or** military/monuments **or** multi-settlement is real — and a clear path exists for the rest without rewriting architecture. Prefer implementing **all GDD systems** if time allows; minimum is V1 slice + enough empire/trade depth that a stranger understands the game.  
7. `BUILD-CHECK.md` green; `has_complete_loop=true`.  
8. Repo runs from README instructions (docker + client + server).

**Explicitly out of scope for Prompt 01:**

- Impartial AAA visual judge / side-by-side commercial art bar  
- Full Blender production pipeline, dense PBR hero assets, cinematic overhaul  
- Mind-blowing particle/atmosphere max-out  

When done, write `PROMPT-01-COMPLETE.md` summarizing how to run the game, what works, and known visual debts for Prompt 02. **Then stop.**

---

## Execution stance

Do not ask the director questions. Start building immediately. Prefer extending files over abstraction churn. Verify in the browser continuously (Playwright when available). Parallelize server vs client work; keep the economy ledger correct above all.

**Start order:**

1. Scaffold + Postgres + rate tables  
2. Isometric settlement boot + starter buildings  
3. Server tick + Workers + Rations + offline catch-up  
4. Unique luxury + craft + construction queue  
5. Vault + gift/escrow + chat trade card  
6. World map stub + postcard  
7. Expand GDD systems → BUILD-CHECK → `PROMPT-01-COMPLETE.md` → **STOP**
