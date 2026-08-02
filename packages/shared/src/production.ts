/**
 * Production QoL helpers — rates stay GDD-identical.
 */
import type { BuildingState, ResourceId, SettlementState, VaultBalances } from "./types.js";
import {
  PRODUCTION,
  RATION_UPKEEP_PER_WORKER_HOUR,
  buildingWorkerCap,
} from "./rates.js";

export interface BuildingProdLine {
  buildingId: string;
  kind: string;
  workers: number;
  cap: number;
  outputPerHour: number;
  outputResource?: ResourceId;
  rationDrainPerHour: number;
  inputsNote?: string;
  paused?: boolean;
}

export function productionOverlay(
  settlement: SettlementState,
  pauseNonEssential = false
): BuildingProdLine[] {
  const lines: BuildingProdLine[] = [];
  for (const b of settlement.buildings) {
    const cap = buildingWorkerCap(b.kind, b.level);
    const essential = isEssential(b.kind);
    const paused = pauseNonEssential && !essential;
    const workers = paused ? 0 : b.workers;
    const rule = PRODUCTION.find((p) => p.kind === b.kind);
    let outputPerHour = 0;
    let outputResource: ResourceId | undefined;
    let inputsNote: string | undefined;
    if (b.kind === "luxury_material" && b.luxury) {
      outputPerHour = workers * 2;
      outputResource = b.luxury;
    } else if (rule) {
      outputPerHour = workers * rule.ratePerWorkerHour;
      outputResource = rule.output;
      if (rule.inputsPerOutput?.length) {
        inputsNote = rule.inputsPerOutput
          .map((i) => `${i.amount * outputPerHour} ${i.resource}/h`)
          .join(", ");
      }
    }
    lines.push({
      buildingId: b.id,
      kind: b.kind,
      workers: b.workers,
      cap,
      outputPerHour,
      outputResource,
      rationDrainPerHour: workers * RATION_UPKEEP_PER_WORKER_HOUR,
      inputsNote,
      paused,
    });
  }
  return lines;
}

function isEssential(kind: string): boolean {
  return [
    "emmer_field",
    "ration_house",
    "river_clay_pit",
    "marsh_reed_bed",
    "mudbrick_yard",
  ].includes(kind);
}

/** Hours until rations empty at current drain (null if surplus or zero drain). */
export function hoursUntilRationEmpty(
  vault: VaultBalances,
  settlement: SettlementState,
  pauseNonEssential = false
): number | null {
  const overlay = productionOverlay(settlement, pauseNonEssential);
  const drain = overlay.reduce((s, l) => s + l.rationDrainPerHour, 0);
  const rationOut = overlay
    .filter((l) => l.outputResource === "rations")
    .reduce((s, l) => s + l.outputPerHour, 0);
  const net = rationOut - drain;
  if (net >= 0) return null;
  const stock = vault.rations ?? 0;
  if (stock <= 0) return 0;
  return stock / -net;
}

export type SuggestedAssignment = { buildingId: string; workers: number };

/**
 * Balance helper: feed Ration Houses from Emmer fields, feed Mudbrick from clay+reeds.
 * Simple greedy heuristic — never mandatory.
 */
export function suggestWorkerBalance(
  settlement: SettlementState
): SuggestedAssignment[] {
  const free = settlement.workers;
  const byKind = (k: string) => settlement.buildings.filter((b) => b.kind === k);
  const out: SuggestedAssignment[] = settlement.buildings.map((b) => ({
    buildingId: b.id,
    workers: 0,
  }));
  const set = (b: BuildingState, n: number) => {
    const row = out.find((r) => r.buildingId === b.id)!;
    const cap = buildingWorkerCap(b.kind, b.level);
    row.workers = Math.max(0, Math.min(cap, n));
  };

  let remaining = free;
  const emmer = byKind("emmer_field");
  const ration = byKind("ration_house");
  const clay = byKind("river_clay_pit");
  const reeds = byKind("marsh_reed_bed");
  const bricks = byKind("mudbrick_yard");
  const lux = byKind("luxury_material");

  // Priority: keep rations + bricks flowing
  const give = (list: BuildingState[], nEach: number) => {
    for (const b of list) {
      const cap = buildingWorkerCap(b.kind, b.level);
      const n = Math.min(cap, nEach, remaining);
      set(b, n);
      remaining -= n;
    }
  };

  // Rough equilibrium: more emmer than ration workers (2 emmer per ration unit, 8 vs 6 rates)
  // 3 emmer : 2 ration workers is a workable start
  give(emmer, Math.max(2, Math.floor(free * 0.28)));
  give(ration, Math.max(1, Math.floor(free * 0.18)));
  give(clay, Math.max(1, Math.floor(free * 0.14)));
  give(reeds, Math.max(1, Math.floor(free * 0.12)));
  give(bricks, Math.max(1, Math.floor(free * 0.12)));
  give(lux, Math.max(1, Math.floor(free * 0.1)));

  // Dump leftover onto emmer
  if (remaining > 0 && emmer[0]) {
    const b = emmer[0];
    const row = out.find((r) => r.buildingId === b.id)!;
    const cap = buildingWorkerCap(b.kind, b.level);
    const add = Math.min(remaining, cap - row.workers);
    row.workers += add;
    remaining -= add;
  }

  return out;
}

export function marketProvinceRange(marketLevel: number): number {
  const table: Record<number, number> = {
    1: 1,
    2: 2,
    3: 3,
    4: 5,
    5: 8,
    6: 99,
  };
  return table[Math.min(6, Math.max(1, marketLevel))] ?? 1;
}

/** Province riverIndex distance for Market visibility. */
export function provinceInRange(
  viewerRiverIndex: number,
  orderRiverIndex: number,
  range: number
): boolean {
  if (range >= 99) return true;
  return Math.abs(viewerRiverIndex - orderRiverIndex) <= range;
}
