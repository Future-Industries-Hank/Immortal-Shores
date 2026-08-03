# UI-SURFACE-LIST — FULL VISUAL OVERHAUL

**Date:** 2026-08-03 · from 5-agent audit · maintain checkboxes as surfaces are skinned

| Done | Surface | Severity | Fix (audit) |
|---|---|---|---|
| [x] | Global typography & design tokens | major | Self-host two faces (e.g. a chiselled serif like 'Cormorant'/'Marcellus' for H1-H3 and numerals-tabular sans for data), add tokens --radius-sm/md/lg,  |
| [x] | Login / Found-settlement panel | major | Full-bleed painted/gradient river backdrop (canvas already exists — render the idle scene behind auth), logotype in the display serif with a gold rule |
| [x] | HUD resource strip | major | Per-resource inline SVG glyph (16px, single gold-line style) + tabular-nums value; tooltip already has full label — add a +x.x/h trend from s.producti |
| [x] | Seals / province chip | major | Gold or papyrus text with a small carved-seal SVG (crimson wax circle with impression), province name in muted papyrus; merge the duplicate rule; make |
| [x] | Quality / Time-of-day selects | minor | Move both into a Settings popup (gear icon button); replace tod with a compact icon cycle-button (sun/dusk/moon glyphs) if it stays; give postcard an  |
| [x] | Bottom nav (Shore/Harbor/Tablets/Allies/Wall/Build/Military) | major | Icon-above-label buttons (etched gold-line SVGs: shore hut, barge, tablet, handshake, wall, trowel, spear), active = gold underline notch + brightened |
| [x] | Menu popup shell | minor | Header gets the display serif, a small panel glyph, and a hairline double-rule; add subtle papyrus texture to the body; consider docking left as a col |
| [x] | Shore (settlement) panel content | critical | Building rows become cards: icon, name in serif, level pip row, worker stepper as one segmented control, single overflow menu for upgrade; move Dark/C |
| [x] | Tablet Wall — chat | critical | Grow box to fill panel height; message = avatar-seal initial, name in channel-tinted small-caps, timestamp; own messages tinted papyrus-deep; mention  |
| [x] | Tablet Wall — trust offers & market forms | critical | Offer cards: give-side icons → arrow glyph → want-side icons, poster name + reputation stars, Accept as gold primary; composer becomes a two-column gi |
| [x] | Tablets panel (gifts + mail inbox) | critical | Style mail as sealed-tablet cards (papyrus texture, wax-seal Accept button that 'breaks' on claim, sender + relative time); gift composer gets a partn |
| [x] | Allies panel | critical | Split into sub-tabs (Partners / Circles / Events / Legacy); partner rows get seal-avatar, trade count as gold pips, Prefer becomes a toggleable star;  |
| [x] | Military & Monuments panel | major | Unit cards with glyph (bow/spear/chariot), count, upkeep/h and train button showing cost inline; monuments as banner cards using site display names; s |
| [x] | World Map panel + site list | major | Make the SVG the interface: plot sites as clickable markers on the river with hover cards, pan on wide layout; list becomes a filterable legend; use t |
| [x] | Inspect popup (building / construction / pad / generic) | major | Header band with building glyph + serif title + level pips; convert sections to tabs (Overview / Levels / Actions) so first paint fits without scroll; |
| [x] | Tutorial panel | major | Anchor steps to targets (dim viewport, spotlight the Shop pad / nav tab in question), progress as 5 seal-dots, advisor voice with small scribe glyph;  |
| [x] | First Week Goals panel | major | Collapse to a slim quest tracker: header 'First Week' with 4/6 progress ring, rows with gold check-seal animation on completion, collapsible chevron i |
| [x] | Toast / hint / ration warning layer | major | Toast stack top-right with icon + tint per type, 250ms slide-fade, queue max 3; ration-critical gets a warning glyph and slow pulse animation plus a c |
| [x] | Dark mode & color-blind themes | critical | Route every surface background through tokens (--surface-card, --surface-field) and audit each component under html.dark; move all inline colors (form |
| [x] | Mobile / narrow layout | major | Add `padding-bottom: env(safe-area-inset-bottom)` to #hub and inset-top to #hud-top; replace hidden scroll with wrap-into-More (nav) and grouped popov |
| [x] | Production overlay | major | Retitle 'Production', use BUILDING_TITLE for names, small-caps styled header row, color the drain column red-tint and paused rows amber; move toggle i |
| [x] | Harbor panel & barge rows | major | Name barges procedurally ('Reed Dancer'), style the cargo slider (gold track, amount readout), ETA as 'arrives in 26m', destination picker from map si |
| [x] | River board (the map itself) | critical | Replace with an authored board: (a) a painted background raster (papyrus/parchment texture, 2x, embedded or asset-loaded) or a richly authored SVG wit |
| [x] | Province markers on the SVG | critical | Place provinces at authored coordinates ON the river (or derive t-values along the path via getPointAtLength) so each sits on a bank. Replace bare cir |
| [x] | Site list ('map-grid') and marker icon set | major | Ship a small inline-SVG icon set (16-20px, single stroke style, 4 glyphs: city ziggurat, monument obelisk, founding stake/flag, generic cartouche) ren |
| [x] | Legend ('Pads' line) | major | Delete this line or replace it with a real legend for the map's own marker kinds, using the exact same SVG roundel icons as the site list/board marker |
| [x] | Hover / selection / feedback model | major | Add a .selected class on the active site card (gold outline + slight lift) kept while its popup is open, cleared in onClose; mirror it on the correspo |
| [x] | Panel copy / framing | minor | Rewrite in-world: 'Six provinces line the Eternal River; newcomers are settled where their luxury is scarcest, so every shore has something to trade.' |

**2026-08-03 skin pass caveats:** toast remains a single element (text set by main.ts — typed queue needs main.ts, other workstream); tutorial has seal-dot progress + scribe voice but no viewport spotlight anchoring; harbor launch destination still own-shore only (API-behavior change out of scope); map sites are filterable legend cards linked to province markers, not yet plotted as individual board markers.
