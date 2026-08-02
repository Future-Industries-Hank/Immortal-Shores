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

Server owns: production ticks, Worker growth, construction, vaults, Seals, mail, escrow, market, barges, military outcomes, chat fan-out.  
Client owns: camera, presentation, input intents, cosmetic prediction.

## Economy spine

Vault + mail + escrow/pay-on-receive + Market + barges + double-entry ledger.  
Chat free text is never executable; structured `offer_id` only.

## FI hosting

```
Browser
  → hosted-games/immortal-shores/     # static client
  → /api/...  and  /chat  WS          # game server (tunnel)
  → Postgres (private)
```

See `HOSTING.md` (created during Prompt 01).

## Build phases

1. **Prompt 01** — playable core until `PROMPT-01-COMPLETE.md`  
2. **Prompt 02** — visual overhaul until impartial judge PASS  

Do not merge the two phases into one agent run unless the director explicitly requests it.
