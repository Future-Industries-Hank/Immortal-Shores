# Immortal Shores — Game Design Document

**Title:** Immortal Shores  
**Genre:** Free-to-play persistent browser multiplayer city- and empire-building  
**Setting:** Eternal river of the ancient world  
**Pace:** Casual real-time — short sessions of a few minutes, several times a day  
**Distribution:** No download; browser only (Chrome + Safari, desktop + mobile)  
**Identity:** Fresh names, art direction, and presentation preserving the complete mechanical framework below.

---

## 1. Pitch

A free-to-play persistent browser-based multiplayer city- and empire-building game set along the eternal river of the ancient world. Players found riverside settlements, allocate Workers to fields and workshops, trade missing luxuries, capture monument grounds for Limestone and empire-wide bonuses, and eventually Ascend to the Eternal Name — retiring their account into permanent map legacy.

**Strategic heart:** Precise Worker allocation so fields feed workshops; aggressive but trustworthy trading for missing luxuries; early monument capture for permanent production/transport bonuses; careful Ration management; long-term Sacred Seal accumulation. Three trade systems, unique-luxury constraint, monument bonuses, and Ascension create a deep, social, casually paced economic and legacy game.

---

## 2. Visual style & presentation

### 2.1 Look

- **Isometric** view of riverside settlements.
- Materials: sun-baked mudbrick and pale stone.
- Palette: warm sandy tones, green fields and reed beds, deep blue river water, soft golden accents on higher-tier structures.
- Workers move about the plots.
- Subtle animations on workshops, river barges, and optional cosmetic flourishes.
- Clean, functional UI: clear resource counters, production timers, tooltips.
- Navigation icons: **Harbor**, **Private Tablets**, **Allies**, **Tablet Wall**.
- **World map:** long curve of the river divided into **Provinces**; player cities, empty founding sites, and monument grounds marked.

### 2.2 Presentation notes for implementation

- Prefer **orthographic isometric** camera (Babylon.js or high-fidelity 2.5D). Not free-roam AAA first-person; density and readability of a classic isometric strategy title with modern polish.
- Show-don’t-tell: idle Workers, barge motion, workshop smoke/animation communicate state without walls of tutorial text.
- Quality tiers adjust draw distance on world map, particle density, shadow quality, and simultaneous animated agents.

### 2.3 Visual references (for judge / STYLE-CONTRACT)

- **Target class:** Polished isometric historical city/empire builders and high-end browser strategy presentation (Anno-like warmth of production chains + classic river/island empire map readability).
- **Anti-reference:** Flat unlit graybox; generic purple sci-fi UI; live 3D open-world city sim (Skylines camera) as the primary fantasy.

---

## 3. Starting a new shore

Every player begins with **one modest settlement**:

| Item | Amount / note |
|---|---|
| Great House | Level 1 |
| Market | Present |
| Emmer Field | Present |
| River Clay Pit | Present |
| Marsh Reed Bed | Present |
| Workers | 18 |
| Rations | 60 |
| Mudbricks | 40 |
| Unique luxury production building | **One**, assigned at random |

**Eight luxury specialties** (balanced in value) — each settlement gets exactly one unique luxury **material** production:

1. Hides  
2. Bronze  
3. Cedarwood  
4. Red Ochre  
5. Eye Paint  
6. Sacred Oil  
7. Green Stones  
8. Royal Gold  

The unique luxury **forces trade from the very beginning**.

---

## 4. Workers

- Grow at **+3 Workers per hour** until current Great House capacity is reached.
- Any Worker assigned to a field or workshop consumes **1 Ration per hour**.
- If Rations run short, **all production in that settlement is reduced**.
- Workers sent to a **monument site** remain there **permanently**; the home settlement immediately resumes growing Workers up to Great House limit.

### 4.1 Great House Worker capacity

| Level | Max Workers | Level | Max Workers |
|---:|---:|---:|---:|
| 1 | 30 | 12 | 470 |
| 2 | 45 | 13 | 540 |
| 3 | 65 | 14 | 615 |
| 4 | 90 | 15 | 695 |
| 5 | 120 | 16 | 780 |
| 6 | 155 | 17 | 870 |
| 7 | 195 | 18 | 965 |
| 8 | 240 | 19 | 1065 |
| 9 | 290 | 20 | 1170 |
| 10 | 345 | 21 | 1280 |
| 11 | 405 | 22 | 1395 |

---

## 5. Production

### 5.1 Basic materials

| Building | Output |
|---|---|
| Emmer Field | **8 Emmer** per Worker per hour |
| River Clay Pit | **5 River Clay** per Worker per hour |
| Marsh Reed Bed | **5 Marsh Reeds** per Worker per hour |

### 5.2 Basic goods

| Building | Recipe / rate |
|---|---|
| Ration House | 2 Emmer → 1 Ration; **6 Rations** per Worker per hour |
| Mudbrick Yard | 2 River Clay + 1 Marsh Reed → Mudbricks; **2** per Worker per hour |
| Vessel Shop | 2 River Clay → 1 Vessel; **1** per Worker per hour |
| Reed Basket Shop | 2 Marsh Reeds → 1 Reed Basket; **1** per Worker per hour |

### 5.3 Luxury materials

One unique per settlement (list in §3).  
**Limestone** is produced **only at monument sites**: **1 per Worker per hour**.

### 5.4 Luxury goods (combinatorial recipes)

| Good | Recipe |
|---|---|
| Fine Sandals | 2 Hides + 4 Marsh Reeds |
| Stone Idols | 2 Bronze + 4 River Clay |
| Eye Cosmetics | 1 Red Ochre + 1 Eye Paint |
| Sacred Perfume | 1 Red Ochre + 1 Sacred Oil |
| Amulets | 1 Royal Gold + 1 Green Stones |

### 5.5 Construction rules

- Building levels raise the maximum Workers assignable to that building.
- **Only one** construction or upgrade may be in progress at a time per settlement.
- Cancelling returns approximately **25%** of committed resources.

---

## 6. Great House progression

Upgrading the Great House:

- Increases Worker capacity (table §4.1)
- Raises settlement rank and player title
- Unlocks **Envoys at level 7**
- Costs scale steadily:
  - **Early:** mainly Mudbricks, Reed Baskets, Vessels + one luxury good
  - **Mid:** introduce Limestone
  - **Late:** large Limestone + multiple luxury goods
- **Sacred Seals** required at levels **7, 10, 13, 16, 19, 22** (one Seal each)

*(Exact numeric upgrade tables for non-capacity costs: implement with a data table that scales steadily; preserve breakpoints for Seals and Envoy unlock.)*

---

## 7. Sacred Seals (premium currency)

- New accounts start with **10 free Seals**.
- Additional Seals may be purchased (real money) — wire as stub/config for F2P economy integrity even if store UI is soft-launched.
- **Player-to-player Seal trade allowed**, but a player may **never trade away their last 10** Seals.
- Uses:
  - Six major Great House thresholds (levels above)
  - Founding additional settlements: **2 / 3 / 4 Seals** for 2nd / 3rd / 4th settlement
  - Unlocking ability to raise monuments
  - Optional cosmetics & convenience: decorative monuments, animated figures, ad removal, longer session timers, expanded tablet history, more ally and market-order slots, inactivity protection

---

## 8. Trade systems (three interlocking)

### 8.1 Market

- Currency: **Rations**.
- Raising Market level extends the **range of Provinces** whose orders a player can see.

### 8.2 Tablet Wall (Trade channel)

- Public **barter board** with rich shorthand culture of offers and requests.
- Part of Tablet Wall channels (see §12).
- Settlement of trades must still go through **authoritative market/mail/barge** flows — free text is culture, structured offers are executable. **No escrow** (2026).

### 8.3 Private River Barges

- Built at the **Harbor**.
- Cost per barge: **25 Cedarwood + 25 Rations + 20 Worker-hours**.
- Capacity: **up to 100 units**.
- Travel time scales with **distance along the river**.
- Once a settlement maintains **11+ barges**, modest risk of **partial loss** or **unexpected treasure**.
- Harbor ship capacity scales with Harbor level: **5** at lowest tier → **several hundred** at highest.

### 8.4 Gifts, mail, trust settlement (architecture layer)

Cross-player transfers use server **vault + mail + atomic market/wall takes** (see ECONOMY.md and MODERN-2026.md). **No escrow** — trust remains. Chat and Tablet Wall advertise; the ledger settles on explicit accept.

---

## 9. Military & monuments

### 9.1 Units (Training Grounds)

Each unit: **4 Worker-hours** to train.

| Unit | Cost | Note |
|---|---|---|
| Bowmen | 3 Cedarwood + 2 Hides | — |
| Spearmen | 3 Bronze + 2 Hides | — |
| Chariot Warriors | 5 Cedarwood + 5 Bronze | Strongest |

- Units consume **1 Ration per hour** or begin to **desert**.
- Moving units costs **2 Rations per hour of travel**.

### 9.2 Monument sites

- Begin under **bandit control**.
- Capture requires defeating a **fixed defending force**.
- Player may hold **maximum two** monuments.
- **Limestone** harvested only here (1 / Worker / hour).
- **Great Pyramid** or **Guardian Sphinx** to level 5: ≈ **20,500 Limestone** and ≈ **86 hours** construction total.
- Each monument level grants to **every settlement the player owns**:
  - **+1% production speed**
  - **+1% transport speed**
  - Increasing **defensive combat bonus**
- Owning **two** monuments prevents further attacks on other players’ monuments.

---

## 10. Shrines & provincial blessings

- Building a **Shrine** lets a settlement contribute to its Province’s sacred offering.
- Each Province honors one patron and requires a specific luxury **good**:
  - Fine Sandals, Amulets, Sacred Perfume, Stone Idols, or Eye Cosmetics
- When the Province threshold is met: every settlement with a Shrine gets **+10% production** for **48 hours**.
- After blessing ends: demand rises temporarily, then slowly declines.

---

## 11. Communication

| Channel | Purpose |
|---|---|
| **Tablet Wall — General** | Persistent public chat |
| **Tablet Wall — Trade** | Public barter / offers |
| **Tablet Wall — Province** | Province-specific |
| **Private Tablets** | Direct messages |
| **Allies list** | Regular trading partners (expandable with Seals) |

UI navigation icons: Harbor, Private Tablets, Allies, Tablet Wall.

---

## 12. Envoys, quests & events

- **Envoys** unlock at Great House **level 7**.
- Dispatch on land or river expeditions consuming luxury goods (or barges + Rations for sea voyages).
- Success yields: Mudbricks, occasional Sacred Seals, useful items, or temporary construction-speed bonuses.
- **Provincial events** appear periodically; reward coordinated military or economic action.

---

## 13. Ranking & the Eternal Name

### 13.1 Prestige sources

- Great House levels
- Monument levels
- Number of settlements
- Successful military actions
- Contributions to Provincial offerings

Higher standing → more impressive **Ancestral Monument** at Ascension.

### 13.2 Ascension (endgame)

1. Fully raise one or more Great Houses to **level 22**
2. Construct desired monuments
3. Choose to raise an **Ancestral Monument** and **retire**
4. Account closed; name **permanently retired** on that world
5. Ancestral Monument of rank-appropriate size remains forever in the **capital Province**
6. Name entered in **Hall of Eternal Names** (recent entries displayed; older monuments stay on map)

---

## 14. Multi-settlement empire

- Up to **four** settlements.
- Founding requires: resources from capital, Sacred Seals (2/3/4 for 2nd/3rd/4th), and real time (typically **half a day or more**).
- Each new settlement receives its **own unique luxury specialty**.

---

## 15. Core loop (session design)

**One session (few minutes):**

1. Collect / review offline production (server-resolved tick since last login).
2. Rebalance Workers (fields exactly feed workshops; Ration surplus/deficit).
3. Check Market / Tablet Wall / barges in transit.
4. Queue one construction/upgrade if ready.
5. Optional: gift, trade, military move, shrine contribution, envoy.

**Core verb:** **Allocate Workers** (and the trades that make allocation possible).

**Why play twice:** World ticks while away; barges arrive; province blessing windows; rivals take monuments; Seal thresholds unlock empire steps.

---

## 16. Uniqueness answers (for ai_manifest)

1. **Differentiator:** Unique per-settlement luxury forces a social trade economy from minute one, along an eternal-river province map with postcard-readable cities, barge logistics, and a permanent Ascension legacy on the world map.
2. **Rejected clone:** Not a live shared 3D co-op city sandbox; not a pure idle clicker without negotiation; not a real-time action combat MMO.
3. **Why play twice:** Persistent hourly production, barge ETAs, province blessing cycles, monument arms races, and the long climb toward Eternal Name retirement.

---

## 17. Implementation fidelity note

This document is the complete mechanical framework — every system, confirmed numerical progression, and strategic relationship must be preserved exactly under Immortal Shores names and art direction. Where upgrade cost curves are described qualitatively (early/mid/late Great House), implement as data-driven tables that match the spirit and Seal breakpoints; do not invent systems outside this GDD.
