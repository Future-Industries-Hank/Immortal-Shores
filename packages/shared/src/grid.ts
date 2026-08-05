/**
 * Fixed settlement plot layout (Nile Online–style).
 * Not a free city grid — a sparse set of typed pads.
 *
 * River is on the LEFT (negative world X / screen-left in iso view).
 */
import type { BuildingKind, LuxuryMaterial, ResourceId, UnitKind } from "./types.js";

export type PlotCategory = "starter" | "special" | "shop" | "training";

export interface SettlementPlotDef {
  id: string;
  category: PlotCategory;
  /** Short label on empty pad */
  label: string;
  /** World position (river at −X / left) */
  worldX: number;
  worldZ: number;
  /** Ground tint for empty pad */
  tint: string;
  /** If set, this pad starts with a building */
  starterKind?: BuildingKind;
  /** Allowed kinds when empty */
  allowed: BuildingKind[];
  /** Training pads: unit this barracks will train */
  trainingUnit?: UnitKind;
}

/**
 * Sparse riverside layout.
 *
 * COMPOSITION (the camera is fixed and rotated ~-51deg, so world axes are not
 * screen axes — screen-right is world +x+z, screen-down is world +x-z):
 * Great House and Market sit either side of frame centre with a 5.6-unit civic
 * avenue between them, and the eight buildable pads form ONE ring around that
 * core — SW/S shops fill the frame's lower-left quadrant, E/NE/N specials close
 * the top. Ring radii deliberately vary 4.9-7.6 and no three pads land within
 * 10 px of a shared screen row or column, so it reads as planned without
 * ruling a hard line.
 *
 * Left = river / resources · Centre = GH + Market · Ring = shops + specials ·
 * Outer east = training.
 *
 * Constraints baked into these numbers: >= 2.9 units centre-to-centre (empty
 * pads berm out to half-width 1.175 + 0.20), everything inside the flat rect
 * (measured: a 2.9-wide footprint is dead flat only to x <= 8.2, and the
 * training pads at x 8.4-8.8 sit on a 0.13-0.20 rise — still flatter than
 * the shipped x=9.5 pads, which spanned 0.37-0.62), resources on the
 * bank at x ~ -8.5, harbor on the waterline.
 */
export const SETTLEMENT_PLOTS: SettlementPlotDef[] = [
  // —— Resource cluster (closest to river, left) ——
  {
    id: "res-emmer",
    category: "starter",
    label: "Emmer Field",
    worldX: -8.6,
    worldZ: -2.9,
    tint: "#7FA85A",
    starterKind: "emmer_field",
    allowed: [],
  },
  {
    id: "res-reeds",
    category: "starter",
    label: "Marsh Reed Bed",
    worldX: -8.4,
    worldZ: 0.8,
    tint: "#5F8F4E",
    starterKind: "marsh_reed_bed",
    allowed: [],
  },
  {
    id: "res-clay",
    category: "starter",
    label: "River Clay Pit",
    worldX: -8.7,
    worldZ: 4.4,
    tint: "#C9956C",
    starterKind: "river_clay_pit",
    allowed: [],
  },

  // —— Civic core: GH west of frame centre, Market east, 5.57 units apart ——
  {
    id: "civic-gh",
    category: "starter",
    label: "Great House",
    worldX: -3.0,
    worldZ: 3.6,
    tint: "#E5E0D4",
    starterKind: "great_house",
    allowed: [],
  },
  {
    id: "civic-market",
    category: "starter",
    label: "Market",
    worldX: 2.2,
    worldZ: 1.6,
    tint: "#D4A84B",
    starterKind: "market",
    allowed: [],
  },

  // —— 5 Flexible shop plots: the south half of the ring, W-SW round to E.
  // Ids are NOT in ring order — the road chain edges are 1-3, 3-5, 5-2, 2-4,
  // so the ids are assigned to make that chain trace the arc. ——
  {
    id: "shop-1",
    category: "shop",
    label: "Shop plot",
    worldX: -5.5,
    worldZ: -1.0,
    tint: "#E8D4B0",
    allowed: [
      "ration_house",
      "mudbrick_yard",
      "vessel_shop",
      "reed_basket_shop",
      "luxury_workshop",
    ],
  },
  {
    id: "shop-2",
    category: "shop",
    label: "Shop plot",
    worldX: 4.6,
    worldZ: -2.2,
    tint: "#E8D4B0",
    allowed: [
      "ration_house",
      "mudbrick_yard",
      "vessel_shop",
      "reed_basket_shop",
      "luxury_workshop",
    ],
  },
  {
    id: "shop-3",
    category: "shop",
    label: "Shop plot",
    worldX: -3.4,
    worldZ: -4.3,
    tint: "#E8D4B0",
    allowed: [
      "ration_house",
      "mudbrick_yard",
      "vessel_shop",
      "reed_basket_shop",
      "luxury_workshop",
    ],
  },
  {
    id: "shop-4",
    category: "shop",
    label: "Shop plot",
    worldX: 6.0,
    worldZ: 2.4,
    tint: "#E8D4B0",
    allowed: [
      "ration_house",
      "mudbrick_yard",
      "vessel_shop",
      "reed_basket_shop",
      "luxury_workshop",
    ],
  },
  {
    id: "shop-5",
    category: "shop",
    label: "Shop plot",
    worldX: 0.8,
    worldZ: -4.9,
    tint: "#E8D4B0",
    allowed: [
      "ration_house",
      "mudbrick_yard",
      "vessel_shop",
      "reed_basket_shop",
      "luxury_workshop",
    ],
  },

  // —— Harbor ON the river (left bank / pier into water) ——
  // River mesh sits ~x=-13.2, bank ~x=-10.2; pier pad straddles waterline.
  {
    id: "special-harbor",
    category: "special",
    label: "Harbor pier",
    worldX: -11.4,
    worldZ: 6.5,
    tint: "#3A7CA5",
    allowed: ["harbor"],
  },

  // —— Remaining specials: the north half of the ring, NW round to NE ——
  {
    id: "special-luxury",
    category: "special",
    label: "Luxury works site",
    worldX: -3.4,
    worldZ: 6.9,
    tint: "#8B3A4A",
    allowed: ["luxury_material"],
  },
  {
    id: "special-warehouse",
    category: "special",
    label: "Warehouse site",
    worldX: 0.7,
    worldZ: 7.4,
    tint: "#C4A574",
    allowed: ["warehouse"],
  },
  {
    id: "special-shrine",
    category: "special",
    label: "Shrine site",
    worldX: 4.8,
    worldZ: 6.0,
    tint: "#E5E0D4",
    allowed: ["shrine"],
  },

  // —— 3 Training grounds (outer east edge, outside the ring) ——
  {
    id: "train-bow",
    category: "training",
    label: "Bowmen grounds",
    worldX: 8.6,
    worldZ: -3.4,
    tint: "#A89070",
    allowed: ["training_grounds"],
    trainingUnit: "bowmen",
  },
  {
    id: "train-spear",
    category: "training",
    label: "Spearmen grounds",
    worldX: 8.8,
    worldZ: 0.2,
    tint: "#A89070",
    allowed: ["training_grounds"],
    trainingUnit: "spearmen",
  },
  {
    id: "train-chariot",
    category: "training",
    label: "Chariot grounds",
    worldX: 8.4,
    worldZ: 4.6,
    tint: "#A89070",
    allowed: ["training_grounds"],
    trainingUnit: "chariot_warriors",
  },
];

export function getPlot(plotId: string): SettlementPlotDef | undefined {
  return SETTLEMENT_PLOTS.find((p) => p.id === plotId);
}

export function plotWorld(plotId: string): { x: number; z: number } {
  const p = getPlot(plotId);
  if (!p) return { x: 0, z: 0 };
  return { x: p.worldX, z: p.worldZ };
}

/** Cost to found a brand-new building on an empty typed pad (L1). */
export const NEW_BUILD_COST: Partial<
  Record<BuildingKind, { resource: ResourceId; amount: number }[]>
> = {
  // Early shop priority — mudbrick yard is intentionally cheap
  mudbrick_yard: [{ resource: "mudbricks", amount: 5 }],
  ration_house: [
    { resource: "mudbricks", amount: 20 },
    { resource: "reed_baskets", amount: 5 },
  ],
  vessel_shop: [{ resource: "mudbricks", amount: 18 }],
  reed_basket_shop: [{ resource: "mudbricks", amount: 18 }],
  luxury_workshop: [
    { resource: "mudbricks", amount: 30 },
    { resource: "vessels", amount: 5 },
  ],
  luxury_material: [
    { resource: "mudbricks", amount: 25 },
    { resource: "reed_baskets", amount: 4 },
  ],
  harbor: [
    { resource: "mudbricks", amount: 40 },
    { resource: "cedarwood", amount: 10 },
  ],
  warehouse: [
    { resource: "mudbricks", amount: 30 },
    { resource: "reed_baskets", amount: 8 },
  ],
  shrine: [
    { resource: "mudbricks", amount: 25 },
    { resource: "stone_idols", amount: 1 },
  ],
  training_grounds: [
    { resource: "mudbricks", amount: 35 },
    { resource: "hides", amount: 5 },
  ],
};

export type StarterBuildingSpec = {
  id: string;
  kind: BuildingKind;
  plotId: string;
  plotX: number;
  plotY: number;
  level: number;
  workers: number;
  luxury?: LuxuryMaterial;
  trainingUnit?: UnitKind;
};

/** GDD starter only — 5 buildings. Luxury / shops / harbor / training are empty pads. */
export function makeStarterBuildings(idFn: () => string): StarterBuildingSpec[] {
  return SETTLEMENT_PLOTS.filter((p) => p.starterKind).map((p, i) => ({
    id: idFn(),
    kind: p.starterKind!,
    plotId: p.id,
    // denormalized index for legacy fields
    plotX: i,
    plotY: 0,
    level: 1,
    workers: 0,
  }));
}

export function allowedKindsForPlot(
  plotId: string,
  existingKinds: BuildingKind[]
): BuildingKind[] {
  const plot = getPlot(plotId);
  if (!plot) return [];
  const taken = new Set(existingKinds);
  return plot.allowed.filter((k) => {
    // One of each kind settlement-wide (multiple training_grounds allowed — different units)
    if (k === "training_grounds") return true;
    return !taken.has(k);
  });
}

// —— Back-compat aliases used by older client code ——
export const BUILDABLE_ON_PAD: BuildingKind[] = [
  "ration_house",
  "mudbrick_yard",
  "vessel_shop",
  "reed_basket_shop",
  "luxury_workshop",
  "luxury_material",
  "harbor",
  "warehouse",
  "shrine",
  "training_grounds",
];

// ─── Roads / dirt paths ─────────────────────────────────────────────
// Workers walk only on these segments. Pads connect via short spurs.

export type RoadTier = "dirt" | "packed" | "stone";

/**
 * Great House level → road surface quality.
 * LEGACY 3-value ladder with its original 4/10 thresholds — scene.ts still
 * reads it, so it is left byte-identical. The 5-tier ladder below bands at
 * 5/10/15/20; the only disagreement is GH level 4 (legacy "packed", tier
 * "humble"/dirt). Prefer settlementPresentationForGhLevel() in new code.
 */
export function roadTierForGhLevel(ghLevel: number): RoadTier {
  if (ghLevel >= 10) return "stone";
  if (ghLevel >= 4) return "packed";
  return "dirt";
}

export const ROAD_COLORS: Record<RoadTier, { fill: string; edge: string }> = {
  dirt: { fill: "#A8926E", edge: "#937C5A" },
  packed: { fill: "#B29C74", edge: "#9A8360" },
  stone: { fill: "#C8C0B0", edge: "#9A9284" },
};

// ─── Settlement tier (visual progression) ───────────────────────────
// The whole settlement levels with the Great House, not just the roads:
// surfaces, planting and prop dressing all step together. PURE DATA — these
// tables describe presentation only, no gameplay reads them and nothing in
// apps/server may. RoadTier / ROAD_COLORS above stay exactly as they were so
// existing importers are untouched.

export type SettlementTier =
  | "humble"
  | "settled"
  | "prosperous"
  | "grand"
  | "imperial";

/** Ring order, cheapest first — index doubles as the numeric prop tier - 1. */
export const SETTLEMENT_TIERS: readonly SettlementTier[] = [
  "humble",
  "settled",
  "prosperous",
  "grand",
  "imperial",
] as const;

/** Planting the renderer may scatter. Each tier unlocks the next step. */
export type GreenerySpecies =
  | "desert_scrub"
  | "reed_tuft"
  | "date_palm"
  | "fig_shrub"
  | "sycamore"
  | "flower_bed"
  | "lotus_basin";

export interface SettlementTierPresentation {
  tier: SettlementTier;
  /** Player-facing name */
  label: string;
  /** Inclusive Great House level band (22 = MAX_BUILDING_LEVEL.great_house) */
  ghLevels: [number, number];
  /** 0-based rung, also the prop dressing tier - 1 */
  index: number;
  road: {
    /** Road surface description — drives which material the renderer picks */
    surface: string;
    fill: string;
    edge: string;
    /**
     * Kerb / border band width in world units either side of the road.
     * 0 = no kerb, the dirt track just fades into sand.
     */
    edgeWidth: number;
    /** 0..1 — how crisply the road edge is cut (dirt wanders, stone is ruled) */
    edgeSharpness: number;
  };
  /** 0..1 fraction of ground near roads and pads that carries turf */
  grassAmount: number;
  /** 0..1 multiplier on scattered greenery instance count */
  greeneryDensity: number;
  /** Cumulative — everything this tier may plant */
  greenerySpecies: readonly GreenerySpecies[];
  /** 1..5 dressing tier for props (benches, lamps, banners, planters) */
  propTier: number;
  /** Legacy 3-value road tier, for renderers still on ROAD_COLORS */
  roadTier: RoadTier;
}

export const SETTLEMENT_TIER_PRESENTATION: Record<
  SettlementTier,
  SettlementTierPresentation
> = {
  humble: {
    tier: "humble",
    label: "Humble",
    ghLevels: [1, 4],
    index: 0,
    road: {
      surface: "packed dirt and drifted sand",
      fill: "#A8926E",
      edge: "#937C5A",
      edgeWidth: 0,
      edgeSharpness: 0.15,
    },
    grassAmount: 0.02,
    greeneryDensity: 0.15,
    greenerySpecies: ["desert_scrub"],
    propTier: 1,
    roadTier: "dirt",
  },
  settled: {
    tier: "settled",
    label: "Settled",
    ghLevels: [5, 9],
    index: 1,
    road: {
      surface: "hard-packed earth with light stone edging",
      fill: "#B29C74",
      edge: "#9A8360",
      edgeWidth: 0.06,
      edgeSharpness: 0.35,
    },
    grassAmount: 0.08,
    greeneryDensity: 0.32,
    greenerySpecies: ["desert_scrub", "reed_tuft"],
    propTier: 2,
    roadTier: "packed",
  },
  prosperous: {
    tier: "prosperous",
    label: "Prosperous",
    ghLevels: [10, 14],
    index: 2,
    road: {
      surface: "rough-cut stone paving",
      fill: "#C2B7A2",
      edge: "#9E937F",
      edgeWidth: 0.1,
      edgeSharpness: 0.6,
    },
    grassAmount: 0.16,
    greeneryDensity: 0.5,
    greenerySpecies: ["desert_scrub", "reed_tuft", "date_palm", "fig_shrub"],
    propTier: 3,
    roadTier: "stone",
  },
  grand: {
    tier: "grand",
    label: "Grand",
    ghLevels: [15, 19],
    index: 3,
    road: {
      surface: "smooth fitted stone and brick",
      fill: "#CFC6B4",
      edge: "#A79C88",
      edgeWidth: 0.13,
      edgeSharpness: 0.8,
    },
    grassAmount: 0.26,
    greeneryDensity: 0.7,
    greenerySpecies: [
      "desert_scrub",
      "reed_tuft",
      "date_palm",
      "fig_shrub",
      "sycamore",
      "flower_bed",
    ],
    propTier: 4,
    roadTier: "stone",
  },
  imperial: {
    tier: "imperial",
    label: "Imperial",
    ghLevels: [20, 22],
    index: 4,
    road: {
      surface: "polished stone with subtle inlaid borders",
      fill: "#DCD4C4",
      edge: "#B0A48C",
      edgeWidth: 0.16,
      edgeSharpness: 0.95,
    },
    grassAmount: 0.36,
    greeneryDensity: 0.88,
    greenerySpecies: [
      "desert_scrub",
      "reed_tuft",
      "date_palm",
      "fig_shrub",
      "sycamore",
      "flower_bed",
      "lotus_basin",
    ],
    propTier: 5,
    roadTier: "stone",
  },
};

/** Great House level → settlement tier (1-4 / 5-9 / 10-14 / 15-19 / 20-22). */
export function settlementTierForGhLevel(ghLevel: number): SettlementTier {
  if (ghLevel >= 20) return "imperial";
  if (ghLevel >= 15) return "grand";
  if (ghLevel >= 10) return "prosperous";
  if (ghLevel >= 5) return "settled";
  return "humble";
}

/** Great House level → the whole presentation row. */
export function settlementPresentationForGhLevel(
  ghLevel: number
): SettlementTierPresentation {
  return SETTLEMENT_TIER_PRESENTATION[settlementTierForGhLevel(ghLevel)];
}

/**
 * 0..1 progress THROUGH the current tier, so a renderer can cross-fade
 * (grass, greenery density) instead of popping on every fifth level.
 */
export function settlementTierProgress(ghLevel: number): number {
  const [lo, hi] = SETTLEMENT_TIER_PRESENTATION[
    settlementTierForGhLevel(ghLevel)
  ].ghLevels;
  if (hi <= lo) return 1;
  const t = (ghLevel - lo) / (hi - lo);
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export interface PathNode {
  id: string;
  x: number;
  z: number;
  /** If set, this node sits at a plot entrance */
  plotId?: string;
}

/**
 * Graph nodes: hubs + plot entrances.
 * Layout follows the sparse pads: the four hubs sit in the open ground the ring
 * encloses, every entrance is pulled ~1.25 units off its pad centre toward its
 * hub, and every segment clears an EMPTY pad's berm (half-width 1.175 + 0.20)
 * by at least 1.55 units. Starter pads draw no berm, so a road may run close to
 * a building — but not through one, hence hub-res→hub-civic passing 2.05 south
 * of the Great House rather than straight at it.
 */
export const PATH_NODES: PathNode[] = [
  // Main spine (west → east), routed south of the Great House
  { id: "hub-res", x: -6.3, z: 1.2 },
  { id: "hub-civic", x: -0.4, z: 1.8 },
  { id: "hub-shop", x: 1.0, z: -1.6 },
  { id: "hub-train", x: 7.0, z: 0.2 },
  // North specials spine — sits on the civic avenue between GH and Market
  { id: "hub-special", x: 0.4, z: 4.8 },
  // Harbor path hub on the bank
  { id: "hub-pier", x: -9.3, z: 6.1 },
  // Plot entrances (slightly offset toward path network)
  { id: "p-res-emmer", x: -8.0, z: -1.8, plotId: "res-emmer" },
  { id: "p-res-reeds", x: -7.1, z: 1.0, plotId: "res-reeds" },
  { id: "p-res-clay", x: -7.9, z: 3.4, plotId: "res-clay" },
  { id: "p-civic-gh", x: -1.9, z: 2.8, plotId: "civic-gh" },
  { id: "p-civic-market", x: 0.8, z: 1.7, plotId: "civic-market" },
  // Shop entrances follow the ring arc W-SW → S → SE → E
  { id: "p-shop-1", x: -4.3, z: -1.1, plotId: "shop-1" },
  { id: "p-shop-3", x: -2.3, z: -3.7, plotId: "shop-3" },
  { id: "p-shop-5", x: 0.9, z: -3.7, plotId: "shop-5" },
  { id: "p-shop-2", x: 3.4, z: -2.0, plotId: "shop-2" },
  { id: "p-shop-4", x: 5.0, z: 1.6, plotId: "shop-4" },
  // Harbor pier entrance — on the waterline
  { id: "p-special-harbor", x: -11.0, z: 6.2, plotId: "special-harbor" },
  { id: "p-special-luxury", x: -2.3, z: 6.3, plotId: "special-luxury" },
  { id: "p-special-warehouse", x: 0.6, z: 6.2, plotId: "special-warehouse" },
  { id: "p-special-shrine", x: 3.6, z: 5.7, plotId: "special-shrine" },
  { id: "p-train-bow", x: 8.1, z: -2.2, plotId: "train-bow" },
  { id: "p-train-spear", x: 7.5, z: 0.2, plotId: "train-spear" },
  { id: "p-train-chariot", x: 8.0, z: 3.4, plotId: "train-chariot" },
];

/** Undirected edges between PATH_NODES (by id). */
export const PATH_EDGES: [string, string][] = [
  // Spine
  ["hub-res", "hub-civic"],
  ["hub-civic", "hub-shop"],
  ["hub-shop", "hub-train"],
  ["hub-civic", "hub-special"],
  // Resource spurs
  ["hub-res", "p-res-emmer"],
  ["hub-res", "p-res-reeds"],
  ["hub-res", "p-res-clay"],
  // Civic
  ["hub-civic", "p-civic-gh"],
  ["hub-civic", "p-civic-market"],
  ["hub-shop", "p-civic-market"],
  // Shops
  ["hub-shop", "p-shop-1"],
  ["hub-shop", "p-shop-2"],
  ["hub-shop", "p-shop-3"],
  ["hub-shop", "p-shop-4"],
  ["hub-shop", "p-shop-5"],
  // Ring road along the south arc: 1 → 3 → 5 → 2 → 4 in ring order
  ["p-shop-1", "p-shop-3"],
  ["p-shop-3", "p-shop-5"],
  ["p-shop-5", "p-shop-2"],
  ["p-shop-2", "p-shop-4"],
  // Ring closes east onto the specials arc, and west onto the resource hub
  ["p-shop-4", "p-special-shrine"],
  ["p-shop-1", "hub-res"],
  // Specials inland
  ["hub-special", "p-special-luxury"],
  ["hub-special", "p-special-warehouse"],
  ["hub-special", "p-special-shrine"],
  ["p-special-luxury", "p-special-warehouse"],
  ["p-special-warehouse", "p-special-shrine"],
  // Harbor on river: path from resources/bank → pier
  ["hub-res", "hub-pier"],
  ["hub-pier", "p-special-harbor"],
  ["p-res-clay", "hub-pier"],
  ["hub-special", "hub-pier"],
  // Training
  ["hub-train", "p-train-bow"],
  ["hub-train", "p-train-spear"],
  ["hub-train", "p-train-chariot"],
  ["p-train-bow", "p-train-spear"],
  ["p-train-spear", "p-train-chariot"],
];

/**
 * Apply map archetype layout transform to a base plot position.
 */
export function transformPlotPos(
  worldX: number,
  worldZ: number,
  layout: { mirrorZ?: boolean; offsetX?: number; offsetZ?: number }
): { x: number; z: number } {
  let x = worldX + (layout.offsetX ?? 0);
  let z = worldZ + (layout.offsetZ ?? 0);
  if (layout.mirrorZ) z = -z + 1.0; // flip around ~civic Z
  return { x, z };
}

export function getPathNode(id: string): PathNode | undefined {
  return PATH_NODES.find((n) => n.id === id);
}

/** Shortest path as node id list (BFS). */
export function pathBetween(fromId: string, toId: string): string[] {
  if (fromId === toId) return [fromId];
  const adj = new Map<string, string[]>();
  for (const n of PATH_NODES) adj.set(n.id, []);
  for (const [a, b] of PATH_EDGES) {
    adj.get(a)?.push(b);
    adj.get(b)?.push(a);
  }
  const prev = new Map<string, string | null>();
  const q = [fromId];
  prev.set(fromId, null);
  while (q.length) {
    const cur = q.shift()!;
    if (cur === toId) break;
    for (const nb of adj.get(cur) ?? []) {
      if (!prev.has(nb)) {
        prev.set(nb, cur);
        q.push(nb);
      }
    }
  }
  if (!prev.has(toId)) return [fromId];
  const out: string[] = [];
  let c: string | null = toId;
  while (c) {
    out.push(c);
    c = prev.get(c) ?? null;
  }
  out.reverse();
  return out;
}

/** All plot entrance node ids that have a plot. */
export function plotEntranceNodes(): PathNode[] {
  return PATH_NODES.filter((n) => n.plotId);
}

/** Flatten node-id path into world polyline samples. */
export function polylineFromNodeIds(ids: string[]): { x: number; z: number }[] {
  return ids
    .map((id) => getPathNode(id))
    .filter((n): n is PathNode => !!n)
    .map((n) => ({ x: n.x, z: n.z }));
}
