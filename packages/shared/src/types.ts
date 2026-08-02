/** Shared Immortal Shores types — GDD fidelity. */

export type ResourceId =
  | "emmer"
  | "river_clay"
  | "marsh_reeds"
  | "rations"
  | "mudbricks"
  | "vessels"
  | "reed_baskets"
  | "limestone"
  | "hides"
  | "bronze"
  | "cedarwood"
  | "red_ochre"
  | "eye_paint"
  | "sacred_oil"
  | "green_stones"
  | "royal_gold"
  | "fine_sandals"
  | "stone_idols"
  | "eye_cosmetics"
  | "sacred_perfume"
  | "amulets"
  | "seals";

export type LuxuryMaterial =
  | "hides"
  | "bronze"
  | "cedarwood"
  | "red_ochre"
  | "eye_paint"
  | "sacred_oil"
  | "green_stones"
  | "royal_gold";

export type BuildingKind =
  | "great_house"
  | "market"
  | "emmer_field"
  | "river_clay_pit"
  | "marsh_reed_bed"
  | "ration_house"
  | "mudbrick_yard"
  | "vessel_shop"
  | "reed_basket_shop"
  | "luxury_material"
  | "luxury_workshop"
  | "harbor"
  | "warehouse"
  | "training_grounds"
  | "shrine";

export type UnitKind = "bowmen" | "spearmen" | "chariot_warriors";

export type MailKind = "gift" | "trade" | "system" | "dm";

export type EscrowState =
  | "draft"
  | "posted"
  | "locked"
  | "completed"
  | "rejected"
  | "expired"
  | "cancelled";

export type LedgerReason =
  | "tick_production"
  | "upkeep"
  | "market"
  | "escrow_lock"
  | "escrow_settle"
  | "gift"
  | "barge_depart"
  | "barge_arrive"
  | "barge_loss"
  | "seal_purchase"
  | "construction"
  | "construction_refund"
  | "military"
  | "envoy"
  | "admin"
  | "starter"
  | "worker_growth"
  | "founding"
  | "monument"
  | "shrine_offering";

export interface ResourceStack {
  resource: ResourceId;
  amount: number;
}

export interface VaultBalances {
  [key: string]: number;
}

export interface BuildingState {
  id: string;
  kind: BuildingKind;
  level: number;
  workers: number;
  /** For luxury_material buildings — which specialty */
  luxury?: LuxuryMaterial;
  /** Fixed pad id from SETTLEMENT_PLOTS */
  plotId: string;
  /** Denormalized layout index (legacy / debug) */
  plotX: number;
  plotY: number;
  /** Training grounds: which unit this barracks trains */
  trainingUnit?: UnitKind;
}

export interface ConstructionJob {
  buildingId: string | null;
  kind: BuildingKind;
  targetLevel: number;
  cost: ResourceStack[];
  workerHoursRequired: number;
  workerHoursDone: number;
  startedAt: number;
  /** Empty pad being built on */
  plotId?: string;
  plotX?: number;
  plotY?: number;
  trainingUnit?: UnitKind;
  luxury?: LuxuryMaterial;
}

export interface UnitStack {
  kind: UnitKind;
  count: number;
}

export interface BargeState {
  id: string;
  fromSettlementId: string;
  toSettlementId: string | "province_site";
  cargo: ResourceStack[];
  departAt: number;
  arriveAt: number;
  capacity: number;
  status: "building" | "docked" | "in_transit" | "arrived";
  workerHoursRequired?: number;
  workerHoursDone?: number;
}

export interface MonumentHold {
  siteId: string;
  level: number;
  workers: number;
  limestone: number;
  capturedAt: number;
}

export interface SettlementState {
  id: string;
  playerId: string;
  name: string;
  provinceId: string;
  mapX: number;
  mapY: number;
  greatHouseLevel: number;
  workers: number;
  workersAssigned: number;
  buildings: BuildingState[];
  construction: ConstructionJob | null;
  units: UnitStack[];
  barges: BargeState[];
  monuments: MonumentHold[];
  uniqueLuxury: LuxuryMaterial;
  prestige: number;
  lastTickAt: number;
  createdAt: number;
}

export interface PlayerState {
  id: string;
  name: string;
  passwordHash: string;
  vault: VaultBalances;
  seals: number;
  settlementIds: string[];
  allies: string[];
  prestige: number;
  ascended: boolean;
  eternalName?: string;
  createdAt: number;
  lastSeenAt: number;
}

export interface MarketOrder {
  id: string;
  sellerId: string;
  resource: ResourceId;
  amount: number;
  priceRations: number;
  provinceId: string;
  createdAt: number;
  expiresAt: number;
}

export interface TradeOffer {
  id: string;
  posterId: string;
  give: ResourceStack[];
  want: ResourceStack[];
  state: EscrowState;
  channel: "trade" | "province" | "private";
  provinceId?: string;
  createdAt: number;
  expiresAt: number;
  counterpartyId?: string;
  acceptKey?: string;
}

export interface MailItem {
  id: string;
  fromId: string;
  toId: string;
  kind: MailKind;
  subject: string;
  body: string;
  attachments: ResourceStack[];
  offerId?: string;
  read: boolean;
  createdAt: number;
  acceptedAt?: number;
}

export interface ChatMessage {
  id: string;
  channel: "general" | "trade" | "province" | "private";
  provinceId?: string;
  fromId: string;
  fromName: string;
  text: string;
  offerId?: string;
  createdAt: number;
}

export interface LedgerEntry {
  id: string;
  ts: number;
  playerId: string;
  resource: ResourceId;
  delta: number;
  reason: LedgerReason;
  refType?: string;
  refId?: string;
  balanceAfter: number;
}

export interface ProvinceDef {
  id: string;
  name: string;
  patronGood: ResourceId;
  riverIndex: number;
}

export interface MapSite {
  id: string;
  kind: "founding" | "monument" | "city" | "ancestral";
  provinceId: string;
  name: string;
  mapX: number;
  mapY: number;
  banditForce?: number;
  ownerPlayerId?: string;
}

export interface Postcard {
  id: string;
  settlementId: string;
  playerId: string;
  playerName: string;
  settlementName: string;
  dataUrl: string;
  createdAt: number;
}

export interface PublicSnapshot {
  player: {
    id: string;
    name: string;
    seals: number;
    prestige: number;
    vault: VaultBalances;
  };
  settlements: SettlementState[];
  mail: MailItem[];
  chat: ChatMessage[];
  market: MarketOrder[];
  offers: TradeOffer[];
  map: {
    provinces: ProvinceDef[];
    sites: MapSite[];
  };
  serverTime: number;
  tickSummary?: TickSummary;
}

export interface TickSummary {
  elapsedHours: number;
  produced: ResourceStack[];
  consumed: ResourceStack[];
  workersGrown: number;
  shortageMultiplier: number;
}
