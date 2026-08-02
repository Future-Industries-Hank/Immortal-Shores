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
 * Left = river / resources · Center = GH + Market · Right = shops · Inland = special · Edge = training
 */
export const SETTLEMENT_PLOTS: SettlementPlotDef[] = [
  // —— Resource cluster (closest to river, left) ——
  {
    id: "res-emmer",
    category: "starter",
    label: "Emmer Field",
    worldX: -8.5,
    worldZ: -2.5,
    tint: "#7FA85A",
    starterKind: "emmer_field",
    allowed: [],
  },
  {
    id: "res-reeds",
    category: "starter",
    label: "Marsh Reed Bed",
    worldX: -8.5,
    worldZ: 1.2,
    tint: "#5F8F4E",
    starterKind: "marsh_reed_bed",
    allowed: [],
  },
  {
    id: "res-clay",
    category: "starter",
    label: "River Clay Pit",
    worldX: -8.5,
    worldZ: 4.5,
    tint: "#C9956C",
    starterKind: "river_clay_pit",
    allowed: [],
  },

  // —— Civic center ——
  {
    id: "civic-gh",
    category: "starter",
    label: "Great House",
    worldX: -2.2,
    worldZ: 0.5,
    tint: "#E5E0D4",
    starterKind: "great_house",
    allowed: [],
  },
  {
    id: "civic-market",
    category: "starter",
    label: "Market",
    worldX: 0.6,
    worldZ: 2.2,
    tint: "#D4A84B",
    starterKind: "market",
    allowed: [],
  },

  // —— 5 Flexible shop plots (right of GH, easy early-game clicks) ——
  {
    id: "shop-1",
    category: "shop",
    label: "Shop plot",
    worldX: 3.8,
    worldZ: -3.2,
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
    worldX: 6.6,
    worldZ: -3.2,
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
    worldX: 3.8,
    worldZ: -0.4,
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
    worldX: 6.6,
    worldZ: -0.4,
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
    worldX: 5.2,
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

  // —— 4 Special plots (further inland; harbor nearest river path) ——
  {
    id: "special-harbor",
    category: "special",
    label: "Harbor site",
    worldX: -5.5,
    worldZ: 7.2,
    tint: "#3A7CA5",
    allowed: ["harbor"],
  },
  {
    id: "special-luxury",
    category: "special",
    label: "Luxury works site",
    worldX: -1.5,
    worldZ: 7.2,
    tint: "#8B3A4A",
    allowed: ["luxury_material"],
  },
  {
    id: "special-warehouse",
    category: "special",
    label: "Warehouse site",
    worldX: 2.5,
    worldZ: 7.2,
    tint: "#C4A574",
    allowed: ["warehouse"],
  },
  {
    id: "special-shrine",
    category: "special",
    label: "Shrine site",
    worldX: 6.0,
    worldZ: 7.2,
    tint: "#E5E0D4",
    allowed: ["shrine"],
  },

  // —— 3 Training grounds (outer edge, secondary early-game) ——
  {
    id: "train-bow",
    category: "training",
    label: "Bowmen grounds",
    worldX: 9.5,
    worldZ: -2.5,
    tint: "#A89070",
    allowed: ["training_grounds"],
    trainingUnit: "bowmen",
  },
  {
    id: "train-spear",
    category: "training",
    label: "Spearmen grounds",
    worldX: 9.5,
    worldZ: 0.8,
    tint: "#A89070",
    allowed: ["training_grounds"],
    trainingUnit: "spearmen",
  },
  {
    id: "train-chariot",
    category: "training",
    label: "Chariot grounds",
    worldX: 9.5,
    worldZ: 4.2,
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

/** Great House level → road surface quality */
export function roadTierForGhLevel(ghLevel: number): RoadTier {
  if (ghLevel >= 10) return "stone";
  if (ghLevel >= 4) return "packed";
  return "dirt";
}

export const ROAD_COLORS: Record<RoadTier, { fill: string; edge: string }> = {
  dirt: { fill: "#A67C52", edge: "#8B6340" },
  packed: { fill: "#B8956A", edge: "#9A7A50" },
  stone: { fill: "#C8C0B0", edge: "#9A9284" },
};

export interface PathNode {
  id: string;
  x: number;
  z: number;
  /** If set, this node sits at a plot entrance */
  plotId?: string;
}

/**
 * Graph nodes: hubs + plot entrances.
 * Layout follows the sparse pads (river left, training right).
 */
export const PATH_NODES: PathNode[] = [
  // Main spine (west → east)
  { id: "hub-res", x: -6.2, z: 1.2 },
  { id: "hub-civic", x: -2.2, z: 0.5 },
  { id: "hub-shop", x: 3.5, z: 0.0 },
  { id: "hub-train", x: 8.0, z: 0.8 },
  // North specials spine
  { id: "hub-special", x: 0.5, z: 5.2 },
  // Plot entrances (slightly offset toward path network)
  { id: "p-res-emmer", x: -7.4, z: -2.0, plotId: "res-emmer" },
  { id: "p-res-reeds", x: -7.4, z: 1.2, plotId: "res-reeds" },
  { id: "p-res-clay", x: -7.4, z: 4.0, plotId: "res-clay" },
  { id: "p-civic-gh", x: -2.2, z: 0.5, plotId: "civic-gh" },
  { id: "p-civic-market", x: 0.2, z: 1.6, plotId: "civic-market" },
  { id: "p-shop-1", x: 3.8, z: -2.4, plotId: "shop-1" },
  { id: "p-shop-2", x: 6.0, z: -2.4, plotId: "shop-2" },
  { id: "p-shop-3", x: 3.8, z: -0.2, plotId: "shop-3" },
  { id: "p-shop-4", x: 6.0, z: -0.2, plotId: "shop-4" },
  { id: "p-shop-5", x: 5.0, z: 1.6, plotId: "shop-5" },
  { id: "p-special-harbor", x: -5.0, z: 6.0, plotId: "special-harbor" },
  { id: "p-special-luxury", x: -1.5, z: 6.0, plotId: "special-luxury" },
  { id: "p-special-warehouse", x: 2.5, z: 6.0, plotId: "special-warehouse" },
  { id: "p-special-shrine", x: 5.5, z: 6.0, plotId: "special-shrine" },
  { id: "p-train-bow", x: 8.5, z: -2.0, plotId: "train-bow" },
  { id: "p-train-spear", x: 8.5, z: 0.8, plotId: "train-spear" },
  { id: "p-train-chariot", x: 8.5, z: 3.5, plotId: "train-chariot" },
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
  ["p-shop-1", "p-shop-3"],
  ["p-shop-2", "p-shop-4"],
  ["p-shop-3", "p-shop-5"],
  // Specials
  ["hub-special", "p-special-harbor"],
  ["hub-special", "p-special-luxury"],
  ["hub-special", "p-special-warehouse"],
  ["hub-special", "p-special-shrine"],
  ["p-special-harbor", "p-special-luxury"],
  ["p-special-luxury", "p-special-warehouse"],
  ["p-special-warehouse", "p-special-shrine"],
  ["hub-res", "p-special-harbor"],
  // Training
  ["hub-train", "p-train-bow"],
  ["hub-train", "p-train-spear"],
  ["hub-train", "p-train-chariot"],
  ["p-train-bow", "p-train-spear"],
  ["p-train-spear", "p-train-chariot"],
];

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
