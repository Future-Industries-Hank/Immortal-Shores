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

By default the server uses a **file-backed world store** at `apps/server/data/world.json` (no Docker required). Schema mirrors the Postgres-oriented economy model (vaults, ledger, mail, escrow, market, barges).

### Optional PostgreSQL (docker-compose)

```bash
docker compose up -d
# future: set DATABASE_URL=postgres://immortal:immortal@localhost:5432/immortal_shores
```

Postgres is specified for production FI hosting; the file store is the Prompt 01 default so agents and players can run without Docker.

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
