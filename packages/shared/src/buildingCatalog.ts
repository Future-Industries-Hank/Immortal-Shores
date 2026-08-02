/**
 * Building catalog — single source for inspect popups and (eventually) server costs.
 * Keep costs aligned with apps/server construction logic.
 */
import type { BuildingKind, LuxuryMaterial, ResourceId, ResourceStack } from "./types.js";
import {
  GREAT_HOUSE_CAPS,
  HARBOR_SHIP_CAPS,
  LUXURY_GOODS,
  MARKET_PROVINCE_RANGE,
  PRODUCTION,
  RESOURCE_LABELS,
  buildingWorkerCap,
  constructionHours,
  greatHouseUpgradeCost,
  sealRequiredForGh,
} from "./rates.js";

export const MAX_BUILDING_LEVEL: Record<BuildingKind, number> = {
  great_house: 22,
  market: 6,
  emmer_field: 8,
  river_clay_pit: 8,
  marsh_reed_bed: 8,
  ration_house: 8,
  mudbrick_yard: 8,
  vessel_shop: 8,
  reed_basket_shop: 8,
  luxury_material: 8,
  luxury_workshop: 8,
  harbor: 6,
  warehouse: 6,
  training_grounds: 6,
  shrine: 5,
};

export const BUILDING_TITLE: Record<BuildingKind, string> = {
  great_house: "Great House",
  market: "Market",
  emmer_field: "Emmer Field",
  river_clay_pit: "River Clay Pit",
  marsh_reed_bed: "Marsh Reed Bed",
  ration_house: "Ration House",
  mudbrick_yard: "Mudbrick Yard",
  vessel_shop: "Vessel Shop",
  reed_basket_shop: "Reed Basket Shop",
  luxury_material: "Luxury Works",
  luxury_workshop: "Luxury Goods Shop",
  harbor: "Harbor",
  warehouse: "Warehouse",
  training_grounds: "Training Grounds",
  shrine: "Shrine",
};

export const BUILDING_BLURB: Record<BuildingKind, string> = {
  great_house:
    "Seat of your shore. Raises Worker capacity, settlement rank, and unlocks Envoys at level 7. Sacred Seals required at major thresholds.",
  market:
    "Posts and browses Ration-priced orders. Higher levels reach more Provinces along the river.",
  emmer_field: "Grain of the eternal river. Emmer feeds Ration Houses and your people.",
  river_clay_pit: "River clay for Mudbricks, Vessels, and some luxury goods.",
  marsh_reed_bed: "Marsh reeds for Mudbricks, baskets, and Fine Sandals.",
  ration_house: "Bakes Emmer into Rations — the currency of work and the Market. Essential early.",
  mudbrick_yard:
    "Fires Mudbricks from clay and reeds. First shop most players place — every building needs bricks.",
  vessel_shop: "Shapes clay into Vessels used in Great House upgrades and trade.",
  reed_basket_shop: "Weaves baskets for GH upgrades and commerce.",
  luxury_material:
    "Your settlement's unique luxury material. Build this on a Special plot so you can trade from the start.",
  luxury_workshop:
    "Crafts luxury goods (Fine Sandals, Stone Idols, etc.) for trade and shrine offerings. Uses a Shop plot.",
  harbor: "Builds River Barges for long-haul cargo. Special plot only.",
  warehouse: "Storehouse for surplus goods. Special plot only. (Capacity bonuses expand later.)",
  training_grounds:
    "Barracks for one unit type on this plot (Bowmen, Spearmen, or Chariots). Low early priority.",
  shrine: "Contributes luxury goods toward your Province's 48h blessing. Special plot only.",
};

export function formatStacks(stacks: ResourceStack[]): string {
  if (!stacks.length) return "—";
  return stacks
    .map((s) => `${s.amount} ${RESOURCE_LABELS[s.resource] ?? s.resource}`)
    .join(", ");
}

export function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h === Math.floor(h)) return `${h} h`;
  return `${h.toFixed(1)} h`;
}

/** Cost to upgrade an existing building to `toLevel` (matches server). */
export function buildingUpgradeCost(
  kind: BuildingKind,
  toLevel: number
): ResourceStack[] {
  if (kind === "great_house") return greatHouseUpgradeCost(toLevel);
  return [
    { resource: "mudbricks", amount: 15 * toLevel },
    { resource: "reed_baskets", amount: 2 * toLevel },
  ];
}

/** Seals spent when upgrading to this level (GH only). */
export function buildingUpgradeSeals(kind: BuildingKind, toLevel: number): number {
  if (kind === "great_house") return sealRequiredForGh(toLevel);
  return 0;
}

export interface OutputLine {
  /** Human line, e.g. "8 Emmer / Worker / hour" */
  text: string;
  resource?: ResourceId;
  perWorkerHour?: number;
}

export function buildingOutputsAtLevel(
  kind: BuildingKind,
  level: number,
  luxury?: LuxuryMaterial
): OutputLine[] {
  const cap = buildingWorkerCap(kind, level);
  const lines: OutputLine[] = [];

  if (kind === "great_house") {
    lines.push({
      text: `Worker capacity ${GREAT_HOUSE_CAPS[level] ?? "—"}`,
    });
    if (level >= 7) lines.push({ text: "Envoys unlocked" });
    if ([7, 10, 13, 16, 19, 22].includes(level)) {
      lines.push({ text: "Sacred Seal threshold level" });
    }
    return lines;
  }

  if (kind === "market") {
    const range = MARKET_PROVINCE_RANGE[Math.min(level, 6)] ?? 1;
    lines.push({
      text: `Province order range: ${range === 99 ? "all" : range}`,
    });
    return lines;
  }

  if (kind === "harbor") {
    const ships = HARBOR_SHIP_CAPS[Math.min(level, 6)] ?? 5;
    lines.push({ text: `Ship berths: ${ships}` });
    lines.push({ text: "Build barges (25 Cedarwood + 25 Rations + 20 worker-hours)" });
    return lines;
  }

  if (kind === "training_grounds") {
    lines.push({ text: "Trains the unit type bound to this plot" });
    lines.push({ text: `Worker slots: ${cap}` });
    return lines;
  }

  if (kind === "warehouse") {
    lines.push({ text: "Storehouse for surplus goods" });
    lines.push({ text: "No production Workers" });
    return lines;
  }

  if (kind === "shrine") {
    lines.push({ text: "Contribute patron luxury goods for province blessing" });
    lines.push({ text: "+10% production for 48h when threshold met (same Province)" });
    return lines;
  }

  if (kind === "luxury_workshop") {
    lines.push({ text: `Worker slots: ${cap}` });
    for (const g of LUXURY_GOODS) {
      lines.push({
        text: `${RESOURCE_LABELS[g.output]}: ${g.ratePerWorkerHour}/Worker/h · needs ${formatStacks(g.inputs)}`,
        resource: g.output,
        perWorkerHour: g.ratePerWorkerHour,
      });
    }
    return lines;
  }

  if (kind === "luxury_material") {
    const res = (luxury ?? "hides") as ResourceId;
    lines.push({
      text: `${RESOURCE_LABELS[res]}: 2 / Worker / hour`,
      resource: res,
      perWorkerHour: 2,
    });
    lines.push({ text: `Worker slots: ${cap}` });
    return lines;
  }

  const rule = PRODUCTION.find((p) => p.kind === kind);
  if (rule) {
    let text = `${RESOURCE_LABELS[rule.output]}: ${rule.ratePerWorkerHour} / Worker / hour`;
    if (rule.inputsPerOutput?.length) {
      text += ` · consumes ${formatStacks(rule.inputsPerOutput)} each`;
    }
    lines.push({
      text,
      resource: rule.output,
      perWorkerHour: rule.ratePerWorkerHour,
    });
    lines.push({ text: `Worker slots: ${cap}` });
    if (rule.ratePerWorkerHour && cap > 0) {
      lines.push({
        text: `At full staff: up to ${rule.ratePerWorkerHour * cap} ${RESOURCE_LABELS[rule.output]}/hour (if inputs allow)`,
      });
    }
  }

  return lines;
}

/** Expected output right now given assigned workers. */
export function expectedOutputNow(
  kind: BuildingKind,
  level: number,
  workers: number,
  luxury?: LuxuryMaterial
): string {
  if (workers <= 0 && canAssignWorkers(kind)) {
    return "No Workers assigned — no production.";
  }
  if (kind === "great_house") {
    return `Cap ${GREAT_HOUSE_CAPS[level] ?? "—"} Workers · growth +3/h until cap`;
  }
  if (kind === "market") {
    const range = MARKET_PROVINCE_RANGE[Math.min(level, 6)] ?? 1;
    return `Browsing ${range === 99 ? "all" : range} province tier(s) of Market orders`;
  }
  if (kind === "harbor") {
    return `${HARBOR_SHIP_CAPS[Math.min(level, 6)] ?? 5} berths · build/launch barges from Harbor panel`;
  }
  if (kind === "training_grounds") {
    return workers > 0
      ? "Grounds staffed — train units from Military panel"
      : "Assign Workers or train units from Military panel";
  }
  if (kind === "shrine") {
    return "Use Shrine contribution from Military / Shore actions";
  }
  if (kind === "luxury_workshop") {
    return `${workers} Workers crafting any affordable luxury good (~1/Worker/h)`;
  }
  if (kind === "luxury_material") {
    const res = RESOURCE_LABELS[(luxury ?? "hides") as ResourceId];
    return `${workers * 2} ${res} / hour`;
  }
  const rule = PRODUCTION.find((p) => p.kind === kind);
  if (rule) {
    const n = workers * rule.ratePerWorkerHour;
    const name = RESOURCE_LABELS[rule.output];
    if (rule.inputsPerOutput?.length) {
      const need = rule.inputsPerOutput
        .map((i) => `${i.amount * n} ${RESOURCE_LABELS[i.resource]}`)
        .join(" + ");
      return `Up to ${n} ${name}/hour (needs ${need})`;
    }
    return `${n} ${name} / hour`;
  }
  return "—";
}

export function canAssignWorkers(kind: BuildingKind): boolean {
  return !["great_house", "market", "harbor", "shrine", "warehouse"].includes(kind);
}

export interface LevelPreview {
  level: number;
  isCurrent: boolean;
  isNext: boolean;
  workerCap: number;
  /** Cost to reach this level from previous (empty for L1 existing) */
  upgradeCost: ResourceStack[];
  upgradeSeals: number;
  buildHours: number;
  outputs: OutputLine[];
  special?: string;
}

export function levelPreviews(
  kind: BuildingKind,
  currentLevel: number,
  luxury?: LuxuryMaterial,
  previewCount = 6
): LevelPreview[] {
  const max = MAX_BUILDING_LEVEL[kind] ?? 8;
  const start = Math.max(1, currentLevel);
  const end = Math.min(max, currentLevel + previewCount - 1);
  // Always show a few levels around current, including past one if useful
  const from = Math.max(1, Math.min(start, end - previewCount + 1));
  const to = Math.min(max, Math.max(end, from + previewCount - 1));
  const rows: LevelPreview[] = [];
  for (let L = from; L <= to; L++) {
    const cost = L === 1 && currentLevel >= 1 ? [] : buildingUpgradeCost(kind, L);
    // For L1 of existing building, no "upgrade to 1"
    const showCost = L > 1 || currentLevel < 1;
    rows.push({
      level: L,
      isCurrent: L === currentLevel,
      isNext: L === currentLevel + 1,
      workerCap: buildingWorkerCap(kind, L),
      upgradeCost: showCost && L > currentLevel ? buildingUpgradeCost(kind, L) : L === currentLevel + 1 ? cost : buildingUpgradeCost(kind, L),
      upgradeSeals: buildingUpgradeSeals(kind, L),
      buildHours: constructionHours(kind, L),
      outputs: buildingOutputsAtLevel(kind, L, luxury),
      special:
        kind === "great_house" && L === 7
          ? "Envoys unlock"
          : kind === "great_house" && sealRequiredForGh(L)
            ? "Requires 1 Sacred Seal"
            : undefined,
    });
  }
  return rows;
}

/** Next upgrade only — cost/time to go current → current+1 */
export function nextUpgrade(
  kind: BuildingKind,
  currentLevel: number
): {
  toLevel: number;
  cost: ResourceStack[];
  seals: number;
  hours: number;
  maxed: boolean;
} {
  const max = MAX_BUILDING_LEVEL[kind] ?? 8;
  if (currentLevel >= max) {
    return { toLevel: currentLevel, cost: [], seals: 0, hours: 0, maxed: true };
  }
  const toLevel = currentLevel + 1;
  return {
    toLevel,
    cost: buildingUpgradeCost(kind, toLevel),
    seals: buildingUpgradeSeals(kind, toLevel),
    hours: constructionHours(kind, toLevel),
    maxed: false,
  };
}

export function actionsForBuilding(kind: BuildingKind): string[] {
  const actions: string[] = ["Inspect"];
  if (canAssignWorkers(kind)) {
    actions.push("Assign Workers", "Clear Workers");
  }
  actions.push("Upgrade (if not max)");
  if (kind === "harbor") actions.push("Build barge", "Launch barge");
  if (kind === "training_grounds") actions.push("Train units");
  if (kind === "shrine") actions.push("Contribute offering");
  if (kind === "market") actions.push("Open Market / Tablet Wall");
  if (kind === "great_house") actions.push("View Worker cap path", "Ascension (L22)");
  return actions;
}
