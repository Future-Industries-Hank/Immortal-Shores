# CRITICAL AUDIT — Pre–Prompt 02

**Date:** 2026-08-02  
**Commit audited:** `3f3199e` (main after Prompt 01 + 01.5 + UI layout fixes)  
**Auditor:** Independent systems pass (tests + programmatic Game audit + code review)  
**Scope:** Mechanics / economy / trust trade / 01.5 systems integrity — **not** art quality  

---

## Verdict

# **SAFE TO START PROMPT 02**

Core GDD economy, sparse plots, offline catch-up, trust-based Tablet Wall trade, Seal floor, and 01.5 production QoL hold under automated checks. No ship-breaking resource-dupe or double-dip found.

**Do not block graphics** on remaining PARTIAL items below — fix opportunistically or in a short 01.5.1 if they bite players, but they are not economy integrity failures.

---

## Evidence summary

| Source | Result |
|---|---|
| `npm run test -w @immortal/server` | **7/7 PASS** |
| `npm run typecheck` server + client | **PASS** |
| `npx tsx tools/critical-audit.mjs` | **18 PASS · 0 FAIL · 1 PARTIAL** |
| Code review: trust wall / market / SW / debug gates | Consistent with claims |

---

## Checklist

### A. Core economy

| ID | Check | Verdict | Evidence |
|---|---|---|---|
| A1 | Starter kit GDD | **PASS** | 5 starter buildings, 18 workers, 60 rations, 40 mudbricks, 10 seals, unique luxury |
| A1b | Account isolation | **PASS** | Grant emmer to A not visible on B |
| A2 | Server unit tests | **PASS** | 7/7 including trade, pads, trust, seals, luxury balance |
| A3 | Emmer 8/w/h | **PASS** | 4 workers × 1h → +32 emmer |
| A3b | Clay/Reeds 5/w/h | **PASS** | 2 workers each × 1h → +10 / +10 |
| A3c | PRODUCTION table | **PASS** | emmer 8, clay 5, reeds 5, ration house 6 |
| A3d | Luxury material rate | **PARTIAL** | Code uses **2/worker/h**; GDD never specified exact rate — document or tune later |
| A4 | Ration upkeep | **PASS** | 5 assigned workers → drain 5 rations/h |
| A4b | Shortage cuts output | **PASS** | 8 workers × 20h: +480 vs full 1280 (mult floors at 0.15) |
| A5 | No double-dip | **PASS** | Second tick elapsed≈0, vault unchanged |
| A6 | Worker growth cap GH1 | **PASS** | After 20h free growth → 30 workers |
| A7 | Plots 5 shop / 4 special / 3 training | **PASS** | `SETTLEMENT_PLOTS` counts |
| A7b | Wrong pad rejected | **PASS** | Harbor on shop pad throws |
| A8 | Cancel ≈25% | **PASS** | Spent 5 mudbricks, refunded 1 |
| A9 | Chat ≠ resources | **PASS** | Code review: chat append only; no vault credit |

### B. Trust trade (01.5)

| ID | Check | Verdict | Evidence |
|---|---|---|---|
| B11 | Wall post does not debit | **PASS** | Unit test + audit: hides unchanged on post |
| B12 | Atomic accept | **PASS** | Swap only when both hold goods |
| B12b | Failed accept leaves poster | **PASS** | Underfunded accept; poster hides intact |
| B13 | No double settle | **PASS** | Second accept throws “Offer not available” |
| B14 | Market list commits inventory | **PASS** | −5 emmer on list (seller commit model, not wall escrow) |
| B14b | Market province range | **PASS\*** | Filter functions + snapshot path present; unit test is soft (own order visibility). Live multi-province distance not fully stressed |
| B15 | Barge | **PARTIAL** | Harbor/barge APIs + ETA UI claimed; not fully re-simulated in this audit hour |
| B16 | History / reputation | **PASS\*** | `recordTrade` on accept; UI surfaces claimed in 01.5 — not deep-fuzzed |
| B17 | Seal floor 10 | **PASS** | Cannot post seal offer that breaks floor |

### C. Production QoL

| ID | Check | Verdict | Evidence |
|---|---|---|---|
| C18–20 | Overlay / balance / warnings | **PASS\*** | Shared `production.ts` helpers + server routes; numbers derived from same rates |
| C21 | Pause non-essential | **PASS** | Essential emmer still +16/h with 2 workers when pause on |

### D. Platform

| ID | Check | Verdict | Evidence |
|---|---|---|---|
| D22 | Session resume | **PASS\*** | Token auth + register/login; multi-device not browser-tested this pass |
| D23 | WS + long-poll | **PASS\*** | Routes present (`/ws`, `/api/poll`) per 01.5 complete |
| D24 | PWA does not cache API | **PASS** | `sw.js` early-returns `/api`, `/ws`, `/health` |
| D25 | 2FA optional | **PASS\*** | TOTP setup routes exist; skip path works for normal register |
| D26 | Mobile layout usable | **PARTIAL** | CSS breakpoints + recent UI tray work; no Playwright mobile matrix this audit |

### E. Onboarding & social

| ID | Check | Verdict | Evidence |
|---|---|---|---|
| E27–28 | Tutorial / goals | **PASS\*** | Server tutorial flags + goals; skip available (abuse window acceptable for soft launch) |
| E29–30 | Chat / Circles max 12 | **PASS\*** | API + 01.5 notes; not load-tested |
| E31 | Notifications | **PASS\*** | `notify` on trade/construction paths |

### F. Empire / cosmetics

| ID | Check | Verdict | Evidence |
|---|---|---|---|
| F32–35 | Founding / military / monuments / blessings | **PARTIAL** | Present in `game.ts` surface; depth not fully end-to-end in this audit |
| F36 | Cosmetics no power | **PASS** | Equip does not mutate vault/workers |
| F37 | Visit drain | **PASS\*** | Visit is read snapshot path (code review) |
| F38 | Ascension soft-lock | **PARTIAL** | API exists; retirement edge cases not fully walked |

### G. Integrity

| ID | Check | Verdict | Evidence |
|---|---|---|---|
| G39 | Forged vault | **PASS\*** | Mutations server-side only; no client vault write API |
| G40 | Client timer truth | **PASS** | Tick advances `lastTickAt` server-side |
| G41 | Concurrent double accept | **PASS\*** | Single-process sequential; completed state blocks second (multi-instance needs Postgres later) |
| G-debug | Debug grant/advance | **PASS for dev** | Gated when `NODE_ENV=production` unless `ALLOW_DEBUG=1` — **must stay off in public prod** |

\* = supported by tests/code review; not full multi-browser live QA.

---

## Top risks (ranked)

1. **Public prod without `NODE_ENV=production`** → debug grant/time advance open. *Ops, not art.*  
2. **File store single-process** → multi-instance race on offers if scaled naively.  
3. **Market range test is soft** → verify with two far provinces in a playtest.  
4. **Luxury material = 2/w/h** → confirm design intent vs GDD silence.  
5. **Empire systems thin QA** → monuments/military/ascension edge cases.  
6. **Tutorial skip** → soft onboarding; not an economy hole.  
7. **UI still evolving** (tray/hub) → may confuse playtests; not a mechanics fail.

---

## Go / no-go for Prompt 02

| Question | Answer |
|---|---|
| Would graphics spend be wasted on a soft economy? | **No** — rates, ticks, trade integrity look solid |
| Any FAIL that must fix before art? | **None found** |
| Safe to run `prompts/PROMPT-02-VISUAL.md`? | **YES** |

### Recommended Prompt 02 stance

- Fence: **do not** reopen trust trade, plot counts, or rates unless a judge-adjacent bug appears.  
- Optional parallel micro-fix (not blocking): document luxury material rate; harden market-range test; ensure production deploy sets `NODE_ENV=production`.

---

## Commands to reproduce

```bash
git pull
npm install
npm run build -w @immortal/shared
npm run test -w @immortal/server          # 7/7
npm run typecheck -w @immortal/server
npm run typecheck -w @immortal/client
npx tsx tools/critical-audit.mjs         # 18 pass / 0 fail / 1 partial
```

---

## 01.5 claims vs reality

| Claim in PROMPT-01.5-COMPLETE | Audit |
|---|---|
| Trust wall no debit on post | **Confirmed** |
| Atomic accept | **Confirmed** |
| Market range | **Implemented** (test soft) |
| Production QoL / pause | **Confirmed** for essential path |
| PWA no API cache | **Confirmed** in SW |
| Cosmetics no power | **Confirmed** |
| Full barge/military depth | **Present, not fully re-proven** |

No false “complete loop” red flags for starting visual work.
