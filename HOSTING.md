# HOSTING — Immortal Shores

## Local development

```bash
# from repo root
npm install
npm run build -w @immortal/shared
npm run dev
```

- Client: http://127.0.0.1:5173 (Vite proxies `/api` → server)
- Server: http://127.0.0.1:8787
- Health: `GET /health`

### Persistence

By default the server uses a **file-backed world store** at `apps/server/data/world.json` (no Docker required). Good for single-process dev and Prompt 01/01.5.

### PostgreSQL (production multiplayer)

```bash
docker compose up -d
# Planned: DATABASE_URL=postgres://immortal:immortal@localhost:5432/immortal_shores
```

`docker-compose.yml` ships Postgres 16. A full SQL driver is the next hardening step when multi-instance hosts are required; file store remains the documented dev default.

### Live channels

- **WebSocket** `GET /ws?token=` — snapshots + chat/trade/barge/notify events  
- **Long-poll** `GET /api/poll?since=` — fallback for older browsers  

### Auth

- Dev: name + password register/login (token in `Authorization: Bearer`)  
- Optional: `POST /api/account/email`, TOTP setup/enable, `POST /api/login-2fa`

## Environment

| Var | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATA_DIR` | `apps/server/data` | World JSON directory |
| `NODE_ENV` | — | `production` locks debug routes unless `ALLOW_DEBUG=1` |
| `ALLOW_DEBUG` | — | Enable `/api/debug/*` in production |

## FI Arcade shape

```
Browser
  → hosted-games/immortal-shores/   # static client (npm run build -w @immortal/client → apps/client/dist)
  → /api + /ws                     # game server (Cloudflare Tunnel or reverse proxy)
  → private DATA_DIR or Postgres
```

### Identity

- Local register/login for dev.
- When hosted behind FI, accept `X-FI-User` / session middleware (hook point in `apps/server/src/index.ts` auth helper).

### Backups

- Copy `DATA_DIR/world.json` (and ledger growth) on a schedule.
- Health endpoint for uptime checks: `GET /health`.

### Ports

- Game API: **8787**
- Vite dev only: **5173**
