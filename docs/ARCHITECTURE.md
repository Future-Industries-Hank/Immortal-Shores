# ARCHITECTURE — Immortal Shores

## Product shape

Persistent **async** browser city/empire builder. Server-authoritative ticks and economy. Isometric settlement view + river world map. **Not** a live shared-build MMO (no Colyseus city rooms).

## Stack

| Layer | Choice |
|---|---|
| Client | TypeScript, Vite, Babylon.js (isometric orthographic) |
| Graphics | WebGPU primary, WebGL2 fallback; quality tiers L/M/H |
| Server | TypeScript HTTP + WebSocket (Fastify/Hono/Express) |
| DB | PostgreSQL (required) |
| Cache | Redis optional |
| Optional | Rust WASM for client-side density only |

## Monorepo

```
/
├── apps/
│   ├── client/                 # Vite + Babylon
│   │   └── src/
│   │       ├── render/
│   │       ├── sim/            # prediction only
│   │       ├── input/
│   │       ├── net/
│   │       ├── ui/
│   │       ├── audio/
│   │       └── debug/
│   └── server/
│       └── src/
│           ├── routes/
│           ├── services/       # tick, escrow, ledger, barges, combat
│           ├── db/
│           └── ws/
├── crates/sim/                 # optional WASM
├── tools/
├── docs/
├── prompts/
│   ├── PROMPT-01-PLAYABLE.md
│   └── PROMPT-02-VISUAL.md
├── docker-compose.yml
├── ai_manifest.json
└── README.md
```

## Authority

Server owns: production ticks, Worker growth, construction, vaults, Seals, mail, market, barges, military outcomes, chat fan-out.  
Client owns: camera, presentation, input intents, cosmetic prediction.

## Economy spine

Vault + mail + **trust-based** Market/Tablet Wall atomic takes + barges + double-entry ledger.  
**No escrow.** Chat free text is never executable; structured `offer_id` only.

## FI hosting

```
Browser
  → hosted-games/immortal-shores/     # static client (PWA)
  → /api/...  and  /chat  WS          # game server (tunnel)
  → Postgres (private; file store OK for single-node dev)
```

See `HOSTING.md`.

## Build phases

1. **Prompt 01** — playable core → `PROMPT-01-COMPLETE.md` (**done** at `9f0479d`)  
2. **Prompt 01.5** — 2026 modernization (trust trade, PWA, QoL, onboarding, social) → `PROMPT-01.5-COMPLETE.md`  
3. **Prompt 02** — visual gauntlet → impartial judge PASS → `PROMPT-02-COMPLETE.md`  

Do not skip 01.5 before 02. Do not merge phases unless the director requests it.
