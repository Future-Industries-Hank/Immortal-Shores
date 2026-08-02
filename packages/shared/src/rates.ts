/**
 * GDD rate tables — single source of truth.
 * All production is per assigned Worker per real hour.
 */
import type {
  BuildingKind,
  LuxuryMaterial,
  ResourceId,
  ResourceStack,
  UnitKind,
} from "./types.js";

export const SEAL_FLOOR = 10;
export const STARTER_SEALS = 10;
export const STARTER_WORKERS = 18;
export const STARTER_RATIONS = 60;
export const STARTER_MUDBRICKS = 40;
export const WORKER_GROWTH_PER_HOUR = 3;
export const RATION_UPKEEP_PER_WORKER_HOUR = 1;
export const MAX_SETTLEMENTS = 4;
export const MAX_MONUMENTS = 2;
export const BARGE_CAPACITY = 100;
export const BARGE_COST: ResourceStack[] = [
  { resource: "cedarwood", amount: 25 },
  { resource: "rations", amount: 25 },
];
export const BARGE_WORKER_HOURS = 20;
export const CONSTRUCTION_CANCEL_REFUND = 0.25;
export const UNIT_TRAIN_HOURS = 4;
export const UNIT_UPKEEP_RATIONS = 1;
export const UNIT_TRAVEL_RATIONS_PER_HOUR = 2;
export const BLESSING_BONUS = 0.1;
export const BLESSING_HOURS = 48;
export const MONUMENT_PROD_BONUS_PER_LEVEL = 0.01;
export const MONUMENT_TRANSPORT_BONUS_PER_LEVEL = 0.01;
export const TICK_CAP_HOURS = 168; // 7 days max catch-up

/** Great House worker capacity by level (GDD §4.1) */
export const GREAT_HOUSE_CAPS: Record<number, number> = {
  1: 30,
  2: 45,
  3: 65,
  4: 90,
  5: 120,
  6: 155,
  7: 195,
  8: 240,
  9: 290,
  10: 345,
  11: 405,
  12: 470,
  13: 540,
  14: 615,
  15: 695,
  16: 780,
  17: 870,
  18: 965,
  19: 1065,
  20: 1170,
  21: 1280,
  22: 1395,
};

export const SEAL_GH_LEVELS = new Set([7, 10, 13, 16, 19, 22]);

export const FOUNDING_SEAL_COST: Record<number, number> = {
  2: 2,
  3: 3,
  4: 4,
};

export const LUXURY_MATERIALS: LuxuryMaterial[] = [
  "hides",
  "bronze",
  "cedarwood",
  "red_ochre",
  "eye_paint",
  "sacred_oil",
  "green_stones",
  "royal_gold",
];

export const RESOURCE_LABELS: Record<ResourceId, string> = {
  emmer: "Emmer",
  river_clay: "River Clay",
  marsh_reeds: "Marsh Reeds",
  rations: "Rations",
  mudbricks: "Mudbricks",
  vessels: "Vessels",
  reed_baskets: "Reed Baskets",
  limestone: "Limestone",
  hides: "Hides",
  bronze: "Bronze",
  cedarwood: "Cedarwood",
  red_ochre: "Red Ochre",
  eye_paint: "Eye Paint",
  sacred_oil: "Sacred Oil",
  green_stones: "Green Stones",
  royal_gold: "Royal Gold",
  fine_sandals: "Fine Sandals",
  stone_idols: "Stone Idols",
  eye_cosmetics: "Eye Cosmetics",
  sacred_perfume: "Sacred Perfume",
  amulets: "Amulets",
  seals: "Sacred Seals",
};

/** Output units per worker-hour (net output; inputs separate) */
export interface ProductionRule {
  kind: BuildingKind;
  output: ResourceId;
  ratePerWorkerHour: number;
  inputs?: ResourceStack[];
  /** Input stacks consumed per output unit produced */
  inputsPerOutput?: ResourceStack[];
}

export const PRODUCTION: ProductionRule[] = [
  {
    kind: "emmer_field",
    output: "emmer",
    ratePerWorkerHour: 8,
  },
  {
    kind: "river_clay_pit",
    output: "river_clay",
    ratePerWorkerHour: 5,
  },
  {
    kind: "marsh_reed_bed",
    output: "marsh_reeds",
    ratePerWorkerHour: 5,
  },
  {
    kind: "ration_house",
    output: "rations",
    ratePerWorkerHour: 6,
    inputsPerOutput: [{ resource: "emmer", amount: 2 }],
  },
  {
    kind: "mudbrick_yard",
    output: "mudbricks",
    ratePerWorkerHour: 2,
    inputsPerOutput: [
      { resource: "river_clay", amount: 2 },
      { resource: "marsh_reeds", amount: 1 },
    ],
  },
  {
    kind: "vessel_shop",
    output: "vessels",
    ratePerWorkerHour: 1,
    inputsPerOutput: [{ resource: "river_clay", amount: 2 }],
  },
  {
    kind: "reed_basket_shop",
    output: "reed_baskets",
    ratePerWorkerHour: 1,
    inputsPerOutput: [{ resource: "marsh_reeds", amount: 2 }],
  },
  {
    kind: "luxury_material",
    output: "hides", // overridden by building.luxury
    ratePerWorkerHour: 2,
  },
];

export const LUXURY_GOODS: {
  output: ResourceId;
  inputs: ResourceStack[];
  ratePerWorkerHour: number;
}[] = [
  {
    output: "fine_sandals",
    inputs: [
      { resource: "hides", amount: 2 },
      { resource: "marsh_reeds", amount: 4 },
    ],
    ratePerWorkerHour: 1,
  },
  {
    output: "stone_idols",
    inputs: [
      { resource: "bronze", amount: 2 },
      { resource: "river_clay", amount: 4 },
    ],
    ratePerWorkerHour: 1,
  },
  {
    output: "eye_cosmetics",
    inputs: [
      { resource: "red_ochre", amount: 1 },
      { resource: "eye_paint", amount: 1 },
    ],
    ratePerWorkerHour: 1,
  },
  {
    output: "sacred_perfume",
    inputs: [
      { resource: "red_ochre", amount: 1 },
      { resource: "sacred_oil", amount: 1 },
    ],
    ratePerWorkerHour: 1,
  },
  {
    output: "amulets",
    inputs: [
      { resource: "royal_gold", amount: 1 },
      { resource: "green_stones", amount: 1 },
    ],
    ratePerWorkerHour: 1,
  },
];

export const UNIT_COSTS: Record<
  UnitKind,
  { cost: ResourceStack[]; note: string }
> = {
  bowmen: {
    cost: [
      { resource: "cedarwood", amount: 3 },
      { resource: "hides", amount: 2 },
    ],
    note: "Ranged",
  },
  spearmen: {
    cost: [
      { resource: "bronze", amount: 3 },
      { resource: "hides", amount: 2 },
    ],
    note: "Line",
  },
  chariot_warriors: {
    cost: [
      { resource: "cedarwood", amount: 5 },
      { resource: "bronze", amount: 5 },
    ],
    note: "Strongest",
  },
};

/** Max workers assignable scales with building level */
export function buildingWorkerCap(kind: BuildingKind, level: number): number {
  if (kind === "great_house") return 0;
  if (kind === "market" || kind === "harbor" || kind === "shrine" || kind === "warehouse")
    return 0;
  const base: Record<string, number> = {
    emmer_field: 8,
    river_clay_pit: 6,
    marsh_reed_bed: 6,
    ration_house: 6,
    mudbrick_yard: 4,
    vessel_shop: 3,
    reed_basket_shop: 3,
    luxury_material: 4,
    luxury_workshop: 3,
    training_grounds: 4,
  };
  return (base[kind] ?? 4) * level;
}

/** Approximate GH upgrade cost — data-driven curve */
export function greatHouseUpgradeCost(toLevel: number): ResourceStack[] {
  const L = toLevel;
  const cost: ResourceStack[] = [
    { resource: "mudbricks", amount: 20 + L * 25 },
    { resource: "reed_baskets", amount: 5 + L * 4 },
    { resource: "vessels", amount: 5 + L * 4 },
  ];
  if (L >= 4) {
    cost.push({ resource: "fine_sandals", amount: Math.max(1, L - 3) });
  }
  if (L >= 8) {
    cost.push({ resource: "limestone", amount: 50 + (L - 8) * 40 });
  }
  if (L >= 12) {
    cost.push({ resource: "stone_idols", amount: Math.max(1, L - 10) });
    cost.push({ resource: "amulets", amount: Math.max(1, Math.floor((L - 10) / 2)) });
  }
  return cost;
}

export function sealRequiredForGh(toLevel: number): number {
  return SEAL_GH_LEVELS.has(toLevel) ? 1 : 0;
}

export function constructionHours(kind: BuildingKind, toLevel: number): number {
  if (kind === "great_house") return 2 + toLevel * 1.5;
  return 1 + toLevel * 0.75;
}

export const HARBOR_SHIP_CAPS: Record<number, number> = {
  1: 5,
  2: 12,
  3: 30,
  4: 80,
  5: 200,
  6: 400,
};

export const MARKET_PROVINCE_RANGE: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 5,
  5: 8,
  6: 99,
};

export const PROVINCES = [
  { id: "delta", name: "Delta Mouth", patronGood: "fine_sandals" as ResourceId, riverIndex: 0 },
  { id: "reed_bend", name: "Reed Bend", patronGood: "eye_cosmetics" as ResourceId, riverIndex: 1 },
  { id: "clay_banks", name: "Clay Banks", patronGood: "stone_idols" as ResourceId, riverIndex: 2 },
  { id: "midstream", name: "Midstream", patronGood: "sacred_perfume" as ResourceId, riverIndex: 3 },
  { id: "gold_reach", name: "Gold Reach", patronGood: "amulets" as ResourceId, riverIndex: 4 },
  { id: "upper_cataract", name: "Upper Cataract", patronGood: "fine_sandals" as ResourceId, riverIndex: 5 },
];

export const STYLE = {
  sandLight: "#E8D4B0",
  sandDeep: "#C4A574",
  mudbrick: "#C9956C",
  stonePale: "#E5E0D4",
  reedGreen: "#5F8F4E",
  fieldGreen: "#7FA85A",
  riverDeep: "#1E4D6B",
  riverLight: "#3A7CA5",
  goldSoft: "#D4A84B",
  inkUi: "#2A2118",
  papyrus: "#F3E6C8",
  sealAccent: "#8B3A4A",
} as const;
