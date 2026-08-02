# PROMPT 01 COMPLETE — Immortal Shores

**Status:** Playable core delivered. **Stop here** for Prompt 01. Do not run Prompt 02 visual judge in this session.

## How to run

```bash
cd Immortal-Shores   # or C:\Users\eric_\GameMaking\Immortal-Shores
npm install
npm run build -w @immortal/shared
npm run dev          # server :8787 + client :5173
```

Open **http://127.0.0.1:5173** → **Found settlement** (register) or **Return** (login).

Optional: `docker compose up -d` for Postgres (file store is default; see `HOSTING.md`).

## What works

| Area | Behavior |
|---|---|
| Session | Register/login, resume via token |
| Settlement | Isometric view, starter buildings, unique luxury |
| Economy tick | Production, Ration upkeep, shortage multiplier, Worker +3/h to GH cap, offline catch-up |
| Workers | Assign/unassign per building with caps |
| Construction | One queue; cancel ≈25% refund; GH upgrade + Seal sinks |
| Trade | Market (Rations), Tablet Wall structured offers, mail gifts, Seal floor 10 |
| Chat | General/Trade; free text never executes transfers |
| World | River provinces, founding sites, monuments, city markers; visit + postcard |
| Empire depth | Harbor/barges, military/monuments, multi-settlement founding, shrine blessing, envoy, Ascension API |
| Audio | Synthesized SFX on core actions |
| Quality | Low/Med/High hardware scaling |

## Tests

- `npm run test -w @immortal/server` — offline catch-up, two-account trade, seal floor (3/3)
- Live API smoke on build machine (see `BUILD-CHECK.md`)

## Visual debts for Prompt 02

- Replace procedural boxes with glTF/PBR riverside kit  
- Worker walk cycles, workshop VFX, barge models, river foam  
- Day/dusk polish, contact-shadow quality, UI chrome refinement  
- Impartial visual judge evidence pack under `tools/judge/`  
- Dense LODs / KTX2 pipeline  

## Manifest

`ai_manifest.json` → `has_complete_loop: true`, implementation percentages updated.

## Explicit non-goals (this prompt)

- AAA impartial visual PASS  
- Full Blender production pipeline  
- Mind-blowing particle max-out  
