# BUILD-CHECK 01.5 — 2026 Product Modernization

**Date:** 2026-08-02  
**Baseline:** `main` @ `88261d1` + Prompt 01.5 implementation  
**Scope:** Systems / UX / trust trade / social / onboarding — **not** AAA art

| Check | Result | Notes |
|---|---|---|
| Server tests (GDD rates + trust trade) | **PASS** | 6/6 including trust wall (no debit on post) + market range |
| Typecheck server + client | **PASS** | `tsc` clean |
| Trust trade (no escrow product) | **PASS** | Wall offers soft-list; atomic accept only; ledger `trade_accept` |
| Market province range | **PASS** | Filtered by Market level × riverIndex distance |
| Production overlay / balance / pause / ration warn | **PASS** | Shore panel + HUD; helpers optional |
| PWA shell | **PASS** | `manifest.webmanifest` + `sw.js` (API/ws never cached) |
| Responsive breakpoints | **PASS** | CSS desktop / tablet ≤1024 / mobile ≤720 portrait |
| WS + long-poll | **PASS** | `/ws` events (chat/trade/barge/notify); `/api/poll` fallback |
| Tutorial + First Week Goals | **PASS** | Server flags + client panels; goals dismissible |
| Trading Circles max 12 | **PASS** | Create/join/board API + Allies UI |
| Cosmetics / seasonal / Legacy | **PASS** | Scaffolded, no P2W |
| Barge ETA | **PASS** | Harbor panel shows hours to arrive |
| GDD rates unchanged | **PASS** | Shared `rates.ts` / production helpers use same numbers |

## Commands

```text
npm install
npm run build -w @immortal/shared
npm run test -w @immortal/server
npm run typecheck -w @immortal/server
npm run typecheck -w @immortal/client
npm run dev
```

## Browser smoke (manual)

1. Register new account → tutorial card appears.  
2. Shore: Toggle overlay · Apply balance · Pause non-essential · ration banner if low.  
3. Tablet Wall: Province channel default; post **trust** offer; second account accepts without prior vault lock on poster.  
4. Market only shows in-range orders for L1 Market.  
5. Allies: reputation after trades; create Circle; seasonal contribute stub.  
6. Mobile width: bottom panels + 48px nav targets.

## Explicit non-goals (Prompt 02)

AAA PBR art, impartial visual judge, particle max-out.
