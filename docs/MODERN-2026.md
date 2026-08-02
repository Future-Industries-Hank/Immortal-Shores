# Immortal Shores — Complete 2026 Implementation Guide

**Status:** Canonical product refinement (post–Prompt 01).  
**Rule:** Every original mechanical rule (limited plots, unique luxury, real-time production, forced trading, Great House progression, monuments, Ascension) remains unchanged. Only presentation, usability, social tools, and technical foundation are updated.

Full original numbers live in `docs/GDD.md`. This file is the **2026 layer**.

---

## 1. Technical foundation

### Platform

- Pure web (HTML5/CSS3/TypeScript). No client download.  
- **PWA** — installable on mobile and desktop home screens.  
- Fully responsive, three breakpoints:  
  - **Desktop** — isometric view dominant  
  - **Tablet** — slightly simplified controls  
  - **Mobile** — portrait-first, collapsible panels, larger tap targets  

### Performance & reliability

- **WebSockets** for production ticks, barge arrivals, trade completions, chat.  
- **Long-polling fallback** for older browsers.  
- Server authoritative for all economy and timing.  
- Account: **email + optional TOTP 2FA**.  
- Automatic session recovery and continue-where-you-left-off on any device.

### Visual presentation (executed mainly in Prompt 02)

- Isometric camera with smooth zoom and pan.  
- Clean, high-contrast art that still reads as ancient river civilization.  
- Optional **dark mode** and **color-blind friendly** palette.  
- Empty plots clearly **color-coded or icon-marked** by type (Shop / Special / Training) so limited slots are instantly readable.

---

## 2. Core settlement layout (unchanged rules + modern presentation)

### Plot counts (fixed)

| Kind | Count | Notes |
|---|---:|---|
| Pre-placed | Great House, Market, Emmer Field, River Clay Pit, Marsh Reed Bed | Starter |
| Flexible **Shop** plots | **5** | Ration House, Mudbrick Yard, Vessel Shop, Reed Basket Shop, luxury goods workshop, etc. |
| **Special** plots | **4** | Storehouse, Shrine, Harbor, unique luxury works |
| **Training Grounds** plots | **3** | One unit type orientation per pad |

Only one construction/upgrade active per settlement. Cancel ≈ **25%** resources.

### Spatial composition (presentation)

- River always on the **left**.  
- Fields clustered nearest the water.  
- Great House + Market in visual center.  
- 5 Shop plots in a clear horizontal or L-shaped group right of Great House.  
- 4 Special further inland; Harbor has visible path/pier toward river.  
- 3 Training Grounds on the outer edge.  
- Generous empty ground between groups — never cramped.  
- Hover / long-press empty plot → exact categories of buildings allowed.

*(Rev 1 already encodes sparse pads in `packages/shared/src/grid.ts` — refine labels, icons, and spatial polish.)*

---

## 3. Production & Worker management (QoL layer)

All original rates and consumption **identical** to GDD.

**Optional modern tools (never mandatory):**

- **Live production overlay** — Workers assigned, output/hour, Ration consumption per building.  
- **Balance helper** — exact Worker distribution for Emmer→Rations and Clay/Reeds→Mudbricks equilibrium; **Apply Suggested Assignment** or ignore.  
- **Warnings** — soft yellow/red when Rations will run out within X hours.  
- **One-click “Pause all non-essential production”** for long offline periods.

These remove frustration without removing the need to understand the economy.

---

## 4. Trade system (modernized, still trust-based)

### Three original channels (unchanged)

1. **Market** — Rations currency; range expands with Market level.  
2. **Tablet Wall** — public offers with shorthand support.  
3. **Private River Barges** — original costs, capacity 100, travel times.

### 2026 improvements

- Saved **offer templates**.  
- Clear **travel-time** and ETA on barges.  
- **Trade history** per player (success count, average response time).  
- Simple **reputation flag**: “X successful trades with this player” — no complex gameable score.  
- **Preferred partners** float to top of lists.  
- Mobile-friendly barge loading: sliders + fill-to-capacity.

### Trust model (critical)

> **There is still no escrow.** The trust requirement is never removed. Tools only make honest trading smoother and safer.

Structured offers still settle only via **explicit player accept actions** on the server (atomic swap of committed stacks when both sides confirm / when accepter takes a posted offer they can fulfill). Do **not** reintroduce long-hold escrow wallets that remove counterparty risk.  
Gifts may still be send-on-debit or accept-on-receive **for convenience**, but player-to-player **barter is trust/social**, not bank-escrow PvP protection.

**Rev 1 note:** Prompt 01 implemented escrow-style ledger reasons. **Prompt 01.5 must remove escrow framing and UX**, keep atomic accept where the accepter pays immediately from their vault (standard market take), and document trust for free-form barges/private deals.

---

## 5. Social layer

### Tablet Wall

- Channels: **General**, **Trade**, **Province** (preserved).  
- Modern chat: emoji, basic markdown, @mentions, search, mute.  
- **Province channel is default** when viewing your settlement.

### Trading Circles (optional)

- Player-created groups, **max 12**.  
- Private board for members only.  
- **No** shared storage or combat power — communication/coordination only.

### Notifications

Browser push + optional email for:

- Construction/upgrade finished  
- Barge arrived  
- Trade completed or cancelled  
- Province blessing started/ended  
- Envoy returned  

Per-event fine-tune.

---

## 6. Onboarding (critical for 2026 retention)

Mandatory short interactive tutorial:

1. Place Mudbrick Yard and Ration House.  
2. Assign Workers; see Rations flow.  
3. “Your settlement can only produce one unique luxury. You will need others.”  
4. Post a simple Tablet Wall offer **or** accept a guided first trade.  
5. Show first Great House upgrade requirements (why multi-luxury matters).

Then: dismissible **First Week Goals** checklist.

---

## 7. Cosmetics & light live service (F2P-friendly)

### Cosmetics only (purchase or earn)

- Alternative Great House, shop, barge appearances  
- Banners and flags  
- Seasonal ground decorations and river effects  

### Seasonal Provincial Events

- Temporary community goals (e.g. collectively produce 50,000 Rations this week).  
- Reward: short-duration province-wide production blessing.  
- **Never** permanent power, never required for progression.

### Forbidden monetization

- No speed-ups  
- No extra plots  
- No extra unique luxuries  
- No pay-to-win of any kind  

Sacred Seals remain as designed in GDD (progression thresholds, founding, cosmetics/QoL slots) — not combat power purchases.

---

## 8. Progression, monuments & Ascension

All original numbers, costs, bonuses, Ascension process **exact** as GDD.

Modern additions only:

- Clearer visual feedback on active monument bonuses.  
- Personal **Legacy** page: past Ascensions (retired characters), ranking toward next Ancestral Monument tier.

---

## 9. Implementation priorities (mapped to agent prompts)

| Guide phase | Agent prompt | Focus |
|---|---|---|
| Phase 1 MVP modern | **Prompt 01** (done at `9f0479d`) + residual in **01.5** | Limited plots, original economy, basic Market/Wall/barges, responsive+PWA, core notifications |
| Phase 2 | **Prompt 01.5** | Production helpers, trade UX/reputation, onboarding, province chat polish, trust trade, WS/accounts |
| Phase 3 | **Prompt 01.5** tail / soft live-ops | Trading Circles, cosmetics system, seasonal events, mobile gestures |
| Visual excellence | **Prompt 02** | Art, lighting, atmosphere, judge PASS |

---

## Soul (do not lose)

Slow, thoughtful, trade-dependent, limited-space city building with a long-term legacy goal — familiar to the original, comfortable and readable for 2026 discovery.
