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

## Persistence

The server is a **single-process, file-backed store**. That is the supported production
target — there is no database and no extra runtime dependency.

Everything lives in one directory, `DATA_DIR`:

```
$DATA_DIR/
  world.json                     # the whole world: players, settlements, market, mail…
  sessions.json                  # durable login tokens (mode 0600)
  backups/world-<ISO>.json       # rotating timestamped copies (newest 12 kept)
  world.json.corrupt-<ISO>       # only if a damaged file was found (never deleted)
```

**DATA_DIR must be a persistent volume that outlives the container/release.** It defaults to
`apps/server/data`, which is fine for dev and wrong for anything hosted — a redeploy that
recreates the filesystem there deletes every settlement.

### Durable sessions

Login tokens are stored in `sessions.json`, not in memory, so **a redeploy does not sign
anyone out**. Each record carries `issuedAt` / `lastSeenAt` and a **30-day sliding window**:
using the token refreshes it, going 30 days unused expires it. Expired tokens are rejected
by `playerIdFromToken()` and reaped on load and periodically thereafter, as are tokens
pointing at a player that no longer exists.

If `sessions.json` is unreadable the server logs it and starts with zero sessions — players
sign in again, and **no world data is touched**. That is the only failure the server treats
as recoverable-by-forgetting.

### Atomic writes

Every write (`world.json`, `sessions.json`) goes to a temp file in the same directory, is
`fsync`ed, and is then moved into place with a single `rename()`. A crash, OOM kill or
`docker stop` mid-write leaves either the complete old file or the complete new file —
never a truncated one. Leftover `*.json.tmp-*` files are junk from a killed write and are
pruned on the next boot.

The world is written at most every 5 seconds (only when dirty), immediately on
register/login, and once more synchronously during shutdown.

### Corruption is never "start over"

On boot the server reads `world.json`, checks it is shaped like a world, and migrates it.
If that fails it will, in order:

1. restore the newest **backup that parses**, renaming the damaged file to
   `world.json.corrupt-<ISO>` (kept for forensics, never overwritten);
2. if no backup is usable, **refuse to start** with an actionable error and change nothing.

A `world.json` that is *missing* while backups exist is also treated as damage and restored
rather than started empty. A world stamped with a **newer `schemaVersion`** than the running
build is refused outright — it is never silently downgraded, because a downgrade write would
drop the fields the newer build added.

### Migration

`schemaVersion` is currently **2**. Migration is forward-safe: unknown keys written by a
newer build are preserved, missing collections are filled with empty defaults, and existing
`players` / `settlements` are never replaced. To add a field in a future iteration, add it to
`emptyWorld()`; old worlds pick up the default and keep all their data. Bump `SCHEMA_VERSION`
only when adding a real migration step in `migrateWorld()` in `apps/server/src/store.ts`.

## Backups and restore

- A backup is copied into `$DATA_DIR/backups/` **on every boot** (before the new process
  writes anything) and then at most once every 30 minutes while running.
- The newest `WORLD_BACKUP_KEEP` (default 12) are kept; older ones are pruned.
- Backups are plain `world.json` copies — nothing special to decode.

**Restore procedure**

```bash
systemctl stop immortal-shores          # or: docker compose stop server
ls -t $DATA_DIR/backups/                # newest first
cp $DATA_DIR/backups/world-<ISO>.json $DATA_DIR/world.json
systemctl start immortal-shores
```

Keep the `world.json.corrupt-*` file until you are satisfied with the restore. Off-box
backups: `rsync`/`tar` the whole `$DATA_DIR` on a schedule; copying `world.json` while the
server runs is safe because writes are atomic renames.

## Deploying a new iteration WITHOUT losing player data

1. `DATA_DIR` points at a volume **outside** the release/checkout directory (e.g.
   `/srv/immortal-shores/data`), and the new release must be given the same path.
2. Build the new release: `npm run build` (shared → server → client).
3. `SIGTERM` the old process (`systemctl stop`, `docker stop`). It stops accepting requests,
   then flushes the world and sessions synchronously before exiting — do not `kill -9`, and
   allow at least 10s of stop timeout.
4. Copy `$DATA_DIR/world.json` somewhere off-box if the release contains a schema change.
5. Start the new process with the same `DATA_DIR`. It takes a fresh backup before its first
   write, so the pre-deploy world is always recoverable.
6. Verify `GET /health` reports the expected `players` / `settlements` counts, and that an
   existing player's token still works (no login wall). If the server refuses to start, read
   the error — it names the file and the restore path; do not delete `world.json`.

Static client (`apps/client/dist`) can be redeployed freely; it holds no authoritative state.

### Live channels

- **WebSocket** `GET /ws?token=` — snapshots + chat/trade/barge/notify events
- **Long-poll** `GET /api/poll?since=` — fallback for older browsers

### Auth

- Name + password register/login; token in `Authorization: Bearer` and in `?token=` for `/ws`
- Optional: `POST /api/account/email`, TOTP setup/enable, `POST /api/login-2fa`
- Client stores the token in `localStorage` under `immortal_token`, falling back to an
  in-memory token when storage throws (iOS Safari private mode) or is evicted. A `401`
  clears the token and drops the player on the login screen with a "session expired"
  message instead of an unhandled error.

## Environment

| Var | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATA_DIR` | `apps/server/data` | **Persistent** world/session/backup directory — set this in production |
| `WORLD_BACKUP_KEEP` | `12` | Rotating backups retained (min 2) |
| `WORLD_BACKUP_INTERVAL_MIN` | `30` | Minutes between running backups |
| `NODE_ENV` | — | `production` locks debug routes unless `ALLOW_DEBUG=1` |
| `ALLOW_DEBUG` | — | Enable `/api/debug/*` in production |

## FI Arcade shape

```
Browser
  → hosted-games/immortal-shores/   # static client (npm run build -w @immortal/client → apps/client/dist)
  → /api + /ws                     # game server (Cloudflare Tunnel or reverse proxy)
  → private persistent DATA_DIR    # world.json + sessions.json + backups/
```

Run exactly **one** server process per `DATA_DIR`. The store is single-process by design;
two processes on the same directory would overwrite each other's worlds. `docker-compose.yml`
still ships a Postgres container from an earlier plan — it is unused, and nothing in the
server talks to it.

### Identity

- Local register/login for dev.
- When hosted behind FI, accept `X-FI-User` / session middleware (hook point in
  `apps/server/src/index.ts` auth helper).

### Ports

- Game API: **8787**
- Vite dev only: **5173**
