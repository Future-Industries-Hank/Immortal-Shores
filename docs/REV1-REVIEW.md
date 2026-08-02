# Rev 1 review — builder work at `9f0479d`

**Reviewed:** 2026-08-02 against Prompt 01 done criteria + GDD  
**Commit:** `9f0479d` — *feat: Prompt 01 playable core — sparse pads, economy, paths*  
**Author notes:** `PROMPT-01-COMPLETE.md`, `BUILD-CHECK.md`, `SELF-REVIEW.md`

---

## Verdict

**Prompt 01 is legitimately complete as a playable core.** Monorepo boots, server-authoritative ticks work, starter economy and multiplayer trade path exist, empire systems are present at API depth, and the team correctly stopped before the AAA visual judge.

It is **not** yet the 2026 product described in the new Implementation Guide — that is **Prompt 01.5** (systems/UX/social) then **Prompt 02** (visual gauntlet).

---

## What the builder delivered well

| Area | Assessment |
|---|---|
| **Monorepo** | `packages/shared` rates/types/grid · `apps/server` Fastify · `apps/client` Vite+Babylon — clean split |
| **Sparse plot layout** | Already Nile-style: river left, 5 shop / 4 special / 3 training pads (`grid.ts`) — **aligned with 2026 guide core layout** |
| **Starter kit** | GH1, Market, Emmer/Clay/Reed, 18 Workers, 60 Rations, 40 Mudbricks, 10 Seals, random luxury specialty |
| **Tick economy** | Production rates, Ration upkeep, shortage, Worker +3/h to GH cap, offline catch-up + unit tests |
| **Construction** | One queue, ~25% cancel refund, GH + Seal thresholds |
| **Trade path** | Market (Rations), Tablet Wall structured offers, mail gifts, Seal floor 10; free text never settles |
| **Empire APIs** | Harbor/barges, military, monuments, multi-settlement, shrine, envoy, Ascension |
| **World / visit** | Province map stub, postcard, read-only visit |
| **Client** | Isometric orthographic, papyrus HUD panels, quality tiers, dual-ish input |
| **Honesty** | `has_complete_loop: true`; visual debts listed for Prompt 02; file store vs Postgres called out |

---

## Judgment calls (builder) — accept or reverse

| Call | Note for next prompts |
|---|---|
| **File store default** | OK for rev 1. Prompt 01.5 should harden multi-instance path (Postgres) if hosting multiplayer seriously. |
| **Construction via free workers** | Acceptable abstraction if documented; keep one-active-build rule. |
| **Unit training instant after pay** | Fine for short sessions; optional later: real 4 worker-hour train timer. |
| **Market province range not filtered** | **Fix in 01.5** (GDD rule). |
| **Escrow-style settle on structured offers** | **Reverse in 01.5** — 2026 guide: **trust-based trade, no escrow**. |

---

## Gaps vs original GDD (still open)

- Market visibility by Market level / province range incomplete.  
- Some military/monument/Ascension depth may be thin vs full GDD numbers (API present; tune fidelity in 01.5).  
- Postgres not wired; single-process file store.  
- Safari matrix incomplete.  
- Procedural massing only (expected for P01).

---

## Gaps vs 2026 Implementation Guide (Prompt 01.5 / 02)

### Prompt **01.5** (systems, trust trade, modern UX — not AAA art)

- PWA + three responsive breakpoints (desktop / tablet / mobile portrait).  
- WebSockets for ticks/barges/trades/chat + long-poll fallback.  
- Account: email + optional TOTP 2FA; session recovery across devices.  
- **Remove escrow**; trust-based Market / Tablet Wall / barges; templates, history, reputation flags, preferred partners.  
- Production overlay, balance helper, ration-runout warnings, pause non-essential production.  
- Onboarding tutorial + dismissible First Week Goals.  
- Chat: emoji, markdown, @mentions, search, mute; Province channel default on settlement.  
- Trading Circles (max 12, private board only).  
- Browser push + optional email notifications (construction, barge, trade, blessing, envoy).  
- Cosmetics-only monetization; seasonal provincial events (no P2W, no speed-ups, no extra plots).  
- Legacy page for Ascensions / ranking feedback.  
- Plot hover/long-press category affordances; Storehouse naming vs warehouse.

### Prompt **02** (visual gauntlet)

- High-contrast isometric kit; dark mode + color-blind palette.  
- Spatial composition polish (fields by water, Harbor pier path, generous spacing).  
- Empty-plot iconography by category.  
- Living Workers, workshop/barge VFX, PBR materials, day/night atmosphere.  
- UI chrome production values.  
- Impartial judge PASS (5 rounds).

---

## Recommendation

1. Keep Prompt 01 closed — do not reopen the playable bar.  
2. Run **Prompt 01.5** next against live code at `9f0479d` (or later main).  
3. Only then run **Prompt 02** visual gauntlet with sim fence intact.
