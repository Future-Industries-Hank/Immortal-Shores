# ECONOMY — Immortal Shores

Server is sole source of truth for vault balances, Seals, mail, market orders, barge cargo, and combat outcomes. Client may predict UI; server reconciles on tick and on every transfer.

## 1. Time model

- **Real-time casual:** production, growth, travel, construction progress in **real hours**.
- On login / poll: server applies `elapsed` since `last_tick` (capped reasonably to prevent abuse).
- Target tick resolution: 1 minute server-side or event-based lazy evaluation (either is fine if math matches hourly rates).

## 2. Worker economics

- Growth: **+3 Workers / hour** until Great House max (see GDD table).
- Assigned Worker: **−1 Ration / hour**.
- Ration shortage: apply a global production multiplier for that settlement (e.g. scale with deficit severity; never soft-lock into NaN). Document exact formula in code config.
- Monument Workers: removed from home pool permanently; home regrows.

## 3. Production rates

Implement GDD rates exactly (Emmer 8, Clay 5, Reeds 5, Rations 6 from 2 Emmer, etc.).  
Workshops consume inputs; if inputs insufficient mid-tick, produce floor(available).

## 4. Cross-player value

### 4.1 Vault

Per-player (and optionally per-settlement staging) balances for all tradeable resources and Seals.

### 4.2 Market

- Currency: **Rations**.
- Orders visible by Market level → province range.
- Accept order → atomic debit/credit + ledger.

### 4.3 Tablet Wall barter

- Structured offers (give[] / want[] / quantity / expiry).
- Displayed as cards in Trade channel; free-text shorthand allowed as flavor only.
- Accept → **escrow or pay-on-receive** path.

### 4.4 Gifts (Private Tablets / mail)

- Debit sender on send (cannot gift below zero).
- Recipient Accept credits vault (or auto-credit — prefer Accept for Seals).
- **Seals:** cannot reduce balance below **10**.

### 4.5 Escrow / pay-on-receive

| State | Meaning |
|---|---|
| `draft` | Not locked |
| `posted` | Visible; may soft-hold offer side |
| `locked` | Both sides reserved |
| `completed` | Atomic swap done |
| `rejected` / `expired` / `cancelled` | Holds released |

Idempotent accept keys required.

### 4.6 River barges

- Build cost: 25 Cedarwood + 25 Rations + 20 Worker-hours.
- Cargo ≤ 100 units; travel time = f(river distance).
- On arrival: server delivers to destination vault/mail.
- Fleet size ≥ 11: roll modest loss or treasure events (data-driven weights).
- Harbor level caps concurrent ships (5 → hundreds).

## 5. Sacred Seals

- Start: 10.
- Purchase: store stub + admin grant for testing.
- Spend: GH thresholds 7/10/13/16/19/22; founding 2/3/4; monument raise unlock; cosmetics/slots.
- Trade: P2P allowed with **floor of 10** retained.

## 6. Military upkeep

- Unit: −1 Ration/hour or desertion progress.
- Travel: −2 Rations per hour of travel (charged along path).

## 7. Monuments & limestone

- Capture bandit site → hold (max 2).
- Limestone: 1 / Worker / hour at site.
- Level bonuses: +1% production & transport per level to **all** owned settlements; defensive bonus table data-driven.
- Two monuments: flag `cannot_attack_others_monuments`.

## 8. Provincial blessings

- Shrine contributes required luxury **good** for province patron.
- Threshold met → 10% production, 48h, all shrined settlements in province.
- Post-blessing demand spike then decay.

## 9. Prestige & Ascension

- Prestige formula: weighted sum (GH levels, monuments, settlements, military success, offering contribution).
- Ascension: GH22 path + monuments → Ancestral Monument → account retired, name locked, map marker permanent, Hall entry.

## 10. Ledger

Every vault mutation: double-entry row `{id, ts, player_id, resource, delta, reason, ref_type, ref_id}`.  
Reasons include: `tick_production`, `upkeep`, `market`, `escrow_lock`, `escrow_settle`, `gift`, `barge_depart`, `barge_arrive`, `barge_loss`, `seal_purchase`, `construction`, `military`, `envoy`, `admin`.
