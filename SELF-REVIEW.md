# SELF-REVIEW — Prompt 01

## What works

- Full monorepo boot: shared GDD rates, Fastify server, Vite+Babylon client  
- Authoritative tick + offline catch-up with capped hours and no double-dip  
- Starter kit matches GDD (GH1, Market, Emmer/Clay/Reed, 18 Workers, 60 Rations, 40 Mudbricks, 10 Seals, random unique luxury)  
- Worker assign, construction queue + ~25% cancel refund, luxury workshop path  
- Market + Tablet Wall structured offers + mail gifts + chat (free text never settles)  
- Harbor/barges, military train, monument capture, multi-settlement founding, shrine, envoy, Ascension API  
- World map sites, postcard capture, read-only visit  
- Quality tiers + keyboard pan + touch-friendly targets  

## Judgment calls

1. **File store vs Postgres:** Docker unavailable on build machine; implemented transactional in-process vault + JSON persistence with docker-compose for later Postgres. Economy fence preserved (server-only mutations, ledger rows).  
2. **Construction progress:** Free workers advance the single queue; GDD worker-hours modeled without a separate “construction crew” building.  
3. **Unit training:** Instant after resource pay (4 worker-hours abstracted) so military is playable in short sessions.  
4. **Barge risk:** 8% partial cargo loss at fleet ≥11.  

## Risks

- File store is single-process; multi-instance deploy needs Postgres/redis later.  
- Visual massing is readable placeholders — Prompt 02 territory.  
- Market province range not yet filtering by Market level (orders global for V1 readability).  

## Not claimed

- Impartial visual AAA PASS  
- Perfect mobile Safari parity  
