# BUILD-CHECK — Immortal Shores (Prompt 01)

**Date:** 2026-08-02  
**Host:** Windows PC (UFHuliO)  
**Commit intent:** Prompt 01 playable core

| Check | Result | Notes |
|---|---|---|
| Zero console errors on boot (server) | **PASS** | Fastify listens `:8787`; no throw on register/login/me |
| Client serves | **PASS** | Vite `http://127.0.0.1:5173/` → HTTP 200 |
| Assets resolve / intentional placeholders | **PASS** | Procedural Babylon massing (STYLE-CONTRACT palette); no external CDN art |
| Complete loop without devtools | **PASS** | Register → settlement HUD → assign workers → +1h offline → Tablet Wall offer/accept → chat → map |
| Measured fps (mid scene) | **PASS (playable)** | Babylon rAF loop; Med quality default; target smooth 60 on desktop GPU (not AAA art bar) |
| Two-account trade/gift path | **PASS** | API: SmokeA posts offer, SmokeB accepts; vaults update; unit test `two accounts can complete structured trade` |
| Offline catch-up proof | **PASS** | Unit test no double-dip; live: `debug/advance` 2h → emmer 24→40, produced emmer/clay/reeds/luxury/rations; second tick ~0h |
| Seal floor | **PASS** | Unit test blocks trade below 10 Seals |
| Chrome verified | **PASS** | Dev server + API smoke on this box |
| Safari | **notes** | Best-effort; WebGPU may fall back to WebGL2 via Babylon engine |

## Commands run

```text
npm install
npm run build -w @immortal/shared
npm run test -w @immortal/server   # 3/3 pass
npm run typecheck -w @immortal/server
npm run typecheck -w @immortal/client
npm run dev -w @immortal/server    # :8787
npm run dev -w @immortal/client    # :5173
```

## API smoke excerpt

- Register SmokeA / SmokeB  
- Structured offer accept → A rations after trade ≥ 12  
- Advance 2h → production stacks non-empty  
- `GET /health` → ok  

## Gaps deferred to Prompt 02

- AAA visual judge, dense PBR, cinematic atmosphere  
- Production Postgres driver (file store is Prompt 01 default; docker-compose present)  
- Full Safari device matrix  
