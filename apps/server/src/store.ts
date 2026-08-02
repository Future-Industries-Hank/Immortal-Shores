import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ChatMessage,
  LedgerEntry,
  MailItem,
  MapSite,
  MarketOrder,
  NotificationItem,
  PlayerState,
  Postcard,
  SeasonalEvent,
  SettlementState,
  TradeOffer,
  TradingCircle,
} from "@immortal/shared";
import { PROVINCES } from "@immortal/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));

function dataPaths() {
  const DATA_DIR = process.env.DATA_DIR ?? join(__dirname, "..", "data");
  return { DATA_DIR, DATA_FILE: join(DATA_DIR, "world.json") };
}

export interface WorldState {
  schemaVersion: 2;
  players: Record<string, PlayerState>;
  settlements: Record<string, SettlementState>;
  market: MarketOrder[];
  offers: TradeOffer[];
  mail: MailItem[];
  chat: ChatMessage[];
  ledger: LedgerEntry[];
  sites: MapSite[];
  postcards: Postcard[];
  /** Province blessing ends at ms epoch, keyed by provinceId */
  blessings: Record<string, { endsAt: number; good: string }>;
  shrineOfferings: Record<string, number>;
  circles: TradingCircle[];
  notifications: NotificationItem[];
  seasonal: SeasonalEvent | null;
}

function emptyWorld(): WorldState {
  return {
    schemaVersion: 2,
    players: {},
    settlements: {},
    market: [],
    offers: [],
    mail: [],
    chat: [],
    ledger: [],
    sites: seedSites(),
    postcards: [],
    blessings: {},
    shrineOfferings: {},
    circles: [],
    notifications: [],
    seasonal: null,
  };
}

function migrateWorld(w: WorldState): WorldState {
  const base = emptyWorld();
  return {
    ...base,
    ...w,
    schemaVersion: 2,
    circles: w.circles ?? [],
    notifications: w.notifications ?? [],
    seasonal: w.seasonal ?? null,
    players: w.players ?? {},
    settlements: w.settlements ?? {},
  };
}

function seedSites(): MapSite[] {
  const sites: MapSite[] = [];
  for (const p of PROVINCES) {
    const baseX = p.riverIndex * 120;
    sites.push({
      id: `founding-${p.id}-a`,
      kind: "founding",
      provinceId: p.id,
      name: `${p.name} Shore`,
      mapX: baseX + 20,
      mapY: 40 + (p.riverIndex % 2) * 30,
    });
    sites.push({
      id: `founding-${p.id}-b`,
      kind: "founding",
      provinceId: p.id,
      name: `${p.name} Bend`,
      mapX: baseX + 60,
      mapY: 80 + (p.riverIndex % 3) * 15,
    });
    sites.push({
      id: `monument-${p.id}`,
      kind: "monument",
      provinceId: p.id,
      name: `${p.name} Monument Grounds`,
      mapX: baseX + 40,
      mapY: 20,
      banditForce: 12 + p.riverIndex * 4,
    });
  }
  return sites;
}

export class Store {
  world: WorldState;
  private dirty = false;
  private saveTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const { DATA_DIR, DATA_FILE } = dataPaths();
    mkdirSync(DATA_DIR, { recursive: true });
    if (existsSync(DATA_FILE)) {
      try {
        const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as WorldState;
        this.world = migrateWorld(raw);
      } catch {
        this.world = emptyWorld();
      }
    } else {
      this.world = emptyWorld();
      this.persist();
    }
    this.saveTimer = setInterval(() => this.flush(), 5000);
  }

  mark() {
    this.dirty = true;
  }

  flush() {
    if (!this.dirty) return;
    this.persist();
    this.dirty = false;
  }

  persist() {
    const { DATA_DIR, DATA_FILE } = dataPaths();
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(this.world, null, 2), "utf8");
  }

  close() {
    if (this.saveTimer) clearInterval(this.saveTimer);
    this.persist();
  }
}
