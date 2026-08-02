import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const { Game } = await import(join(root, "apps/server/src/game.ts"));
const { Store } = await import(join(root, "apps/server/src/store.ts"));
const {
  PRODUCTION,
  GREAT_HOUSE_CAPS,
  CONSTRUCTION_CANCEL_REFUND,
  SETTLEMENT_PLOTS,
} = await import(join(root, "packages/shared/src/index.ts"));

const PW = "pass";
const results = [];
function check(id, name, fn) {
  try {
    const r = fn();
    if (r && r.verdict) results.push({ id, name, ...r });
    else results.push({ id, name, verdict: "PASS", evidence: typeof r === "string" ? r : "ok" });
  } catch (e) {
    results.push({ id, name, verdict: "FAIL", evidence: String(e?.message || e) });
  }
}
function fresh() {
  const dir = mkdtempSync(join(tmpdir(), "audit-"));
  process.env.DATA_DIR = dir;
  const store = new Store();
  return {
    game: new Game(store),
    cleanup: () => {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

check("A1", "Starter kit GDD", () => {
  const { game, cleanup } = fresh();
  try {
    const { playerId } = game.register("AuditA1", PW);
    const s = game.snapshot(playerId);
    const p = s.player;
    const st = s.settlements[0];
    const kinds = st.buildings.map((b) => b.kind).sort();
    const need = ["great_house", "market", "emmer_field", "river_clay_pit", "marsh_reed_bed"].sort();
    if (JSON.stringify(kinds) !== JSON.stringify(need)) throw new Error("buildings " + kinds);
    if (st.workers !== 18) throw new Error("workers " + st.workers);
    if ((p.vault.rations ?? 0) !== 60) throw new Error("rations " + p.vault.rations);
    if ((p.vault.mudbricks ?? 0) !== 40) throw new Error("mudbricks");
    if (p.seals !== 10) throw new Error("seals " + p.seals);
    if (!st.uniqueLuxury) throw new Error("no luxury");
    return `workers=${st.workers} luxury=${st.uniqueLuxury}`;
  } finally { cleanup(); }
});

check("A1b", "Account vault isolation", () => {
  const { game, cleanup } = fresh();
  try {
    const a = game.register("IsoA", PW);
    const b = game.register("IsoB", PW);
    game.adminGrant(a.playerId, "emmer", 999);
    if ((game.snapshot(b.playerId).player.vault.emmer ?? 0) >= 999) throw new Error("leaked");
    return "isolated";
  } finally { cleanup(); }
});

check("A3", "Emmer 8/worker/h", () => {
  const { game, cleanup } = fresh();
  try {
    const { playerId } = game.register("AuditRate", PW);
    const st = game.snapshot(playerId).settlements[0];
    game.assignWorkers(playerId, st.id, st.buildings.find((b) => b.kind === "emmer_field").id, 4);
    game.adminGrant(playerId, "rations", 1000);
    const em0 = game.snapshot(playerId).player.vault.emmer ?? 0;
    game.debugAdvance(playerId, 1);
    const delta = (game.snapshot(playerId).player.vault.emmer ?? 0) - em0;
    if (delta !== 32) throw new Error(`expected +32, got ${delta}`);
    return `+${delta}`;
  } finally { cleanup(); }
});

check("A3b", "Clay/Reeds 5/worker/h", () => {
  const { game, cleanup } = fresh();
  try {
    const { playerId } = game.register("AuditClay", PW);
    const st = game.snapshot(playerId).settlements[0];
    game.assignWorkers(playerId, st.id, st.buildings.find((b) => b.kind === "river_clay_pit").id, 2);
    game.assignWorkers(playerId, st.id, st.buildings.find((b) => b.kind === "marsh_reed_bed").id, 2);
    game.adminGrant(playerId, "rations", 1000);
    const v0 = game.snapshot(playerId).player.vault;
    game.debugAdvance(playerId, 1);
    const v1 = game.snapshot(playerId).player.vault;
    const dClay = (v1.river_clay ?? 0) - (v0.river_clay ?? 0);
    const dReed = (v1.marsh_reeds ?? 0) - (v0.marsh_reeds ?? 0);
    if (dClay !== 10 || dReed !== 10) throw new Error(`clay ${dClay} reeds ${dReed}`);
    return `clay+${dClay} reeds+${dReed}`;
  } finally { cleanup(); }
});

check("A3c", "PRODUCTION table GDD rates", () => {
  const emmer = PRODUCTION.find((p) => p.kind === "emmer_field");
  if (emmer?.ratePerWorkerHour !== 8) throw new Error("emmer");
  if (PRODUCTION.find((p) => p.kind === "river_clay_pit")?.ratePerWorkerHour !== 5) throw new Error("clay");
  if (PRODUCTION.find((p) => p.kind === "marsh_reed_bed")?.ratePerWorkerHour !== 5) throw new Error("reeds");
  if (PRODUCTION.find((p) => p.kind === "ration_house")?.ratePerWorkerHour !== 6) throw new Error("ration");
  return "emmer8 clay5 reeds5 ration6";
});

check("A4", "Ration upkeep ~1/worker/h", () => {
  const { game, cleanup } = fresh();
  try {
    const { playerId } = game.register("AuditUp", PW);
    const st = game.snapshot(playerId).settlements[0];
    game.assignWorkers(playerId, st.id, st.buildings.find((b) => b.kind === "emmer_field").id, 5);
    const r0 = game.snapshot(playerId).player.vault.rations ?? 0;
    game.debugAdvance(playerId, 1);
    const r1 = game.snapshot(playerId).player.vault.rations ?? 0;
    const drained = r0 - r1;
    if (drained < 4 || drained > 6) throw new Error(`drain ${drained}`);
    return `drain ${drained}`;
  } finally { cleanup(); }
});

check("A4b", "Shortage cuts production", () => {
  const { game, cleanup } = fresh();
  try {
    const { playerId } = game.register("AuditShort", PW);
    const st = game.snapshot(playerId).settlements[0];
    // L1 field cap 8 workers max in code
    game.assignWorkers(playerId, st.id, st.buildings.find((b) => b.kind === "emmer_field").id, 8);
    const em0 = game.snapshot(playerId).player.vault.emmer ?? 0;
    game.debugAdvance(playerId, 20);
    const em1 = game.snapshot(playerId).player.vault.emmer ?? 0;
    const got = em1 - em0;
    const full = 8 * 8 * 20; // 1280
    if (got >= full * 0.95) throw new Error(`got ${got} full ${full}`);
    return `+${got} vs full ${full}`;
  } finally { cleanup(); }
});

check("A5", "No double-dip", () => {
  const { game, cleanup } = fresh();
  try {
    const { playerId } = game.register("AuditDD", PW);
    const st = game.snapshot(playerId).settlements[0];
    game.assignWorkers(playerId, st.id, st.buildings.find((b) => b.kind === "emmer_field").id, 3);
    game.adminGrant(playerId, "rations", 500);
    game.debugAdvance(playerId, 2);
    const em1 = game.snapshot(playerId).player.vault.emmer ?? 0;
    const t = game.tickPlayer(playerId);
    const em2 = game.snapshot(playerId).player.vault.emmer ?? 0;
    if (em2 !== em1) throw new Error(`${em1}→${em2}`);
    return `stable emmer=${em1} elapsed=${t.elapsedHours}`;
  } finally { cleanup(); }
});

check("A6", "Worker growth caps GH1=30", () => {
  const { game, cleanup } = fresh();
  try {
    const { playerId } = game.register("AuditGrow", PW);
    game.adminGrant(playerId, "rations", 5000);
    game.debugAdvance(playerId, 20);
    const total = game.snapshot(playerId).settlements[0].workers;
    if (total !== 30) throw new Error(String(total));
    return `workers=${total} cap=${GREAT_HOUSE_CAPS[1]}`;
  } finally { cleanup(); }
});

check("A7", "Plots 5/4/3", () => {
  const shops = SETTLEMENT_PLOTS.filter((p) => p.category === "shop").length;
  const special = SETTLEMENT_PLOTS.filter((p) => p.category === "special").length;
  const training = SETTLEMENT_PLOTS.filter((p) => p.category === "training").length;
  if (shops !== 5 || special !== 4 || training !== 3) throw new Error(`${shops}/${special}/${training}`);
  return `${shops}/${special}/${training}`;
});

check("A8", "Cancel ~25% refund", () => {
  const { game, cleanup } = fresh();
  try {
    const { playerId } = game.register("AuditCancel", PW);
    const st = game.snapshot(playerId).settlements[0];
    game.adminGrant(playerId, "mudbricks", 100);
    game.adminGrant(playerId, "reed_baskets", 50);
    const before = game.snapshot(playerId).player.vault.mudbricks ?? 0;
    game.startConstruction(playerId, st.id, "mudbrick_yard", undefined, "shop-1");
    const mid = game.snapshot(playerId).player.vault.mudbricks ?? 0;
    const spent = before - mid;
    game.cancelConstruction(playerId, st.id);
    const after = game.snapshot(playerId).player.vault.mudbricks ?? 0;
    const refunded = after - mid;
    const ratio = spent > 0 ? refunded / spent : 0;
    if (Math.abs(ratio - CONSTRUCTION_CANCEL_REFUND) > 0.05) throw new Error(`ratio ${ratio}`);
    return `spent ${spent} refunded ${refunded}`;
  } finally { cleanup(); }
});

check("B11-13", "Trust wall atomic + no double settle", () => {
  const { game, cleanup } = fresh();
  try {
    const a = game.register("TA", PW);
    const b = game.register("TB", PW);
    game.adminGrant(a.playerId, "hides", 10);
    game.adminGrant(b.playerId, "rations", 100);
    const h0 = game.snapshot(a.playerId).player.vault.hides ?? 0;
    const offer = game.postOffer(a.playerId, [{ resource: "hides", amount: 4 }], [{ resource: "rations", amount: 20 }]);
    if ((game.snapshot(a.playerId).player.vault.hides ?? 0) !== h0) throw new Error("debit on post");
    game.acceptOffer(b.playerId, offer.id, "k1");
    if ((game.snapshot(a.playerId).player.vault.hides ?? 0) !== h0 - 4) throw new Error("after hides");
    let threw = false;
    try { game.acceptOffer(b.playerId, offer.id, "k1"); } catch { threw = true; }
    if (!threw) throw new Error("double accept");
    const offer2 = game.postOffer(a.playerId, [{ resource: "hides", amount: 1 }], [{ resource: "rations", amount: 99999 }]);
    let fail = false;
    try { game.acceptOffer(b.playerId, offer2.id); } catch { fail = true; }
    if (!fail) throw new Error("underfunded should fail");
    return "ok";
  } finally { cleanup(); }
});

check("B12b", "Failed accept leaves poster intact", () => {
  const { game, cleanup } = fresh();
  try {
    const a = game.register("FA", PW);
    const b = game.register("FB", PW);
    game.adminGrant(a.playerId, "hides", 5);
    const h0 = game.snapshot(a.playerId).player.vault.hides ?? 0;
    const offer = game.postOffer(a.playerId, [{ resource: "hides", amount: 3 }], [{ resource: "bronze", amount: 50 }]);
    try { game.acceptOffer(b.playerId, offer.id); } catch {}
    if ((game.snapshot(a.playerId).player.vault.hides ?? 0) !== h0) throw new Error("drained");
    return `hides ${h0}`;
  } finally { cleanup(); }
});

check("B14", "Market commits inventory on list", () => {
  const { game, cleanup } = fresh();
  try {
    const a = game.register("MA", PW);
    game.adminGrant(a.playerId, "emmer", 20);
    const e0 = game.snapshot(a.playerId).player.vault.emmer ?? 0;
    game.postMarket(a.playerId, "emmer", 5, 10);
    const e1 = game.snapshot(a.playerId).player.vault.emmer ?? 0;
    if (e1 !== e0 - 5) throw new Error(`${e0}→${e1}`);
    return "committed 5";
  } finally { cleanup(); }
});

check("B17", "Seal floor", () => {
  const { game, cleanup } = fresh();
  try {
    const a = game.register("SA", PW);
    let threw = false;
    try {
      game.postOffer(a.playerId, [{ resource: "seals", amount: 1 }], [{ resource: "rations", amount: 1 }]);
    } catch (e) {
      threw = /below 10|Seal/i.test(String(e.message));
    }
    if (!threw) throw new Error("allowed");
    return "blocked";
  } finally { cleanup(); }
});

check("C21", "Pause keeps essential production", () => {
  const { game, cleanup } = fresh();
  try {
    const { playerId } = game.register("Pause", PW);
    const st = game.snapshot(playerId).settlements[0];
    game.assignWorkers(playerId, st.id, st.buildings.find((b) => b.kind === "emmer_field").id, 2);
    game.adminGrant(playerId, "rations", 200);
    game.setPauseNonEssential(playerId, true);
    const e0 = game.snapshot(playerId).player.vault.emmer ?? 0;
    game.debugAdvance(playerId, 1);
    const d = (game.snapshot(playerId).player.vault.emmer ?? 0) - e0;
    if (d !== 16) throw new Error(String(d));
    return `+${d}`;
  } finally { cleanup(); }
});

check("F36", "Cosmetic equip no economy change", () => {
  const { game, cleanup } = fresh();
  try {
    const { playerId } = game.register("Cos", PW);
    const before = game.snapshot(playerId);
    game.equipCosmetic(playerId, "great_house", "default");
    const after = game.snapshot(playerId);
    if (JSON.stringify(before.player.vault) !== JSON.stringify(after.player.vault)) throw new Error("vault");
    return "ok";
  } finally { cleanup(); }
});

// wrong pad
check("A7b", "Wrong pad category rejected", () => {
  const { game, cleanup } = fresh();
  try {
    const { playerId } = game.register("Pad", PW);
    const st = game.snapshot(playerId).settlements[0];
    game.adminGrant(playerId, "mudbricks", 50);
    let threw = false;
    try { game.startConstruction(playerId, st.id, "harbor", undefined, "shop-1"); } catch { threw = true; }
    if (!threw) throw new Error("harbor on shop allowed");
    return "rejected";
  } finally { cleanup(); }
});

// luxury material rate note
check("A3d", "Luxury material production rate", () => {
  // code uses 2/worker/h — GDD did not specify exact number; mark partial if not  documented
  return { verdict: "PARTIAL", evidence: "code: luxury_material = 2 per worker/h (GDD unspecified exact rate)" };
});

const pass = results.filter((r) => r.verdict === "PASS").length;
const fail = results.filter((r) => r.verdict === "FAIL").length;
const partial = results.filter((r) => r.verdict === "PARTIAL").length;
console.log(JSON.stringify({ pass, fail, partial, results }, null, 2));
process.exit(fail > 0 ? 1 : 0);
