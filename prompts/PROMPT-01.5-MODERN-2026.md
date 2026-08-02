# PROMPT 01.5 — Immortal Shores: 2026 Product Modernization

### Systems · UX · Trust trade · Social · Onboarding  
### Run after Prompt 01 · Before Prompt 02 visual gauntlet

> **Phase:** 1.5 of 3  
> **Baseline:** `main` at **`9f0479d`** or later (Prompt 01 complete — playable core).  
> **Stop when:** 2026 Implementation Guide systems are live, playable, and documented — **not** when art is AAA.  
> **Do not** run the impartial visual judge (that is Prompt 02).  
> **Do not ask questions.** Infer, implement, verify in browser, push.

---

## Mission

Immortal Shores **already plays** (see `PROMPT-01-COMPLETE.md`). Your job is to bring the live codebase up to the **Complete 2026 Implementation Guide** without changing original mechanical rates, plot limits, unique-luxury force-trade, Great House progression, monuments, or Ascension numbers.

**Canonical docs (read all):**

| Doc | Role |
|---|---|
| `docs/MODERN-2026.md` | Full 2026 layer — **this prompt’s primary checklist** |
| `docs/REV1-REVIEW.md` | What rev 1 did; known gaps and escrow reverse |
| `docs/GDD.md` | Original mechanics & numbers (do not break) |
| `docs/ECONOMY.md` | Update to **trust trade** (no escrow) as you go |
| `PROMPT-01-COMPLETE.md` | How to run; current surface area |

**Soul:** slow, thoughtful, trade-dependent, limited-space city building with long-term legacy — modern usability, not a different game.

---

## Critical design correction (must fix)

Rev 1 implemented **escrow-style** structured trade.  
2026 guide: **there is still no escrow.** Trust remains. Tools only make honest trading smoother.

### Required trade model

| Channel | Behavior |
|---|---|
| **Market** | Posted order; **taker pays immediately** from vault (atomic). Rations currency. **Filter by Market level → province range** (fix incomplete Market filter). |
| **Tablet Wall** | Structured offer cards + shorthand culture. Accept = atomic if taker can pay; no long-hold multi-day escrow wallets. |
| **River Barges** | Original costs/capacity/travel; trust/social logistics; ETA UI; risk at 11+ barges. |
| **Gifts / mail** | OK to debit-on-send or accept-to-credit for UX — not “escrow marketplace.” |
| **Seals** | Floor of 10 preserved. |

- Remove or rename escrow UX/ledger reasons that imply bank-held counterparty protection.  
- Keep **server authority** and **ledger audit**.  
- Free-text chat still never executes transfers.

---

## Settlement layout (rules already mostly in code)

Confirm and refine against `packages/shared/src/grid.ts` + MODERN-2026 §2:

- Pre-placed: GH, Market, Emmer, Clay, Reeds.  
- **5** Shop · **4** Special (Storehouse/Warehouse, Shrine, Harbor, unique luxury) · **3** Training.  
- River left; fields by water; GH+Market center; shops right; special inland with Harbor pier cue; training outer; generous spacing.  
- Empty pads color/icon by category; hover/long-press shows allowed building categories.  
- One construction at a time; cancel ≈25%.

Do **not** add extra plots or freeform city painting.

---

## Work packages (implement in order)

### A — Platform & accounts

1. **PWA** (manifest, service worker strategy that does not break Vite dev, installable).  
2. Responsive breakpoints: desktop / tablet / mobile portrait (collapsible panels, 44px+ targets).  
3. **WebSocket** push for tick summaries, barge events, trade events, chat; **long-poll fallback**.  
4. Auth: email (+ password), optional **TOTP 2FA**, session recovery / continue on any device.  
5. Keep local/dev login path for FI/testing if needed; document in `HOSTING.md`.

### B — Production QoL (optional tools, always dismissible)

1. Live production overlay per building (workers, output/h, ration drain).  
2. Balance helper for Emmer→Rations and Clay/Reeds→Mudbricks equilibrium + Apply Suggested Assignment.  
3. Ration-runout warnings (yellow/red, hours-until-empty).  
4. “Pause all non-essential production” for long offline.

Rates must still match GDD after any helper applies.

### C — Trade modernization (trust-based)

1. Kill escrow product framing; atomic market/wall takes only.  
2. Offer **templates**.  
3. Barge ETA / travel-time display; mobile load UI (sliders, fill capacity).  
4. Trade history per counterparty; “N successful trades” reputation flag.  
5. Preferred partners pin-to-top.  
6. Market province range by Market level.

### D — Social & notifications

1. Tablet Wall: General / Trade / **Province default on settlement view**.  
2. Chat: emoji, basic markdown, @mentions, search, mute.  
3. **Trading Circles** (≤12, private board, no shared storage/power).  
4. Notifications: browser push + optional email hooks for construction, barge, trade, blessing, envoy — user toggles.

### E — Onboarding

1. Mandatory interactive tutorial (place Mudbrick+Ration → assign workers → unique luxury lesson → first offer/trade → GH upgrade requirements).  
2. Dismissible **First Week Goals** checklist.  
3. Show-don’t-tell; no walls of text after tutorial.

### F — Live service shell (no P2W)

1. Cosmetics framework (skins for GH/shops/barges, banners, seasonal ground/river) — earn or buy; **no** power.  
2. Seasonal provincial event stub (community goal → temporary blessing only).  
3. Legacy page: Ascension history + ranking toward Ancestral Monument tier.  
4. Monument bonus HUD clarity (numbers already from GDD).

### G — Hardening

1. Postgres path usable in production (file store may remain dev default — document).  
2. Expand tests: trust trade accept, market range, tutorial completion flag, pause production.  
3. Update `docs/ECONOMY.md`, `CHANGELOG.md`, `PROGRESS.md`, `ai_manifest.json`.  
4. Fresh `BUILD-CHECK-01.5.md` with browser evidence of tutorial + mobile layout + WS.

---

## Explicit non-goals (Prompt 02 only)

- AAA PBR/glTF art pass, impartial visual judge, particle max-out  
- Changing GDD rates, plot counts, Seal thresholds, monument math  
- Speed-ups, extra plots, extra luxuries, pay-to-win  

---

## Done criteria (STOP HERE)

Mark complete only when:

1. Trust trade live (no escrow product); Market range works; barge ETAs readable.  
2. Production overlay + balance helper + ration warnings + pause non-essential exist and are optional.  
3. PWA installable; desktop + mobile portrait usable.  
4. WS (or long-poll) delivers at least chat + one economy event class.  
5. Tutorial completable by a new account; First Week Goals present.  
6. Trading Circles or a clearly stubbed API + UI with max-12 rule (prefer full private board).  
7. Cosmetics/seasonal/Legacy at least scaffolded without power creep.  
8. `BUILD-CHECK-01.5.md` green; `PROMPT-01.5-COMPLETE.md` written.  
9. Original GDD rates still pass server tests.

Then **stop**. Hand off to Prompt 02 for the visual gauntlet.

---

## Start order

1. Read MODERN-2026 + REV1-REVIEW; run `npm install && npm run dev`; smoke rev 1.  
2. Trade model fix (escrow out) + Market range.  
3. Plot UX affordances + production QoL.  
4. PWA + responsive + WS.  
5. Onboarding tutorial.  
6. Social polish + notifications.  
7. Circles / cosmetics / seasonal / Legacy shell.  
8. Tests + BUILD-CHECK-01.5 + COMPLETE note → **STOP**.
