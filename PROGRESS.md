# PROGRESS — Immortal Shores (Prompt 01)

## 2026-08-02 — Prompt 01 started (Windows PC)

- Cloned `Future-Industries-Hank/Immortal-Shores`
- Scaffolded monorepo: `packages/shared`, `apps/server`, `apps/client`
- Server: Fastify + file store, full tick/offline catch-up, workers, construction, market, escrow/offers, gifts/mail, chat, barges, military/monuments, founding, shrine, envoy, ascend, postcard/visit
- Client: Vite + Babylon isometric orthographic, papyrus UI, dual input, quality tiers, panels for Shore/Harbor/Tablets/Wall/Build/Military/Map
- docker-compose.yml for optional Postgres; default path is file store (no Docker on build machine)

## Next

- npm install + tests + browser smoke
- BUILD-CHECK.md + PROMPT-01-COMPLETE.md
