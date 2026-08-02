/**
 * Authoritative production tick + offline catch-up.
 * Never double-dip: lastTickAt advances exactly by applied elapsed.
 */
import {
  LUXURY_GOODS,
  MONUMENT_PROD_BONUS_PER_LEVEL,
  PRODUCTION,
  RATION_UPKEEP_PER_WORKER_HOUR,
  TICK_CAP_HOURS,
  WORKER_GROWTH_PER_HOUR,
  GREAT_HOUSE_CAPS,
  type BuildingState,
  type ResourceId,
  type ResourceStack,
  type SettlementState,
  type TickSummary,
  type VaultBalances,
} from "@immortal/shared";
// BuildingState used for pause-non-essential effective workers

function add(vault: VaultBalances, resource: ResourceId, amount: number) {
  vault[resource] = (vault[resource] ?? 0) + amount;
}

function get(vault: VaultBalances, resource: ResourceId): number {
  return vault[resource] ?? 0;
}

/**
 * Shortage multiplier: if rations can't cover full upkeep for the hour-slice,
 * scale production by available/needed (min 0.15 so you never fully hard-lock).
 */
export function shortageMultiplier(
  rations: number,
  assignedWorkers: number,
  hours: number
): number {
  if (assignedWorkers <= 0 || hours <= 0) return 1;
  const needed = assignedWorkers * RATION_UPKEEP_PER_WORKER_HOUR * hours;
  if (needed <= 0) return 1;
  if (rations >= needed) return 1;
  return Math.max(0.15, rations / needed);
}

function monumentProdBonus(settlement: SettlementState): number {
  let levels = 0;
  for (const m of settlement.monuments) levels += m.level;
  return 1 + levels * MONUMENT_PROD_BONUS_PER_LEVEL;
}

function produceFromBuilding(
  b: BuildingState,
  hours: number,
  mult: number,
  vault: VaultBalances,
  produced: Map<ResourceId, number>,
  consumed: Map<ResourceId, number>
) {
  if (b.workers <= 0 || hours <= 0) return;

  if (b.kind === "luxury_workshop") {
    // Craft whichever luxury good we can from available inputs
    for (const recipe of LUXURY_GOODS) {
      const raw = b.workers * recipe.ratePerWorkerHour * hours * mult;
      let units = Math.floor(raw);
      if (units <= 0) continue;
      for (const inp of recipe.inputs) {
        const have = get(vault, inp.resource);
        units = Math.min(units, Math.floor(have / inp.amount));
      }
      if (units <= 0) continue;
      for (const inp of recipe.inputs) {
        const use = units * inp.amount;
        add(vault, inp.resource, -use);
        consumed.set(inp.resource, (consumed.get(inp.resource) ?? 0) + use);
      }
      add(vault, recipe.output, units);
      produced.set(recipe.output, (produced.get(recipe.output) ?? 0) + units);
      break; // one recipe per building per tick slice
    }
    return;
  }

  if (b.kind === "luxury_material" && b.luxury) {
    const units = Math.floor(b.workers * 2 * hours * mult);
    if (units > 0) {
      add(vault, b.luxury, units);
      produced.set(b.luxury, (produced.get(b.luxury) ?? 0) + units);
    }
    return;
  }

  const rule = PRODUCTION.find((p) => p.kind === b.kind);
  if (!rule) return;

  let units = Math.floor(b.workers * rule.ratePerWorkerHour * hours * mult);
  if (units <= 0) return;

  if (rule.inputsPerOutput) {
    for (const inp of rule.inputsPerOutput) {
      const have = get(vault, inp.resource);
      units = Math.min(units, Math.floor(have / inp.amount));
    }
    if (units <= 0) return;
    for (const inp of rule.inputsPerOutput) {
      const use = units * inp.amount;
      add(vault, inp.resource, -use);
      consumed.set(inp.resource, (consumed.get(inp.resource) ?? 0) + use);
    }
  }

  add(vault, rule.output, units);
  produced.set(rule.output, (produced.get(rule.output) ?? 0) + units);
}

const ESSENTIAL_KINDS = new Set([
  "emmer_field",
  "ration_house",
  "river_clay_pit",
  "marsh_reed_bed",
  "mudbrick_yard",
]);

export function applySettlementTick(
  settlement: SettlementState,
  vault: VaultBalances,
  now: number,
  blessingMult = 1,
  pauseNonEssential = false
): TickSummary {
  const elapsedMs = Math.max(0, now - settlement.lastTickAt);
  let hours = elapsedMs / 3_600_000;
  if (hours > TICK_CAP_HOURS) hours = TICK_CAP_HOURS;
  if (hours < 1 / 3600) {
    // sub-second: skip
    return {
      elapsedHours: 0,
      produced: [],
      consumed: [],
      workersGrown: 0,
      shortageMultiplier: 1,
    };
  }

  // Effective workers (pause non-essential without clearing assignments)
  const effWorkers = (b: BuildingState) => {
    if (pauseNonEssential && !ESSENTIAL_KINDS.has(b.kind)) return 0;
    return b.workers;
  };

  const assigned = settlement.buildings.reduce((s, b) => s + b.workers, 0);
  const assignedEff = settlement.buildings.reduce((s, b) => s + effWorkers(b), 0);
  settlement.workersAssigned = assigned;

  const mult =
    shortageMultiplier(get(vault, "rations"), assignedEff, hours) *
    monumentProdBonus(settlement) *
    blessingMult;

  const produced = new Map<ResourceId, number>();
  const consumed = new Map<ResourceId, number>();

  // Upkeep first (partial if short) — only active production workers
  const upkeepNeeded = assignedEff * RATION_UPKEEP_PER_WORKER_HOUR * hours;
  const upkeepPaid = Math.min(get(vault, "rations"), upkeepNeeded);
  if (upkeepPaid > 0) {
    add(vault, "rations", -upkeepPaid);
    consumed.set("rations", (consumed.get("rations") ?? 0) + upkeepPaid);
  }

  for (const b of settlement.buildings) {
    const active = { ...b, workers: effWorkers(b) };
    produceFromBuilding(active, hours, mult, vault, produced, consumed);
  }

  // Monument limestone
  for (const m of settlement.monuments) {
    if (m.workers <= 0) continue;
    const units = Math.floor(m.workers * 1 * hours * mult);
    if (units > 0) {
      m.limestone += units;
      add(vault, "limestone", units);
      produced.set("limestone", (produced.get("limestone") ?? 0) + units);
    }
  }

  // Construction progress — free workers advance the single queue
  if (settlement.construction) {
    const job = settlement.construction;
    const free = Math.max(0, settlement.workers - assigned);
    const progressWorkers = Math.max(1, Math.min(free, 6));
    job.workerHoursDone += progressWorkers * hours;
    if (job.workerHoursDone >= job.workerHoursRequired) {
      completeConstruction(settlement, job);
      settlement.construction = null;
    }
  }

  // Barge building progress
  for (const barge of settlement.barges) {
    if (barge.status !== "building") continue;
    const free = Math.max(0, settlement.workers - assigned);
    const pw = Math.max(1, Math.min(free, 4));
    barge.workerHoursDone = (barge.workerHoursDone ?? 0) + pw * hours;
    if ((barge.workerHoursDone ?? 0) >= (barge.workerHoursRequired ?? 20)) {
      barge.status = "docked";
    }
  }

  // Worker growth
  const cap = GREAT_HOUSE_CAPS[settlement.greatHouseLevel] ?? 30;
  let grown = 0;
  if (settlement.workers < cap) {
    grown = Math.min(
      cap - settlement.workers,
      Math.floor(WORKER_GROWTH_PER_HOUR * hours * 1000) / 1000
    );
    // accumulate fractional via floating workers field — keep integer floor
    const next = settlement.workers + WORKER_GROWTH_PER_HOUR * hours;
    const newInt = Math.min(cap, Math.floor(next));
    grown = newInt - settlement.workers;
    settlement.workers = newInt;
  }

  // Military upkeep
  const unitCount = settlement.units.reduce((s, u) => s + u.count, 0);
  if (unitCount > 0) {
    const need = unitCount * hours;
    const pay = Math.min(get(vault, "rations"), need);
    if (pay > 0) {
      add(vault, "rations", -pay);
      consumed.set("rations", (consumed.get("rations") ?? 0) + pay);
    }
    // desertion if unpaid
    if (pay < need * 0.5) {
      for (const u of settlement.units) {
        if (u.count > 0) u.count = Math.max(0, u.count - 1);
      }
      settlement.units = settlement.units.filter((u) => u.count > 0);
    }
  }

  settlement.lastTickAt = now;

  const toStacks = (m: Map<ResourceId, number>): ResourceStack[] =>
    [...m.entries()]
      .filter(([, a]) => a !== 0)
      .map(([resource, amount]) => ({ resource, amount }));

  return {
    elapsedHours: hours,
    produced: toStacks(produced),
    consumed: toStacks(consumed),
    workersGrown: grown,
    shortageMultiplier: mult,
  };
}

function completeConstruction(
  settlement: SettlementState,
  job: {
    kind: BuildingState["kind"];
    targetLevel: number;
    buildingId: string | null;
    plotId?: string;
    plotX?: number;
    plotY?: number;
    trainingUnit?: BuildingState["trainingUnit"];
    luxury?: BuildingState["luxury"];
  }
) {
  const { kind, targetLevel, buildingId } = job;
  if (kind === "great_house") {
    settlement.greatHouseLevel = targetLevel;
    const gh = settlement.buildings.find((b) => b.kind === "great_house");
    if (gh) gh.level = targetLevel;
    return;
  }
  if (buildingId) {
    const b = settlement.buildings.find((x) => x.id === buildingId);
    if (b) {
      b.level = targetLevel;
      return;
    }
  }
  if (!job.plotId) {
    throw new Error("Construction finished without plotId");
  }
  settlement.buildings.push({
    id: `b-${kind}-${Date.now()}`,
    kind,
    level: targetLevel,
    workers: 0,
    plotId: job.plotId,
    plotX: job.plotX ?? 0,
    plotY: job.plotY ?? 0,
    trainingUnit: job.trainingUnit,
    luxury: job.luxury,
  });
}
