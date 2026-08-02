# PROMPT 01.5 COMPLETE — 2026 Product Modernization

**Status:** Systems/UX modernization delivered on top of Prompt 01 playable core.  
**Stop:** Do **not** start Prompt 02 visual gauntlet in this session.  
**Docs:** `docs/MODERN-2026.md`, `docs/REV1-REVIEW.md`, `BUILD-CHECK-01.5.md`

---

## How to run

```bash
cd Immortal-Shores
npm install
npm run build -w @immortal/shared
npm run dev
```

- UI: http://127.0.0.1:5173  
- API: http://127.0.0.1:8787/health  
- WS: `ws://…/ws?token=…` (proxied in Vite)  
- Long-poll fallback: `GET /api/poll?since=`

---

## What 01.5 added

### Trust trade (critical reverse)
- Tablet Wall **no longer debits** the poster on list (no escrow wallet).  
- Accept performs **atomic vault swap** if both parties still hold goods.  
- Market remains list-then-buy (seller commits listed inventory; taker pays Rations immediately).  
- Ledger uses `trade_accept` for Wall settles (legacy `escrow_*` rows may still exist in old saves).

### Market range
- Visibility filtered by **Market level → province riverIndex range** (`marketProvinceRange` + `provinceInRange`).

### Production QoL (optional)
- Live production overlay (toggle).  
- Balance helper + Apply Suggested Assignment.  
- Ration runout yellow/red banner.  
- Pause non-essential production (assignments preserved; production/drain skipped).

### Platform
- PWA manifest + service worker (shell only; API/ws uncached).  
- Responsive CSS: desktop / tablet / mobile portrait.  
- WebSocket events + long-poll fallback.  
- Email field + optional TOTP setup/enable (lightweight verifier for dev).  
- Dark mode + color-blind class toggles.

### Social & live-ops shell
- Province-default chat channel; markdown/`@mentions`/search; mute.  
- Trading Circles (max 12, private board).  
- Notifications (construction, barge, trade, …) + prefs hooks.  
- Trade history + “N successful trades” reputation; preferred partners.  
- Offer templates.  
- Barge ETA display + cargo slider.  
- Cosmetics purchase/equip (no power).  
- Seasonal provincial harvest stub → temporary blessing.  
- Legacy Ascension list surface.

### Onboarding
- Mandatory interactive tutorial steps (skip available).  
- First Week Goals checklist after tutorial / skip.

---

## Unchanged (must stay)

- GDD production rates, plot counts (5 shop / 4 special / 3 training), unique luxury force-trade, Seal floor 10, one construction at a time, no P2W speed-ups/extra plots.

---

## Tests

```text
npm run test -w @immortal/server   # 6/6
```

Includes trust-trade no-lock-on-post and market range smoke.

---

## Handoff to Prompt 02

Visual gauntlet only: PBR/glTF kit, empty-plot iconography polish, living VFX, dark/color-blind art pass, impartial judge. **Do not reopen escrow or plot counts.**

Write `PROMPT-02-COMPLETE.md` only after judge PASS.
