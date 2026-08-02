import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { nanoid } from "nanoid";
import {
  BARGE_CAPACITY,
  BARGE_COST,
  BARGE_WORKER_HOURS,
  BLESSING_BONUS,
  BLESSING_HOURS,
  CONSTRUCTION_CANCEL_REFUND,
  FOUNDING_SEAL_COST,
  GREAT_HOUSE_CAPS,
  MAX_MONUMENTS,
  MAX_SETTLEMENTS,
  NEW_BUILD_COST,
  PROVINCES,
  assignFoundingSlot,
  SEAL_FLOOR,
  STARTER_MUDBRICKS,
  STARTER_RATIONS,
  STARTER_SEALS,
  STARTER_WORKERS,
  UNIT_COSTS,
  UNIT_TRAIN_HOURS,
  allowedKindsForPlot,
  buildingUpgradeCost,
  buildingWorkerCap,
  constructionHours,
  SETTLEMENT_PLOTS,
  getPlot,
  greatHouseUpgradeCost,
  hoursUntilRationEmpty,
  makeStarterBuildings,
  marketProvinceRange,
  productionOverlay,
  provinceInRange,
  sealRequiredForGh,
  suggestWorkerBalance,
  type BuildingKind,
  type LuxuryMaterial,
  type NotificationItem,
  type PublicSnapshot,
  type ResourceId,
  type ResourceStack,
  type UnitKind,
  type VaultBalances,
} from "@immortal/shared";
import { Store } from "./store.js";
import { applySettlementTick } from "./tick.js";

export type GameEvent =
  | { type: "chat"; playerId?: string; payload: unknown }
  | { type: "trade"; playerIds: string[]; payload: unknown }
  | { type: "tick"; playerId: string; payload: unknown }
  | { type: "barge"; playerIds: string[]; payload: unknown }
  | { type: "notify"; playerId: string; payload: NotificationItem };

function defaultPrefs() {
  return {
    preferredPartners: [] as string[],
    mutedPlayerIds: [] as string[],
    notify: {
      construction: true,
      barge: true,
      trade: true,
      blessing: true,
      envoy: true,
      email: false,
      push: true,
    },
    defaultChatChannel: "province" as const,
  };
}

function defaultTutorial() {
  return {
    completed: false,
    step: 0,
    dismissedGoals: false,
    goals: {
      mudbrickYard: false,
      rationHouse: false,
      assignWorkers: false,
      luxuryLesson: false,
      firstTrade: false,
      seeGhUpgrade: false,
    },
  };
}

function hashPassword(password: string, salt?: string): string {
  const s = salt ?? randomBytes(16).toString("hex");
  const h = createHash("sha256").update(`${s}:${password}`).digest("hex");
  return `${s}$${h}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const next = hashPassword(password, salt);
  const a = Buffer.from(next);
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function emptyVault(): VaultBalances {
  return {};
}

function credit(vault: VaultBalances, resource: ResourceId, amount: number) {
  vault[resource] = (vault[resource] ?? 0) + amount;
}

function debit(
  vault: VaultBalances,
  resource: ResourceId,
  amount: number
): boolean {
  const have = vault[resource] ?? 0;
  if (have < amount) return false;
  vault[resource] = have - amount;
  return true;
}

function canAfford(vault: VaultBalances, cost: ResourceStack[]): boolean {
  return cost.every((c) => (vault[c.resource] ?? 0) >= c.amount);
}

function pay(vault: VaultBalances, cost: ResourceStack[]): boolean {
  if (!canAfford(vault, cost)) return false;
  for (const c of cost) debit(vault, c.resource, c.amount);
  return true;
}

function refundPartial(vault: VaultBalances, cost: ResourceStack[], rate: number) {
  for (const c of cost) {
    credit(vault, c.resource, Math.floor(c.amount * rate));
  }
}

export class Game {
  store: Store;
  sessions = new Map<string, string>(); // token -> playerId
  private listeners = new Set<(ev: GameEvent) => void>();

  constructor(store = new Store()) {
    this.store = store;
  }

  onEvent(fn: (ev: GameEvent) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(ev: GameEvent) {
    for (const fn of this.listeners) {
      try {
        fn(ev);
      } catch {
        /* ignore fanout errors */
      }
    }
  }

  private notify(
    playerId: string,
    kind: NotificationItem["kind"],
    title: string,
    body: string
  ) {
    const player = this.store.world.players[playerId];
    if (!player) return;
    const prefs = player.prefs ?? defaultPrefs();
    const map: Record<string, boolean> = {
      construction: prefs.notify.construction,
      barge: prefs.notify.barge,
      trade: prefs.notify.trade,
      blessing: prefs.notify.blessing,
      envoy: prefs.notify.envoy,
      system: true,
    };
    if (!map[kind]) return;
    const item: NotificationItem = {
      id: nanoid(),
      playerId,
      kind,
      title,
      body,
      ts: Date.now(),
      read: false,
    };
    this.store.world.notifications.push(item);
    if (this.store.world.notifications.length > 2000) {
      this.store.world.notifications = this.store.world.notifications.slice(-1500);
    }
    this.emit({ type: "notify", playerId, payload: item });
    this.store.mark();
  }

  private ensurePlayerDefaults(playerId: string) {
    const p = this.store.world.players[playerId];
    if (!p) return;
    if (!p.prefs) p.prefs = defaultPrefs();
    if (!p.tutorial) p.tutorial = defaultTutorial();
    if (!p.offerTemplates) p.offerTemplates = [];
    if (!p.tradeHistory) p.tradeHistory = [];
    if (!p.cosmeticsOwned) p.cosmeticsOwned = ["default"];
    if (!p.cosmeticsEquipped) p.cosmeticsEquipped = { great_house: "default" };
    if (!p.legacyAscensions) p.legacyAscensions = [];
  }

  private recordTrade(
    aId: string,
    bId: string,
    kind: "market" | "wall" | "gift" | "barge",
    summary: string
  ) {
    const a = this.store.world.players[aId];
    const b = this.store.world.players[bId];
    if (!a || !b) return;
    this.ensurePlayerDefaults(aId);
    this.ensurePlayerDefaults(bId);
    const rowA = {
      id: nanoid(),
      withPlayerId: bId,
      withName: b.name,
      kind,
      success: true,
      ts: Date.now(),
      summary,
    };
    const rowB = {
      id: nanoid(),
      withPlayerId: aId,
      withName: a.name,
      kind,
      success: true,
      ts: Date.now(),
      summary,
    };
    a.tradeHistory!.push(rowA);
    b.tradeHistory!.push(rowB);
    a.tradeHistory = a.tradeHistory!.slice(-100);
    b.tradeHistory = b.tradeHistory!.slice(-100);
  }

  private log(
    playerId: string,
    resource: ResourceId,
    delta: number,
    reason: string,
    refType?: string,
    refId?: string
  ) {
    const p = this.store.world.players[playerId];
    const balanceAfter =
      resource === "seals" ? p.seals : p.vault[resource] ?? 0;
    this.store.world.ledger.push({
      id: nanoid(),
      ts: Date.now(),
      playerId,
      resource,
      delta,
      reason: reason as never,
      refType,
      refId,
      balanceAfter,
    });
    // keep ledger bounded
    if (this.store.world.ledger.length > 5000) {
      this.store.world.ledger = this.store.world.ledger.slice(-4000);
    }
  }

  register(name: string, password: string): { token: string; playerId: string } {
    name = name.trim().slice(0, 24);
    if (name.length < 2) throw new Error("Name too short");
    if (password.length < 3) throw new Error("Password too short");
    const exists = Object.values(this.store.world.players).find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) throw new Error("Name taken");

    const id = nanoid(10);
    // Balanced multiplayer founding: least-used province + luxury, map archetype ready
    const existing = Object.values(this.store.world.settlements).map((s) => ({
      provinceId: s.provinceId,
      uniqueLuxury: s.uniqueLuxury,
    }));
    const openFounding = this.store.world.sites.find(
      (s) => s.kind === "founding" && !s.ownerPlayerId
    );
    const slot = assignFoundingSlot({
      existingSettlements: existing,
      preferredProvinceId: openFounding?.provinceId,
    });
    const founding =
      this.store.world.sites.find(
        (s) =>
          s.kind === "founding" &&
          s.provinceId === slot.provinceId &&
          !s.ownerPlayerId
      ) ?? openFounding;

    const settlementId = nanoid(10);
    const mapX = founding?.mapX ?? slot.mapX;
    const mapY = founding?.mapY ?? slot.mapY;

    const vault = emptyVault();
    credit(vault, "rations", STARTER_RATIONS);
    credit(vault, "mudbricks", STARTER_MUDBRICKS);

    const now = Date.now();
    // Starter: GH, Market, Emmer, Clay, Reeds only. Unique luxury specialty is
    // assigned but its production building must be placed on the Special pad.
    // Shop / special / training pads start empty — multiplayer trade is required
    // for other luxuries (you can never produce them on this shore).
    const starter = makeStarterBuildings(() => nanoid(8));
    const settlement = {
      id: settlementId,
      playerId: id,
      name: `${name}'s Shore`,
      provinceId: slot.provinceId,
      mapArchetypeId: slot.mapArchetypeId,
      mapX,
      mapY,
      greatHouseLevel: 1,
      workers: STARTER_WORKERS,
      workersAssigned: 0,
      buildings: starter,
      construction: null,
      units: [],
      barges: [],
      monuments: [],
      uniqueLuxury: slot.uniqueLuxury,
      prestige: 0,
      lastTickAt: now,
      createdAt: now,
    };

    // place city site
    this.store.world.sites.push({
      id: `city-${settlementId}`,
      kind: "city",
      provinceId: slot.provinceId,
      name: settlement.name,
      mapX,
      mapY,
      ownerPlayerId: id,
    });
    if (founding) founding.ownerPlayerId = id;

    this.store.world.players[id] = {
      id,
      name,
      passwordHash: hashPassword(password),
      vault,
      seals: STARTER_SEALS,
      settlementIds: [settlementId],
      allies: [],
      prestige: 0,
      ascended: false,
      createdAt: now,
      lastSeenAt: now,
      prefs: defaultPrefs(),
      tutorial: defaultTutorial(),
      offerTemplates: [],
      tradeHistory: [],
      cosmeticsOwned: ["default", "banner_papyrus"],
      cosmeticsEquipped: { great_house: "default", banner: "banner_papyrus" },
      pauseNonEssential: false,
      legacyAscensions: [],
    };
    this.store.world.settlements[settlementId] = settlement;
    this.log(id, "rations", STARTER_RATIONS, "starter");
    this.log(id, "mudbricks", STARTER_MUDBRICKS, "starter");
    this.log(id, "seals", STARTER_SEALS, "starter");
    this.store.mark();

    const token = nanoid(24);
    this.sessions.set(token, id);
    return { token, playerId: id };
  }

  login(name: string, password: string): { token: string; playerId: string } {
    const player = Object.values(this.store.world.players).find(
      (p) => p.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (!player || !verifyPassword(password, player.passwordHash)) {
      throw new Error("Invalid credentials");
    }
    if (player.ascended) throw new Error("This name has Ascended");
    const token = nanoid(24);
    this.sessions.set(token, player.id);
    return { token, playerId: player.id };
  }

  playerIdFromToken(token: string | undefined): string | null {
    if (!token) return null;
    return this.sessions.get(token) ?? null;
  }

  tickPlayer(playerId: string) {
    const player = this.store.world.players[playerId];
    if (!player) throw new Error("Unknown player");
    this.ensurePlayerDefaults(playerId);
    const now = Date.now();
    player.lastSeenAt = now;
    const summaries = [];
    for (const sid of player.settlementIds) {
      const s = this.store.world.settlements[sid];
      if (!s) continue;
      const hadConstruction = !!s.construction;
      const bless = this.store.world.blessings[s.provinceId];
      const hasShrine = s.buildings.some((b) => b.kind === "shrine");
      const bMult =
        bless && bless.endsAt > now && hasShrine ? 1 + BLESSING_BONUS : 1;
      const summary = applySettlementTick(
        s,
        player.vault,
        now,
        bMult,
        !!player.pauseNonEssential
      );
      summaries.push(summary);
      for (const p of summary.produced) {
        this.log(playerId, p.resource, p.amount, "tick_production", "settlement", sid);
      }
      for (const c of summary.consumed) {
        this.log(playerId, c.resource, -c.amount, "upkeep", "settlement", sid);
      }
      if (hadConstruction && !s.construction) {
        this.notify(
          playerId,
          "construction",
          "Construction finished",
          "A building job completed on your shore."
        );
        this.refreshTutorialGoals(playerId);
      }
    }
    this.resolveBargeArrivals(now);
    this.emit({ type: "tick", playerId, payload: summaries[0] });
    this.store.mark();
    return summaries[0];
  }

  private resolveBargeArrivals(now: number) {
    for (const s of Object.values(this.store.world.settlements)) {
      for (const b of s.barges) {
        if (b.status === "in_transit" && b.arriveAt <= now) {
          b.status = "arrived";
          const dest =
            this.store.world.settlements[b.toSettlementId as string];
          const ownerId = dest?.playerId ?? s.playerId;
          const owner = this.store.world.players[ownerId];
          if (owner) {
            for (const c of b.cargo) {
              credit(owner.vault, c.resource, c.amount);
              this.log(ownerId, c.resource, c.amount, "barge_arrive", "barge", b.id);
            }
            this.notify(ownerId, "barge", "Barge arrived", "Cargo delivered to a shore.");
            this.emit({
              type: "barge",
              playerIds: [ownerId, s.playerId],
              payload: { bargeId: b.id, status: "arrived" },
            });
          }
          b.cargo = [];
        }
      }
    }
  }

  snapshot(playerId: string): PublicSnapshot {
    this.ensurePlayerDefaults(playerId);
    const tickSummary = this.tickPlayer(playerId);
    const player = this.store.world.players[playerId]!;
    const settlements = player.settlementIds
      .map((id) => this.store.world.settlements[id])
      .filter(Boolean) as import("@immortal/shared").SettlementState[];
    const primary = settlements[0];

    const mail = this.store.world.mail
      .filter((m) => m.toId === playerId || m.fromId === playerId)
      .slice(-100);
    const muted = new Set(player.prefs?.mutedPlayerIds ?? []);
    const chat = this.store.world.chat
      .filter((c) => !muted.has(c.fromId))
      .slice(-100);

    // Market range by Market building level + province river distance
    let marketLevel = 1;
    if (primary) {
      const mkt = primary.buildings.find((b) => b.kind === "market");
      marketLevel = mkt?.level ?? 1;
    }
    const range = marketProvinceRange(marketLevel);
    const myProv = PROVINCES.find((p) => p.id === primary?.provinceId);
    const myRiver = myProv?.riverIndex ?? 0;
    const market = this.store.world.market.filter((o) => {
      if (o.expiresAt <= Date.now()) return false;
      if (o.sellerId === playerId) return true;
      const orderProv = PROVINCES.find((p) => p.id === o.provinceId);
      return provinceInRange(myRiver, orderProv?.riverIndex ?? 0, range);
    });

    const offers = this.store.world.offers.filter(
      (o) =>
        o.state === "posted" ||
        o.posterId === playerId ||
        o.counterpartyId === playerId
    );

    const production = primary
      ? productionOverlay(primary, !!player.pauseNonEssential)
      : [];
    const rationHours = primary
      ? hoursUntilRationEmpty(player.vault, primary, !!player.pauseNonEssential)
      : null;

    const notifications = this.store.world.notifications
      .filter((n) => n.playerId === playerId)
      .slice(-40);

    const circles = this.store.world.circles.filter((c) =>
      c.memberIds.includes(playerId)
    );

    // Reputation from trade history
    const repMap = new Map<string, { playerId: string; name: string; successCount: number }>();
    for (const row of player.tradeHistory ?? []) {
      if (!row.success) continue;
      const cur = repMap.get(row.withPlayerId) ?? {
        playerId: row.withPlayerId,
        name: row.withName,
        successCount: 0,
      };
      cur.successCount += 1;
      repMap.set(row.withPlayerId, cur);
    }
    const reputation = [...repMap.values()].sort(
      (a, b) => b.successCount - a.successCount
    );

    return {
      player: {
        id: player.id,
        name: player.name,
        email: player.email,
        seals: player.seals,
        prestige: player.prestige,
        vault: { ...player.vault },
        prefs: player.prefs,
        tutorial: player.tutorial,
        offerTemplates: player.offerTemplates,
        tradeHistory: player.tradeHistory?.slice(-30),
        cosmeticsOwned: player.cosmeticsOwned,
        cosmeticsEquipped: player.cosmeticsEquipped,
        pauseNonEssential: player.pauseNonEssential,
        totpEnabled: !!player.totpEnabled,
        legacyAscensions: player.legacyAscensions,
      },
      settlements: structuredClone(settlements),
      mail: structuredClone(mail),
      chat: structuredClone(chat),
      market: structuredClone(market),
      offers: structuredClone(offers),
      map: {
        provinces: PROVINCES,
        sites: this.store.world.sites.map((s) => ({ ...s })),
      },
      serverTime: Date.now(),
      tickSummary,
      production,
      hoursUntilRationEmpty: rationHours,
      notifications: structuredClone(notifications),
      circles: structuredClone(circles),
      seasonal: this.store.world.seasonal
        ? structuredClone(this.store.world.seasonal)
        : null,
      reputation,
    };
  }

  assignWorkers(
    playerId: string,
    settlementId: string,
    buildingId: string,
    workers: number
  ) {
    this.tickPlayer(playerId);
    const s = this.requireOwnedSettlement(playerId, settlementId);
    const b = s.buildings.find((x) => x.id === buildingId);
    if (!b) throw new Error("Building not found");
    const cap = buildingWorkerCap(b.kind, b.level);
    if (workers < 0 || workers > cap) throw new Error(`Workers must be 0–${cap}`);
    const others = s.buildings
      .filter((x) => x.id !== buildingId)
      .reduce((n, x) => n + x.workers, 0);
    if (others + workers > s.workers) {
      throw new Error("Not enough Workers in settlement");
    }
    b.workers = workers;
    s.workersAssigned = s.buildings.reduce((n, x) => n + x.workers, 0);
    if (workers > 0) this.markTutorialGoal(playerId, "assignWorkers");
    this.store.mark();
  }

  startConstruction(
    playerId: string,
    settlementId: string,
    kind: BuildingKind,
    buildingId?: string,
    plotId?: string
  ) {
    this.tickPlayer(playerId);
    const player = this.store.world.players[playerId]!;
    const s = this.requireOwnedSettlement(playerId, settlementId);
    if (s.construction) throw new Error("Construction already in progress");

    let targetLevel = 1;
    let cost: ResourceStack[] = [];
    let sealCost = 0;
    let buildKind = kind;
    let jobPlotId: string | undefined;
    let trainingUnit: UnitKind | undefined;
    let luxury: LuxuryMaterial | undefined;

    if (
      kind === "great_house" ||
      (buildingId &&
        s.buildings.find((x) => x.id === buildingId)?.kind === "great_house")
    ) {
      buildKind = "great_house";
      targetLevel = s.greatHouseLevel + 1;
      if (targetLevel > 22) throw new Error("Great House is max level");
      cost = greatHouseUpgradeCost(targetLevel);
      sealCost = sealRequiredForGh(targetLevel);
    } else if (buildingId) {
      const b = s.buildings.find((x) => x.id === buildingId);
      if (!b) throw new Error("Building not found");
      buildKind = b.kind;
      targetLevel = b.level + 1;
      cost = buildingUpgradeCost(b.kind, targetLevel);
    } else {
      // New building on a typed empty pad
      if (!plotId) throw new Error("Choose an empty pad to build on");
      const plot = getPlot(plotId);
      if (!plot) throw new Error("Unknown plot");
      if (s.buildings.some((b) => b.plotId === plotId)) {
        throw new Error("That pad is already occupied");
      }
      const existingKinds = s.buildings.map((b) => b.kind);
      const allowed = allowedKindsForPlot(plotId, existingKinds);
      if (!allowed.includes(kind)) {
        throw new Error(
          `Cannot place ${kind} on this pad (${plot.label}). Allowed: ${allowed.join(", ") || "none"}`
        );
      }
      // One of each non-training kind
      if (
        kind !== "training_grounds" &&
        s.buildings.some((b) => b.kind === kind)
      ) {
        throw new Error("You already have that building — upgrade it instead");
      }
      // One training grounds per training plot (already enforced by pad occupancy)
      cost = (NEW_BUILD_COST[kind] as ResourceStack[] | undefined) ?? [
        { resource: "mudbricks", amount: 20 },
      ];
      jobPlotId = plotId;
      trainingUnit = plot.trainingUnit;
      if (kind === "luxury_material") {
        luxury = s.uniqueLuxury;
      }
      if (kind === "mudbrick_yard") this.markTutorialGoal(playerId, "mudbrickYard");
      if (kind === "ration_house") this.markTutorialGoal(playerId, "rationHouse");
      if (kind === "luxury_material") this.markTutorialGoal(playerId, "luxuryLesson");
    }

    if (sealCost > 0 && player.seals < sealCost) {
      throw new Error("Not enough Seals");
    }
    if (!pay(player.vault, cost)) throw new Error("Cannot afford construction");
    if (sealCost > 0) {
      player.seals -= sealCost;
      this.log(playerId, "seals", -sealCost, "construction", "gh", String(targetLevel));
    }
    for (const c of cost) {
      this.log(playerId, c.resource, -c.amount, "construction", "build", buildKind);
    }

    const plotIdx = jobPlotId
      ? SETTLEMENT_PLOTS.findIndex((p) => p.id === jobPlotId)
      : -1;
    s.construction = {
      buildingId: buildingId ?? null,
      kind: buildKind,
      targetLevel,
      cost,
      workerHoursRequired: constructionHours(buildKind, targetLevel),
      workerHoursDone: 0,
      startedAt: Date.now(),
      plotId: jobPlotId,
      plotX: plotIdx >= 0 ? plotIdx : undefined,
      plotY: 0,
      trainingUnit,
      luxury,
    };
    this.store.mark();
  }

  cancelConstruction(playerId: string, settlementId: string) {
    this.tickPlayer(playerId);
    const player = this.store.world.players[playerId]!;
    const s = this.requireOwnedSettlement(playerId, settlementId);
    if (!s.construction) throw new Error("No construction");
    refundPartial(player.vault, s.construction.cost, CONSTRUCTION_CANCEL_REFUND);
    for (const c of s.construction.cost) {
      this.log(
        playerId,
        c.resource,
        Math.floor(c.amount * CONSTRUCTION_CANCEL_REFUND),
        "construction_refund"
      );
    }
    s.construction = null;
    this.store.mark();
  }

  // --- Market ---
  postMarket(
    playerId: string,
    resource: ResourceId,
    amount: number,
    priceRations: number,
    provinceId: string
  ) {
    this.tickPlayer(playerId);
    const player = this.store.world.players[playerId]!;
    if (amount <= 0 || priceRations <= 0) throw new Error("Invalid order");
    if (resource === "seals") throw new Error("Use gifts or Wall for Seals");
    // Market listing: goods leave vault when listed (seller commits inventory to sale)
    if (!debit(player.vault, resource, amount)) throw new Error("Insufficient goods");
    this.log(playerId, resource, -amount, "market", "list");
    const order = {
      id: nanoid(),
      sellerId: playerId,
      resource,
      amount,
      priceRations,
      provinceId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 86400_000,
    };
    this.store.world.market.push(order);
    this.store.mark();
    return order;
  }

  acceptMarket(playerId: string, orderId: string) {
    this.tickPlayer(playerId);
    const buyer = this.store.world.players[playerId]!;
    const idx = this.store.world.market.findIndex((o) => o.id === orderId);
    if (idx < 0) throw new Error("Order not found");
    const order = this.store.world.market[idx]!;
    if (order.sellerId === playerId) throw new Error("Cannot buy own order");
    // Range check
    const buyerSettlements = buyer.settlementIds
      .map((id) => this.store.world.settlements[id])
      .filter(Boolean);
    const primary = buyerSettlements[0];
    if (primary) {
      const mkt = primary.buildings.find((b) => b.kind === "market");
      const range = marketProvinceRange(mkt?.level ?? 1);
      const myRiver =
        PROVINCES.find((p) => p.id === primary.provinceId)?.riverIndex ?? 0;
      const orderRiver =
        PROVINCES.find((p) => p.id === order.provinceId)?.riverIndex ?? 0;
      if (!provinceInRange(myRiver, orderRiver, range)) {
        throw new Error("Order outside your Market province range");
      }
    }
    // Atomic take: buyer pays Rations immediately
    if (!debit(buyer.vault, "rations", order.priceRations)) {
      throw new Error("Not enough Rations");
    }
    const seller = this.store.world.players[order.sellerId];
    if (!seller) throw new Error("Seller gone");
    credit(buyer.vault, order.resource, order.amount);
    credit(seller.vault, "rations", order.priceRations);
    this.log(playerId, "rations", -order.priceRations, "market", "buy", orderId);
    this.log(playerId, order.resource, order.amount, "market", "buy", orderId);
    this.log(order.sellerId, "rations", order.priceRations, "market", "sell", orderId);
    this.store.world.market.splice(idx, 1);
    this.recordTrade(
      playerId,
      order.sellerId,
      "market",
      `${order.amount} ${order.resource} @ ${order.priceRations} rations`
    );
    this.notify(order.sellerId, "trade", "Market sale", `Sold ${order.amount} ${order.resource}`);
    this.emit({
      type: "trade",
      playerIds: [playerId, order.sellerId],
      payload: { kind: "market", orderId },
    });
    this.store.mark();
  }

  /**
   * Trust-based Tablet Wall offer — NO vault lock / escrow hold.
   * Poster promises give[]; accepter must be able to pay want[] at accept time.
   * Atomic swap only when accepter takes the offer.
   */
  postOffer(
    playerId: string,
    give: ResourceStack[],
    want: ResourceStack[],
    channel: "trade" | "province" | "private" | "circle" = "trade",
    circleId?: string
  ) {
    this.tickPlayer(playerId);
    const player = this.store.world.players[playerId]!;
    this.assertSealFloor(player, give);
    // Soft check only — do not debit (trust model)
    for (const g of give) {
      if (g.resource === "seals") {
        if (player.seals < g.amount) throw new Error("Not enough Seals to promise");
      } else if ((player.vault[g.resource] ?? 0) < g.amount) {
        throw new Error(`Not enough ${g.resource} to promise (trust listing)`);
      }
    }
    const settlement = this.store.world.settlements[player.settlementIds[0]!];
    const offer = {
      id: nanoid(),
      posterId: playerId,
      give,
      want,
      state: "posted" as const,
      channel,
      provinceId: settlement?.provinceId,
      circleId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3 * 86400_000,
    };
    this.store.world.offers.push(offer);
    this.store.world.chat.push({
      id: nanoid(),
      channel: channel === "circle" ? "trade" : channel === "private" ? "trade" : channel,
      provinceId: settlement?.provinceId,
      fromId: playerId,
      fromName: player.name,
      text: `Trust offer ${offer.id.slice(0, 6)}: give ${fmtStacks(give)} for ${fmtStacks(want)}`,
      offerId: offer.id,
      createdAt: Date.now(),
    });
    this.emit({ type: "chat", payload: { offerId: offer.id } });
    this.store.mark();
    return offer;
  }

  acceptOffer(playerId: string, offerId: string, acceptKey?: string) {
    this.tickPlayer(playerId);
    const acceptor = this.store.world.players[playerId]!;
    const offer = this.store.world.offers.find((o) => o.id === offerId);
    if (!offer || offer.state !== "posted") throw new Error("Offer not available");
    if (offer.posterId === playerId) throw new Error("Cannot accept own offer");
    if (offer.acceptKey && offer.acceptKey !== acceptKey) {
      throw new Error("Idempotent accept key mismatch");
    }
    const poster = this.store.world.players[offer.posterId];
    if (!poster) throw new Error("Poster gone");

    // Atomic: both sides must hold goods NOW (trust — no prior escrow lock)
    this.assertSealFloor(acceptor, offer.want);
    this.assertSealFloor(poster, offer.give);
    for (const g of offer.give) {
      if (g.resource === "seals") {
        if (poster.seals < g.amount) throw new Error("Poster no longer has promised Seals");
      } else if ((poster.vault[g.resource] ?? 0) < g.amount) {
        throw new Error("Poster no longer has promised goods (trust failed)");
      }
    }
    for (const w of offer.want) {
      if (w.resource === "seals") {
        if (acceptor.seals < w.amount) throw new Error("Not enough Seals");
      } else if ((acceptor.vault[w.resource] ?? 0) < w.amount) {
        throw new Error(`Not enough ${w.resource}`);
      }
    }

    // Swap
    for (const g of offer.give) {
      if (g.resource === "seals") {
        poster.seals -= g.amount;
        acceptor.seals += g.amount;
        this.log(poster.id, "seals", -g.amount, "trade_accept", "wall", offerId);
        this.log(acceptor.id, "seals", g.amount, "trade_accept", "wall", offerId);
      } else {
        debit(poster.vault, g.resource, g.amount);
        credit(acceptor.vault, g.resource, g.amount);
        this.log(poster.id, g.resource, -g.amount, "trade_accept", "wall", offerId);
        this.log(acceptor.id, g.resource, g.amount, "trade_accept", "wall", offerId);
      }
    }
    for (const w of offer.want) {
      if (w.resource === "seals") {
        acceptor.seals -= w.amount;
        poster.seals += w.amount;
        this.log(acceptor.id, "seals", -w.amount, "trade_accept", "wall", offerId);
        this.log(poster.id, "seals", w.amount, "trade_accept", "wall", offerId);
      } else {
        debit(acceptor.vault, w.resource, w.amount);
        credit(poster.vault, w.resource, w.amount);
        this.log(acceptor.id, w.resource, -w.amount, "trade_accept", "wall", offerId);
        this.log(poster.id, w.resource, w.amount, "trade_accept", "wall", offerId);
      }
    }

    offer.state = "completed";
    offer.counterpartyId = playerId;
    offer.acceptKey = acceptKey ?? nanoid();
    this.recordTrade(
      playerId,
      poster.id,
      "wall",
      `${fmtStacks(offer.give)} ↔ ${fmtStacks(offer.want)}`
    );
    this.notify(poster.id, "trade", "Wall trade completed", `Your offer was accepted by ${acceptor.name}`);
    this.emit({
      type: "trade",
      playerIds: [playerId, poster.id],
      payload: { kind: "wall", offerId },
    });
    // Tutorial goal
    this.markTutorialGoal(playerId, "firstTrade");
    this.markTutorialGoal(poster.id, "firstTrade");
    this.store.mark();
  }

  private assertSealFloor(
    player: { seals: number },
    stacks: ResourceStack[]
  ) {
    const sealOut = stacks
      .filter((s) => s.resource === "seals")
      .reduce((n, s) => n + s.amount, 0);
    if (sealOut > 0 && player.seals - sealOut < SEAL_FLOOR) {
      throw new Error(`Cannot go below ${SEAL_FLOOR} Sacred Seals`);
    }
  }

  // --- Gifts / mail ---
  sendGift(
    playerId: string,
    toName: string,
    attachments: ResourceStack[],
    subject: string,
    body: string
  ) {
    this.tickPlayer(playerId);
    const from = this.store.world.players[playerId]!;
    const to = Object.values(this.store.world.players).find(
      (p) => p.name.toLowerCase() === toName.trim().toLowerCase()
    );
    if (!to) throw new Error("Recipient not found");
    this.assertSealFloor(from, attachments);
    for (const a of attachments) {
      if (a.resource === "seals") {
        if (from.seals < a.amount) throw new Error("Not enough Seals");
        from.seals -= a.amount;
        this.log(playerId, "seals", -a.amount, "gift");
      } else {
        if (!debit(from.vault, a.resource, a.amount)) {
          throw new Error(`Not enough ${a.resource}`);
        }
        this.log(playerId, a.resource, -a.amount, "gift");
      }
    }
    const mail = {
      id: nanoid(),
      fromId: playerId,
      toId: to.id,
      kind: "gift" as const,
      subject: subject || "A gift along the river",
      body: body || "",
      attachments,
      read: false,
      createdAt: Date.now(),
    };
    this.store.world.mail.push(mail);
    this.store.mark();
    return mail;
  }

  acceptMail(playerId: string, mailId: string) {
    this.tickPlayer(playerId);
    const player = this.store.world.players[playerId]!;
    const mail = this.store.world.mail.find((m) => m.id === mailId);
    if (!mail || mail.toId !== playerId) throw new Error("Mail not found");
    if (mail.acceptedAt) throw new Error("Already accepted");
    for (const a of mail.attachments) {
      if (a.resource === "seals") {
        player.seals += a.amount;
        this.log(playerId, "seals", a.amount, "gift");
      } else {
        credit(player.vault, a.resource, a.amount);
        this.log(playerId, a.resource, a.amount, "gift");
      }
    }
    mail.acceptedAt = Date.now();
    mail.read = true;
    this.store.mark();
  }

  // --- Chat ---
  chat(
    playerId: string,
    channel: "general" | "trade" | "province" | "private",
    text: string,
    offerId?: string
  ) {
    const player = this.store.world.players[playerId]!;
    text = text.trim().slice(0, 800);
    if (!text) throw new Error("Empty message");
    // free text never executes transfers
    const settlement = this.store.world.settlements[player.settlementIds[0]!];
    const msg = {
      id: nanoid(),
      channel,
      provinceId: settlement?.provinceId,
      fromId: playerId,
      fromName: player.name,
      text,
      offerId,
      createdAt: Date.now(),
    };
    this.store.world.chat.push(msg);
    if (this.store.world.chat.length > 500) {
      this.store.world.chat = this.store.world.chat.slice(-400);
    }
    this.emit({ type: "chat", payload: msg });
    this.store.mark();
    return msg;
  }

  // --- Barges ---
  buildBarge(playerId: string, settlementId: string) {
    this.tickPlayer(playerId);
    const player = this.store.world.players[playerId]!;
    const s = this.requireOwnedSettlement(playerId, settlementId);
    if (!s.buildings.some((b) => b.kind === "harbor")) {
      throw new Error("Build a Harbor first");
    }
    if (!pay(player.vault, BARGE_COST)) throw new Error("Cannot afford barge");
    for (const c of BARGE_COST) {
      this.log(playerId, c.resource, -c.amount, "barge_depart", "build");
    }
    const barge = {
      id: nanoid(),
      fromSettlementId: settlementId,
      toSettlementId: settlementId,
      cargo: [] as ResourceStack[],
      departAt: 0,
      arriveAt: 0,
      capacity: BARGE_CAPACITY,
      status: "building" as const,
      workerHoursRequired: BARGE_WORKER_HOURS,
      workerHoursDone: 0,
    };
    s.barges.push(barge);
    this.store.mark();
    return barge;
  }

  launchBarge(
    playerId: string,
    settlementId: string,
    bargeId: string,
    toSettlementId: string,
    cargo: ResourceStack[]
  ) {
    this.tickPlayer(playerId);
    const player = this.store.world.players[playerId]!;
    const s = this.requireOwnedSettlement(playerId, settlementId);
    const barge = s.barges.find((b) => b.id === bargeId);
    if (!barge || barge.status !== "docked") throw new Error("Barge not ready");
    const total = cargo.reduce((n, c) => n + c.amount, 0);
    if (total > barge.capacity) throw new Error("Over capacity");
    for (const c of cargo) {
      if (!debit(player.vault, c.resource, c.amount)) {
        throw new Error(`Not enough ${c.resource}`);
      }
      this.log(playerId, c.resource, -c.amount, "barge_depart", "barge", bargeId);
    }
    const dest = this.store.world.settlements[toSettlementId];
    if (!dest) throw new Error("Destination unknown");
    const dist = Math.hypot(dest.mapX - s.mapX, dest.mapY - s.mapY);
    const hours = Math.max(0.5, dist / 40); // map units → hours
    barge.cargo = cargo;
    barge.toSettlementId = toSettlementId;
    barge.departAt = Date.now();
    barge.arriveAt = Date.now() + hours * 3_600_000;
    barge.status = "in_transit";
    // fleet risk 11+
    if (s.barges.filter((b) => b.status !== "building").length >= 11) {
      if (Math.random() < 0.08) {
        // partial loss
        barge.cargo = barge.cargo.map((c) => ({
          ...c,
          amount: Math.floor(c.amount * 0.7),
        }));
        this.log(playerId, "rations", 0, "barge_loss", "barge", bargeId);
      }
    }
    this.emit({
      type: "barge",
      playerIds: [playerId, dest.playerId],
      payload: {
        bargeId,
        departAt: barge.departAt,
        arriveAt: barge.arriveAt,
        etaHours: hours,
      },
    });
    this.store.mark();
    return barge;
  }

  // --- Military / monuments ---
  trainUnit(playerId: string, settlementId: string, kind: UnitKind, count = 1) {
    this.tickPlayer(playerId);
    const player = this.store.world.players[playerId]!;
    const s = this.requireOwnedSettlement(playerId, settlementId);
    const barracks = s.buildings.find(
      (b) => b.kind === "training_grounds" && b.trainingUnit === kind
    );
    if (!barracks) {
      throw new Error(`Build the ${kind.replace(/_/g, " ")} Training Grounds first`);
    }
    const def = UNIT_COSTS[kind];
    for (let i = 0; i < count; i++) {
      if (!pay(player.vault, def.cost)) throw new Error("Cannot afford units");
      for (const c of def.cost) {
        this.log(playerId, c.resource, -c.amount, "military", kind);
      }
    }
    // instant train for V1 (worker-hours abstracted as cost paid)
    const stack = s.units.find((u) => u.kind === kind);
    if (stack) stack.count += count;
    else s.units.push({ kind, count });
    void UNIT_TRAIN_HOURS;
    this.store.mark();
  }

  captureMonument(playerId: string, settlementId: string, siteId: string) {
    this.tickPlayer(playerId);
    const s = this.requireOwnedSettlement(playerId, settlementId);
    if (s.monuments.length >= MAX_MONUMENTS) {
      throw new Error("Already hold max monuments");
    }
    const site = this.store.world.sites.find((x) => x.id === siteId);
    if (!site || site.kind !== "monument") throw new Error("Not a monument site");
    if (site.ownerPlayerId) throw new Error("Already held");
    const force = site.banditForce ?? 10;
    const power = s.units.reduce((n, u) => {
      const w = u.kind === "chariot_warriors" ? 3 : u.kind === "spearmen" ? 2 : 1;
      return n + u.count * w;
    }, 0);
    if (power < force) throw new Error(`Need combat power ≥ ${force} (have ${power})`);
    // lose some units
    let loss = Math.ceil(force / 4);
    for (const u of s.units) {
      const take = Math.min(u.count, loss);
      u.count -= take;
      loss -= take;
    }
    s.units = s.units.filter((u) => u.count > 0);
    site.ownerPlayerId = playerId;
    s.monuments.push({
      siteId,
      level: 1,
      workers: 0,
      limestone: 0,
      capturedAt: Date.now(),
    });
    this.store.world.players[playerId]!.prestige += 10;
    this.store.mark();
  }

  assignMonumentWorkers(
    playerId: string,
    settlementId: string,
    siteId: string,
    workers: number
  ) {
    this.tickPlayer(playerId);
    const s = this.requireOwnedSettlement(playerId, settlementId);
    const m = s.monuments.find((x) => x.siteId === siteId);
    if (!m) throw new Error("Monument not held");
    if (workers < 0) throw new Error("Invalid workers");
    const assigned = s.buildings.reduce((n, b) => n + b.workers, 0);
    const monumentOthers = s.monuments
      .filter((x) => x.siteId !== siteId)
      .reduce((n, x) => n + x.workers, 0);
    // permanent send: reduce settlement workers
    const delta = workers - m.workers;
    if (delta > 0) {
      if (s.workers - assigned - monumentOthers < delta) {
        throw new Error("Not enough free Workers");
      }
      s.workers -= delta;
      m.workers += delta;
    } else if (delta < 0) {
      // cannot recall monument workers per GDD — permanent
      throw new Error("Monument Workers cannot return home");
    }
    this.store.mark();
  }

  // --- Multi-settlement ---
  foundSettlement(playerId: string, siteId: string, name: string) {
    this.tickPlayer(playerId);
    const player = this.store.world.players[playerId]!;
    const n = player.settlementIds.length + 1;
    if (n > MAX_SETTLEMENTS) throw new Error("Max 4 settlements");
    const sealCost = FOUNDING_SEAL_COST[n] ?? 4;
    if (player.seals < sealCost) throw new Error("Not enough Seals");
    // trade floor: founding spend is allowed
    const site = this.store.world.sites.find((s) => s.id === siteId);
    if (!site || site.kind !== "founding" || site.ownerPlayerId) {
      throw new Error("Site unavailable");
    }
    const cost: ResourceStack[] = [
      { resource: "mudbricks", amount: 80 },
      { resource: "rations", amount: 40 },
      { resource: "vessels", amount: 10 },
    ];
    if (!pay(player.vault, cost)) throw new Error("Cannot afford founding");
    player.seals -= sealCost;
    this.log(playerId, "seals", -sealCost, "founding");
    for (const c of cost) this.log(playerId, c.resource, -c.amount, "founding");

    const existing = Object.values(this.store.world.settlements).map((s) => ({
      provinceId: s.provinceId,
      uniqueLuxury: s.uniqueLuxury,
    }));
    const slot = assignFoundingSlot({
      existingSettlements: existing,
      preferredProvinceId: site.provinceId,
    });
    const settlementId = nanoid(10);
    const now = Date.now();
    const settlement = {
      id: settlementId,
      playerId,
      name: name.slice(0, 32) || "New Shore",
      provinceId: site.provinceId,
      mapArchetypeId: slot.mapArchetypeId,
      mapX: site.mapX,
      mapY: site.mapY,
      greatHouseLevel: 1,
      workers: 12,
      workersAssigned: 0,
      buildings: makeStarterBuildings(() => nanoid(8)),
      construction: null,
      units: [],
      barges: [],
      monuments: [],
      uniqueLuxury: slot.uniqueLuxury as LuxuryMaterial,
      prestige: 0,
      lastTickAt: now,
      createdAt: now,
    };
    site.ownerPlayerId = playerId;
    this.store.world.settlements[settlementId] = settlement;
    player.settlementIds.push(settlementId);
    this.store.world.sites.push({
      id: `city-${settlementId}`,
      kind: "city",
      provinceId: site.provinceId,
      name: settlement.name,
      mapX: site.mapX,
      mapY: site.mapY,
      ownerPlayerId: playerId,
    });
    this.store.mark();
    return settlement;
  }

  // --- Shrine / blessing ---
  contributeShrine(
    playerId: string,
    settlementId: string,
    amount: number
  ) {
    this.tickPlayer(playerId);
    const player = this.store.world.players[playerId]!;
    const s = this.requireOwnedSettlement(playerId, settlementId);
    if (!s.buildings.some((b) => b.kind === "shrine")) {
      throw new Error("Build a Shrine first");
    }
    const province = PROVINCES.find((p) => p.id === s.provinceId)!;
    const good = province.patronGood;
    if (!debit(player.vault, good, amount)) throw new Error("Not enough offering goods");
    this.log(playerId, good, -amount, "shrine_offering");
    const key = s.provinceId;
    this.store.world.shrineOfferings[key] =
      (this.store.world.shrineOfferings[key] ?? 0) + amount;
    const threshold = 20;
    if ((this.store.world.shrineOfferings[key] ?? 0) >= threshold) {
      this.store.world.blessings[key] = {
        endsAt: Date.now() + BLESSING_HOURS * 3_600_000,
        good,
      };
      this.store.world.shrineOfferings[key] = 0;
    }
    this.store.mark();
  }

  // --- Envoys (GH7+) ---
  dispatchEnvoy(playerId: string, settlementId: string) {
    this.tickPlayer(playerId);
    const player = this.store.world.players[playerId]!;
    const s = this.requireOwnedSettlement(playerId, settlementId);
    if (s.greatHouseLevel < 7) throw new Error("Envoys unlock at Great House 7");
    const cost: ResourceStack[] = [
      { resource: "rations", amount: 15 },
      { resource: s.uniqueLuxury, amount: 5 },
    ];
    if (!pay(player.vault, cost)) throw new Error("Cannot afford envoy");
    for (const c of cost) this.log(playerId, c.resource, -c.amount, "envoy");
    // success roll
    const roll = Math.random();
    if (roll > 0.3) {
      credit(player.vault, "mudbricks", 20 + Math.floor(Math.random() * 30));
      this.log(playerId, "mudbricks", 20, "envoy", "success");
    }
    if (roll > 0.85) {
      player.seals += 1;
      this.log(playerId, "seals", 1, "envoy", "success");
    }
    player.prestige += 2;
    this.store.mark();
  }

  // --- Ascension ---
  ascend(playerId: string) {
    this.tickPlayer(playerId);
    const player = this.store.world.players[playerId]!;
    const hasGh22 = player.settlementIds.some(
      (id) => (this.store.world.settlements[id]?.greatHouseLevel ?? 0) >= 22
    );
    if (!hasGh22) throw new Error("Need Great House level 22 to Ascend");
    player.ascended = true;
    player.eternalName = player.name;
    const capital = this.store.world.settlements[player.settlementIds[0]!];
    if (capital) {
      this.store.world.sites.push({
        id: `ancestral-${playerId}`,
        kind: "ancestral",
        provinceId: capital.provinceId,
        name: `Eternal Name: ${player.name}`,
        mapX: capital.mapX + 5,
        mapY: capital.mapY - 5,
        ownerPlayerId: playerId,
      });
    }
    this.store.mark();
  }

  // --- Postcard ---
  savePostcard(
    playerId: string,
    settlementId: string,
    dataUrl: string
  ) {
    const s = this.requireOwnedSettlement(playerId, settlementId);
    const player = this.store.world.players[playerId]!;
    const card = {
      id: nanoid(),
      settlementId,
      playerId,
      playerName: player.name,
      settlementName: s.name,
      dataUrl: dataUrl.slice(0, 500_000),
      createdAt: Date.now(),
    };
    this.store.world.postcards = [
      ...this.store.world.postcards.filter((p) => p.settlementId !== settlementId),
      card,
    ].slice(-50);
    this.store.mark();
    return card;
  }

  getPostcard(settlementId: string) {
    return this.store.world.postcards.find((p) => p.settlementId === settlementId) ?? null;
  }

  visitSettlement(settlementId: string) {
    const s = this.store.world.settlements[settlementId];
    if (!s) throw new Error("Unknown settlement");
    const owner = this.store.world.players[s.playerId];
    return {
      settlement: {
        id: s.id,
        name: s.name,
        provinceId: s.provinceId,
        greatHouseLevel: s.greatHouseLevel,
        uniqueLuxury: s.uniqueLuxury,
        buildings: s.buildings.map((b) => ({
          kind: b.kind,
          level: b.level,
          plotX: b.plotX,
          plotY: b.plotY,
          luxury: b.luxury,
        })),
        mapX: s.mapX,
        mapY: s.mapY,
      },
      ownerName: owner?.name ?? "Unknown",
      postcard: this.getPostcard(settlementId),
      readOnly: true as const,
    };
  }

  // --- Prompt 01.5 modern APIs ---

  markTutorialGoal(
    playerId: string,
    goal: keyof NonNullable<
      import("@immortal/shared").TutorialState["goals"]
    >
  ) {
    this.ensurePlayerDefaults(playerId);
    const t = this.store.world.players[playerId]!.tutorial!;
    if (t.goals[goal]) return;
    t.goals[goal] = true;
    if (Object.values(t.goals).every(Boolean)) {
      t.completed = true;
      t.step = 99;
    }
    this.store.mark();
  }

  refreshTutorialGoals(playerId: string) {
    const p = this.store.world.players[playerId];
    if (!p) return;
    this.ensurePlayerDefaults(playerId);
    for (const sid of p.settlementIds) {
      const s = this.store.world.settlements[sid];
      if (!s) continue;
      if (s.buildings.some((b) => b.kind === "mudbrick_yard")) {
        this.markTutorialGoal(playerId, "mudbrickYard");
      }
      if (s.buildings.some((b) => b.kind === "ration_house")) {
        this.markTutorialGoal(playerId, "rationHouse");
      }
      if (s.buildings.some((b) => b.workers > 0)) {
        this.markTutorialGoal(playerId, "assignWorkers");
      }
      if (s.buildings.some((b) => b.kind === "luxury_material")) {
        this.markTutorialGoal(playerId, "luxuryLesson");
      }
    }
  }

  setTutorialStep(playerId: string, step: number) {
    this.ensurePlayerDefaults(playerId);
    const t = this.store.world.players[playerId]!.tutorial!;
    t.step = step;
    if (step >= 5) this.markTutorialGoal(playerId, "seeGhUpgrade");
    if (step >= 3) this.markTutorialGoal(playerId, "luxuryLesson");
    this.store.mark();
    return t;
  }

  dismissGoals(playerId: string) {
    this.ensurePlayerDefaults(playerId);
    this.store.world.players[playerId]!.tutorial!.dismissedGoals = true;
    this.store.mark();
  }

  setPauseNonEssential(playerId: string, pause: boolean) {
    this.ensurePlayerDefaults(playerId);
    this.store.world.players[playerId]!.pauseNonEssential = pause;
    this.store.mark();
  }

  applySuggestedWorkers(playerId: string, settlementId: string) {
    this.tickPlayer(playerId);
    const s = this.requireOwnedSettlement(playerId, settlementId);
    const plan = suggestWorkerBalance(s);
    for (const row of plan) {
      const b = s.buildings.find((x) => x.id === row.buildingId);
      if (!b) continue;
      b.workers = row.workers;
    }
    s.workersAssigned = s.buildings.reduce((n, b) => n + b.workers, 0);
    this.markTutorialGoal(playerId, "assignWorkers");
    this.store.mark();
  }

  saveOfferTemplate(
    playerId: string,
    name: string,
    give: ResourceStack[],
    want: ResourceStack[]
  ) {
    this.ensurePlayerDefaults(playerId);
    const p = this.store.world.players[playerId]!;
    const t = { id: nanoid(), name, give, want };
    p.offerTemplates!.push(t);
    p.offerTemplates = p.offerTemplates!.slice(-20);
    this.store.mark();
    return t;
  }

  setPreferredPartner(playerId: string, partnerId: string, add: boolean) {
    this.ensurePlayerDefaults(playerId);
    const prefs = this.store.world.players[playerId]!.prefs!;
    if (add) {
      if (!prefs.preferredPartners.includes(partnerId)) {
        prefs.preferredPartners.push(partnerId);
      }
    } else {
      prefs.preferredPartners = prefs.preferredPartners.filter((id) => id !== partnerId);
    }
    this.store.mark();
  }

  mutePlayer(playerId: string, targetId: string, mute: boolean) {
    this.ensurePlayerDefaults(playerId);
    const prefs = this.store.world.players[playerId]!.prefs!;
    if (mute) {
      if (!prefs.mutedPlayerIds.includes(targetId)) prefs.mutedPlayerIds.push(targetId);
    } else {
      prefs.mutedPlayerIds = prefs.mutedPlayerIds.filter((id) => id !== targetId);
    }
    this.store.mark();
  }

  updateNotifyPrefs(
    playerId: string,
    patch: Partial<NonNullable<import("@immortal/shared").PlayerPrefs["notify"]>>
  ) {
    this.ensurePlayerDefaults(playerId);
    Object.assign(this.store.world.players[playerId]!.prefs!.notify, patch);
    this.store.mark();
  }

  setEmail(playerId: string, email: string) {
    const p = this.store.world.players[playerId]!;
    p.email = email.trim().toLowerCase().slice(0, 120);
    this.store.mark();
  }

  /** Dev-friendly TOTP: stores secret; verify with 6-digit code when enabled */
  setupTotp(playerId: string) {
    const p = this.store.world.players[playerId]!;
    // base32-ish secret for demo (not full RFC6238 library — simple shared secret)
    const secret = nanoid(16).replace(/[^a-zA-Z2-7]/g, "A").slice(0, 16).toUpperCase();
    p.totpSecret = secret;
    p.totpEnabled = false;
    this.store.mark();
    return { secret, otpauth: `otpauth://totp/ImmortalShores:${p.name}?secret=${secret}&issuer=ImmortalShores` };
  }

  enableTotp(playerId: string, code: string) {
    const p = this.store.world.players[playerId]!;
    if (!p.totpSecret) throw new Error("Call setupTotp first");
    if (!verifyTotp(p.totpSecret, code)) throw new Error("Invalid code");
    p.totpEnabled = true;
    this.store.mark();
  }

  loginWithTotp(name: string, password: string, code?: string) {
    const result = this.login(name, password);
    const p = this.store.world.players[result.playerId]!;
    if (p.totpEnabled) {
      if (!code || !p.totpSecret || !verifyTotp(p.totpSecret, code)) {
        this.sessions.delete(result.token);
        throw new Error("2FA code required");
      }
    }
    return result;
  }

  createCircle(playerId: string, name: string) {
    const circle = {
      id: nanoid(),
      name: name.slice(0, 40) || "Trading Circle",
      ownerId: playerId,
      memberIds: [playerId],
      createdAt: Date.now(),
      board: [] as import("@immortal/shared").ChatMessage[],
    };
    this.store.world.circles.push(circle);
    this.store.mark();
    return circle;
  }

  joinCircle(playerId: string, circleId: string) {
    const c = this.store.world.circles.find((x) => x.id === circleId);
    if (!c) throw new Error("Circle not found");
    if (c.memberIds.includes(playerId)) return c;
    if (c.memberIds.length >= 12) throw new Error("Circle full (max 12)");
    c.memberIds.push(playerId);
    this.store.mark();
    return c;
  }

  postCircleBoard(playerId: string, circleId: string, text: string) {
    const c = this.store.world.circles.find((x) => x.id === circleId);
    if (!c || !c.memberIds.includes(playerId)) throw new Error("Not a member");
    const player = this.store.world.players[playerId]!;
    const msg = {
      id: nanoid(),
      channel: "trade" as const,
      fromId: playerId,
      fromName: player.name,
      text: text.slice(0, 500),
      createdAt: Date.now(),
    };
    c.board.push(msg);
    c.board = c.board.slice(-100);
    this.store.mark();
    return msg;
  }

  listCircles() {
    return this.store.world.circles.map((c) => ({
      id: c.id,
      name: c.name,
      ownerId: c.ownerId,
      members: c.memberIds.length,
      max: 12,
    }));
  }

  equipCosmetic(playerId: string, slot: string, cosmeticId: string) {
    this.ensurePlayerDefaults(playerId);
    const p = this.store.world.players[playerId]!;
    if (!p.cosmeticsOwned!.includes(cosmeticId) && cosmeticId !== "default") {
      throw new Error("Cosmetic not owned");
    }
    p.cosmeticsEquipped![slot] = cosmeticId;
    this.store.mark();
  }

  purchaseCosmetic(playerId: string, cosmeticId: string, sealCost = 0) {
    // Cosmetics only — Seals may fund cosmetics, never combat power
    this.ensurePlayerDefaults(playerId);
    const p = this.store.world.players[playerId]!;
    if (p.cosmeticsOwned!.includes(cosmeticId)) return;
    if (sealCost > 0) {
      if (p.seals - sealCost < 10) throw new Error("Cannot go below 10 Seals");
      p.seals -= sealCost;
      this.log(playerId, "seals", -sealCost, "seal_purchase", "cosmetic", cosmeticId);
    }
    p.cosmeticsOwned!.push(cosmeticId);
    this.store.mark();
  }

  ensureSeasonalEvent() {
    const now = Date.now();
    if (this.store.world.seasonal && this.store.world.seasonal.endsAt > now) {
      return this.store.world.seasonal;
    }
    this.store.world.seasonal = {
      id: nanoid(),
      provinceId: "all",
      title: "Provincial Harvest Week",
      goalResource: "rations",
      goalAmount: 50000,
      progress: 0,
      endsAt: now + 7 * 86400_000,
      blessingHours: 24,
      active: true,
    };
    this.store.mark();
    return this.store.world.seasonal;
  }

  contributeSeasonal(playerId: string, amount: number) {
    const ev = this.ensureSeasonalEvent();
    if (!ev.active) throw new Error("No active event");
    this.tickPlayer(playerId);
    const p = this.store.world.players[playerId]!;
    if (!debit(p.vault, ev.goalResource, amount)) throw new Error("Not enough resources");
    this.log(playerId, ev.goalResource, -amount, "admin", "seasonal");
    ev.progress += amount;
    if (ev.progress >= ev.goalAmount) {
      ev.active = false;
      // temporary all-province blessing
      for (const prov of PROVINCES) {
        this.store.world.blessings[prov.id] = {
          endsAt: Date.now() + ev.blessingHours * 3_600_000,
          good: "rations",
        };
      }
    }
    this.store.mark();
    return ev;
  }

  markNotificationsRead(playerId: string) {
    for (const n of this.store.world.notifications) {
      if (n.playerId === playerId) n.read = true;
    }
    this.store.mark();
  }

  longPoll(playerId: string, since: number) {
    const chat = this.store.world.chat.filter((c) => c.createdAt > since).slice(-30);
    const notes = this.store.world.notifications.filter(
      (n) => n.playerId === playerId && n.ts > since
    );
    return { serverTime: Date.now(), chat, notifications: notes };
  }

  // --- Dev/admin ---
  adminGrant(playerId: string, resource: ResourceId, amount: number) {
    const player = this.store.world.players[playerId];
    if (!player) throw new Error("Unknown");
    if (resource === "seals") {
      player.seals += amount;
    } else {
      credit(player.vault, resource, amount);
    }
    this.log(playerId, resource, amount, "admin");
    this.store.mark();
  }

  /** Fast-forward for tests / demo (hours) */
  debugAdvance(playerId: string, hours: number) {
    const player = this.store.world.players[playerId]!;
    for (const sid of player.settlementIds) {
      const s = this.store.world.settlements[sid]!;
      s.lastTickAt -= hours * 3_600_000;
    }
    return this.tickPlayer(playerId);
  }

  private requireOwnedSettlement(playerId: string, settlementId: string) {
    const s = this.store.world.settlements[settlementId];
    if (!s || s.playerId !== playerId) throw new Error("Settlement not owned");
    return s;
  }

  health() {
    return {
      ok: true,
      players: Object.keys(this.store.world.players).length,
      settlements: Object.keys(this.store.world.settlements).length,
      time: Date.now(),
      ghCaps: GREAT_HOUSE_CAPS[1],
    };
  }
}

function fmtStacks(stacks: ResourceStack[]): string {
  return stacks.map((s) => `${s.amount} ${s.resource}`).join(", ");
}

/** Lightweight TOTP-ish check for rev 1.5 (30s window, SHA-less digit fold of secret+slot). */
function verifyTotp(secret: string, code: string): boolean {
  const slot = Math.floor(Date.now() / 30000);
  for (const s of [slot - 1, slot, slot + 1]) {
    const expected = simpleOtp(secret, s);
    if (expected === code.trim()) return true;
  }
  return false;
}

function simpleOtp(secret: string, slot: number): string {
  let h = 0;
  const raw = `${secret}:${slot}`;
  for (let i = 0; i < raw.length; i++) h = (h * 33 + raw.charCodeAt(i)) >>> 0;
  return String(h % 1000000).padStart(6, "0");
}
