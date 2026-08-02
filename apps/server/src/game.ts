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
  LUXURY_MATERIALS,
  MAX_MONUMENTS,
  MAX_SETTLEMENTS,
  NEW_BUILD_COST,
  PROVINCES,
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
  makeStarterBuildings,
  sealRequiredForGh,
  type BuildingKind,
  type LuxuryMaterial,
  type PublicSnapshot,
  type ResourceId,
  type ResourceStack,
  type UnitKind,
  type VaultBalances,
} from "@immortal/shared";
import { Store } from "./store.js";
import { applySettlementTick } from "./tick.js";

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

  constructor(store = new Store()) {
    this.store = store;
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
    const luxury =
      LUXURY_MATERIALS[Math.floor(Math.random() * LUXURY_MATERIALS.length)]!;
    const province = PROVINCES[Math.floor(Math.random() * PROVINCES.length)]!;
    const founding = this.store.world.sites.find(
      (s) => s.kind === "founding" && s.provinceId === province.id && !s.ownerPlayerId
    );

    const settlementId = nanoid(10);
    const mapX = founding?.mapX ?? province.riverIndex * 120 + 30;
    const mapY = founding?.mapY ?? 50;

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
      provinceId: province.id,
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
      uniqueLuxury: luxury,
      prestige: 0,
      lastTickAt: now,
      createdAt: now,
    };

    // place city site
    this.store.world.sites.push({
      id: `city-${settlementId}`,
      kind: "city",
      provinceId: province.id,
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
    const now = Date.now();
    player.lastSeenAt = now;
    const summaries = [];
    for (const sid of player.settlementIds) {
      const s = this.store.world.settlements[sid];
      if (!s) continue;
      const bless = this.store.world.blessings[s.provinceId];
      const hasShrine = s.buildings.some((b) => b.kind === "shrine");
      const bMult =
        bless && bless.endsAt > now && hasShrine ? 1 + BLESSING_BONUS : 1;
      const summary = applySettlementTick(s, player.vault, now, bMult);
      summaries.push(summary);
      for (const p of summary.produced) {
        this.log(playerId, p.resource, p.amount, "tick_production", "settlement", sid);
      }
      for (const c of summary.consumed) {
        this.log(playerId, c.resource, -c.amount, "upkeep", "settlement", sid);
      }
    }
    // barge arrivals
    this.resolveBargeArrivals(now);
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
          }
          b.cargo = [];
        }
      }
    }
  }

  snapshot(playerId: string): PublicSnapshot {
    const tickSummary = this.tickPlayer(playerId);
    const player = this.store.world.players[playerId]!;
    const settlements = player.settlementIds
      .map((id) => this.store.world.settlements[id])
      .filter(Boolean);

    const mail = this.store.world.mail
      .filter((m) => m.toId === playerId || m.fromId === playerId)
      .slice(-100);
    const chat = this.store.world.chat.slice(-80);
    const market = this.store.world.market.filter((o) => o.expiresAt > Date.now());
    const offers = this.store.world.offers.filter(
      (o) =>
        o.state === "posted" ||
        o.posterId === playerId ||
        o.counterpartyId === playerId
    );

    return {
      player: {
        id: player.id,
        name: player.name,
        seals: player.seals,
        prestige: player.prestige,
        vault: { ...player.vault },
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
    if (resource === "seals") throw new Error("Use gift/escrow for Seals");
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
    this.store.mark();
  }

  // --- Trade offers / escrow ---
  postOffer(
    playerId: string,
    give: ResourceStack[],
    want: ResourceStack[],
    channel: "trade" | "province" | "private" = "trade"
  ) {
    this.tickPlayer(playerId);
    const player = this.store.world.players[playerId]!;
    this.assertSealFloor(player, give);
    // soft-hold give side
    for (const g of give) {
      if (g.resource === "seals") {
        if (player.seals < g.amount) throw new Error("Not enough Seals");
      } else if (!debit(player.vault, g.resource, g.amount)) {
        throw new Error(`Not enough ${g.resource}`);
      }
    }
    for (const g of give) {
      if (g.resource === "seals") {
        player.seals -= g.amount;
        this.log(playerId, "seals", -g.amount, "escrow_lock");
      } else {
        this.log(playerId, g.resource, -g.amount, "escrow_lock");
      }
    }
    const offer = {
      id: nanoid(),
      posterId: playerId,
      give,
      want,
      state: "posted" as const,
      channel,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3 * 86400_000,
    };
    this.store.world.offers.push(offer);
    this.store.world.chat.push({
      id: nanoid(),
      channel: "trade",
      fromId: playerId,
      fromName: player.name,
      text: `Offer ${offer.id.slice(0, 6)}: give ${fmtStacks(give)} for ${fmtStacks(want)}`,
      offerId: offer.id,
      createdAt: Date.now(),
    });
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
    this.assertSealFloor(acceptor, offer.want);
    // lock acceptor's want side then swap
    for (const w of offer.want) {
      if (w.resource === "seals") {
        if (acceptor.seals < w.amount) throw new Error("Not enough Seals");
      } else if ((acceptor.vault[w.resource] ?? 0) < w.amount) {
        throw new Error(`Not enough ${w.resource}`);
      }
    }
    for (const w of offer.want) {
      if (w.resource === "seals") {
        acceptor.seals -= w.amount;
        this.log(playerId, "seals", -w.amount, "escrow_settle");
      } else {
        debit(acceptor.vault, w.resource, w.amount);
        this.log(playerId, w.resource, -w.amount, "escrow_settle");
      }
    }
    // poster already locked give; credit acceptor
    for (const g of offer.give) {
      if (g.resource === "seals") {
        acceptor.seals += g.amount;
        this.log(playerId, "seals", g.amount, "escrow_settle");
      } else {
        credit(acceptor.vault, g.resource, g.amount);
        this.log(playerId, g.resource, g.amount, "escrow_settle");
      }
    }
    // credit poster the want
    const poster = this.store.world.players[offer.posterId];
    if (poster) {
      for (const w of offer.want) {
        if (w.resource === "seals") {
          poster.seals += w.amount;
          this.log(poster.id, "seals", w.amount, "escrow_settle");
        } else {
          credit(poster.vault, w.resource, w.amount);
          this.log(poster.id, w.resource, w.amount, "escrow_settle");
        }
      }
    }
    offer.state = "completed";
    offer.counterpartyId = playerId;
    offer.acceptKey = acceptKey ?? nanoid();
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
    text = text.trim().slice(0, 500);
    if (!text) throw new Error("Empty message");
    // free text never executes transfers
    const msg = {
      id: nanoid(),
      channel,
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

    const luxury =
      LUXURY_MATERIALS[Math.floor(Math.random() * LUXURY_MATERIALS.length)]!;
    const settlementId = nanoid(10);
    const now = Date.now();
    const settlement = {
      id: settlementId,
      playerId,
      name: name.slice(0, 32) || "New Shore",
      provinceId: site.provinceId,
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
      uniqueLuxury: luxury as LuxuryMaterial,
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
