import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
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

/** Bump only together with a migration step in migrateWorld(). */
const SCHEMA_VERSION = 2;
/** Sliding session window — a redeploy must not sign anyone out. */
const SESSION_TTL_MS = 30 * 86_400_000;
/** Only rewrite lastSeenAt this often so reads do not churn the session file. */
const SESSION_TOUCH_MS = 60 * 60_000;
const SESSION_REAP_MS = 10 * 60_000;
const BACKUP_KEEP = 12;
const BACKUP_INTERVAL_MS = 30 * 60_000;

function dataPaths() {
  const DATA_DIR = process.env.DATA_DIR ?? join(__dirname, "..", "data");
  return {
    DATA_DIR,
    DATA_FILE: join(DATA_DIR, "world.json"),
    SESSION_FILE: join(DATA_DIR, "sessions.json"),
    BACKUP_DIR: join(DATA_DIR, "backups"),
  };
}

function backupKeep(): number {
  const n = Number(process.env.WORLD_BACKUP_KEEP ?? BACKUP_KEEP);
  return Number.isFinite(n) ? Math.max(2, Math.floor(n)) : BACKUP_KEEP;
}

function backupIntervalMs(): number {
  const n = Number(process.env.WORLD_BACKUP_INTERVAL_MIN ?? 0);
  return Number.isFinite(n) && n > 0 ? n * 60_000 : BACKUP_INTERVAL_MS;
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
    schemaVersion: SCHEMA_VERSION,
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

/** A world we must not touch: wrong schema, or unreadable with no usable backup. */
export class WorldLoadError extends Error {}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Structural gate. A truncated or half-written file usually still parses as *something*
 * (or throws) — this makes sure we only ever accept a file that is shaped like a world,
 * so we never mistake damage for "the world is simply empty now".
 */
function assertWorldShape(raw: unknown, source: string): asserts raw is WorldState {
  const bad = (why: string) => {
    throw new Error(`${source}: ${why}`);
  };
  if (!isRecord(raw)) bad("not a JSON object");
  const w = raw as Record<string, unknown>;
  if (!isRecord(w.players)) bad("missing players map");
  if (!isRecord(w.settlements)) bad("missing settlements map");
  if (!Array.isArray(w.sites)) bad("missing sites array");
  if (w.schemaVersion !== undefined && typeof w.schemaVersion !== "number") {
    bad("schemaVersion is not a number");
  }
}

/**
 * Forward-safe migration. Unknown keys written by a newer build are preserved by the
 * `...w` spread (never dropped), missing collections fall back to empty defaults, and a
 * world stamped with a newer schemaVersion is refused rather than silently downgraded.
 */
function migrateWorld(w: WorldState, source: string): WorldState {
  const version = typeof w.schemaVersion === "number" ? w.schemaVersion : 1;
  if (version > SCHEMA_VERSION) {
    throw new WorldLoadError(
      `Refusing to start: ${source} was written by schemaVersion ${version} but this build only understands ${SCHEMA_VERSION}. ` +
        `Deploy the newer server build, or restore a backup from DATA_DIR/backups. The file has NOT been modified.`
    );
  }
  const base = emptyWorld();
  // v1 → v2: circles / notifications / seasonal were added; everything else carries over.
  return {
    ...base,
    ...w,
    schemaVersion: SCHEMA_VERSION,
    players: w.players ?? {},
    settlements: w.settlements ?? {},
    market: w.market ?? [],
    offers: w.offers ?? [],
    mail: w.mail ?? [],
    chat: w.chat ?? [],
    ledger: w.ledger ?? [],
    sites: w.sites?.length ? w.sites : base.sites,
    postcards: w.postcards ?? [],
    blessings: w.blessings ?? {},
    shrineOfferings: w.shrineOfferings ?? {},
    circles: w.circles ?? [],
    notifications: w.notifications ?? [],
    seasonal: w.seasonal ?? null,
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

/**
 * Crash-safe write: the whole payload lands in a temp file which is fsynced, then a single
 * atomic rename replaces the target. A kill at any point leaves either the old complete
 * file or the new complete file — never a truncated one.
 */
export function writeFileAtomic(file: string, text: string, mode = 0o644) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now().toString(36)}`;
  const fd = openSync(tmp, "w", mode);
  try {
    writeFileSync(fd, text, "utf8");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, file);
  // fsync the directory so the rename itself survives a power loss
  try {
    const dfd = openSync(dirname(file), "r");
    try {
      fsyncSync(dfd);
    } finally {
      closeSync(dfd);
    }
  } catch {
    /* some platforms refuse directory fsync — the rename is still atomic */
  }
}

/** Leftover temp files from a killed write: junk, never data. */
function pruneStaleTemps() {
  const { DATA_DIR } = dataPaths();
  try {
    for (const name of readdirSync(DATA_DIR)) {
      if (/\.json\.tmp-/.test(name)) rmSync(join(DATA_DIR, name), { force: true });
    }
  } catch {
    /* nothing to prune */
  }
}

/** Newest first — ISO timestamps sort lexicographically. */
function listBackups(): string[] {
  const { BACKUP_DIR } = dataPaths();
  try {
    return readdirSync(BACKUP_DIR)
      .filter((n) => n.startsWith("world-") && n.endsWith(".json"))
      .sort()
      .reverse()
      .map((n) => join(BACKUP_DIR, n));
  } catch {
    return [];
  }
}

function readWorldFile(file: string): WorldState {
  const raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
  assertWorldShape(raw, file);
  return migrateWorld(raw, file);
}

/** Keep the damaged file for forensics — we never overwrite or delete it. */
function quarantine(file: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const kept = `${file}.corrupt-${stamp}`;
  renameSync(file, kept);
  return kept;
}

function refuseToStart(file: string, reason: string): WorldLoadError {
  const { BACKUP_DIR } = dataPaths();
  return new WorldLoadError(
    `Refusing to start: ${file} could not be read (${reason}) and no usable backup was found in ${BACKUP_DIR}. ` +
      `Player data has NOT been modified or deleted. Restore a known-good world.json into that directory ` +
      `(see HOSTING.md → "Backups and restore"), then start the server again.`
  );
}

/**
 * Load order: live file → newest good backup → refuse. Corruption must never fall through
 * to an empty world, because that silently deletes every player's settlement.
 */
function loadWorld(): { world: WorldState; restoredFrom?: string; fresh?: boolean } {
  const { DATA_FILE } = dataPaths();
  const backups = listBackups();

  if (existsSync(DATA_FILE)) {
    try {
      return { world: readWorldFile(DATA_FILE) };
    } catch (err) {
      if (err instanceof WorldLoadError) throw err;
      const reason = (err as Error).message;
      for (const backup of backups) {
        try {
          const world = readWorldFile(backup);
          const kept = quarantine(DATA_FILE);
          console.error(
            `[store] world.json is damaged (${reason}). Kept it at ${kept} and restored ${backup}.`
          );
          return { world, restoredFrom: backup };
        } catch {
          /* try the next-newest backup */
        }
      }
      throw refuseToStart(DATA_FILE, reason);
    }
  }

  if (backups.length) {
    // The live file vanished (bad deploy, wrong volume) — restore, never start empty.
    for (const backup of backups) {
      try {
        const world = readWorldFile(backup);
        console.error(`[store] world.json is missing. Restored ${backup}.`);
        return { world, restoredFrom: backup };
      } catch {
        /* try the next-newest backup */
      }
    }
    throw refuseToStart(DATA_FILE, "file missing and every backup failed to parse");
  }

  return { world: emptyWorld(), fresh: true };
}

export interface SessionRecord {
  playerId: string;
  issuedAt: number;
  lastSeenAt: number;
}

/**
 * Durable token → player map, stored beside world.json so a redeploy does not sign every
 * player out. Kept in its own file on purpose: a damaged sessions file costs a re-login,
 * never a settlement, so it may safely start empty where the world may not.
 */
export class SessionStore {
  private sessions = new Map<string, SessionRecord>();
  private dirty = false;
  private lastReapAt = Date.now();

  constructor() {
    this.load();
  }

  private load() {
    const { SESSION_FILE } = dataPaths();
    if (!existsSync(SESSION_FILE)) return;
    try {
      const raw = JSON.parse(readFileSync(SESSION_FILE, "utf8")) as {
        sessions?: Record<string, Partial<SessionRecord>>;
      };
      for (const [token, rec] of Object.entries(raw?.sessions ?? {})) {
        if (!token || typeof rec?.playerId !== "string") continue;
        const issuedAt = Number(rec.issuedAt);
        const lastSeenAt = Number(rec.lastSeenAt);
        this.sessions.set(token, {
          playerId: rec.playerId,
          issuedAt: Number.isFinite(issuedAt) ? issuedAt : Date.now(),
          lastSeenAt: Number.isFinite(lastSeenAt) ? lastSeenAt : Date.now(),
        });
      }
    } catch (err) {
      console.error(
        `[store] sessions.json unreadable (${(err as Error).message}) — players must sign in again; world data untouched.`
      );
      this.sessions.clear();
    }
    this.reap();
  }

  set(token: string, playerId: string) {
    const now = Date.now();
    this.sessions.set(token, { playerId, issuedAt: now, lastSeenAt: now });
    this.dirty = true;
  }

  /** Returns null for unknown or expired tokens, and reaps the expired one on the way out. */
  get(token: string): string | null {
    const rec = this.sessions.get(token);
    if (!rec) return null;
    const now = Date.now();
    if (now - rec.lastSeenAt > SESSION_TTL_MS) {
      this.sessions.delete(token);
      this.dirty = true;
      return null;
    }
    if (now - rec.lastSeenAt > SESSION_TOUCH_MS) {
      rec.lastSeenAt = now;
      this.dirty = true;
    }
    return rec.playerId;
  }

  delete(token: string) {
    if (this.sessions.delete(token)) this.dirty = true;
  }

  /** Drop sessions past the sliding window, plus any pointing at a player that no longer exists. */
  reap(knownPlayer?: (playerId: string) => boolean) {
    const now = Date.now();
    for (const [token, rec] of this.sessions) {
      const expired = now - rec.lastSeenAt > SESSION_TTL_MS;
      if (expired || (knownPlayer && !knownPlayer(rec.playerId))) {
        this.sessions.delete(token);
        this.dirty = true;
      }
    }
    this.lastReapAt = now;
  }

  get size() {
    return this.sessions.size;
  }

  flush(knownPlayer?: (playerId: string) => boolean) {
    if (Date.now() - this.lastReapAt > SESSION_REAP_MS) this.reap(knownPlayer);
    if (!this.dirty) return;
    this.persist();
  }

  persist() {
    const { DATA_DIR, SESSION_FILE } = dataPaths();
    mkdirSync(DATA_DIR, { recursive: true });
    const sessions: Record<string, SessionRecord> = {};
    for (const [token, rec] of this.sessions) sessions[token] = rec;
    // 0600: the file is a bag of bearer tokens
    writeFileAtomic(SESSION_FILE, JSON.stringify({ sessions }), 0o600);
    this.dirty = false;
  }
}

export class Store {
  world: WorldState;
  sessions: SessionStore;
  private dirty = false;
  private saveTimer: ReturnType<typeof setInterval> | null = null;
  private lastBackupAt = 0;
  private closed = false;

  constructor() {
    const { DATA_DIR, BACKUP_DIR } = dataPaths();
    mkdirSync(DATA_DIR, { recursive: true });
    mkdirSync(BACKUP_DIR, { recursive: true });
    pruneStaleTemps();
    const loaded = loadWorld();
    this.world = loaded.world;
    this.sessions = new SessionStore();
    this.sessions.reap((id) => !!this.world.players[id]);
    if (loaded.fresh || loaded.restoredFrom) {
      // A fresh or restored world is not on disk under its real name yet.
      this.persist();
    } else {
      // Snapshot the pre-deploy file before this process starts writing over it.
      this.backupOnBoot();
    }
    this.saveTimer = setInterval(() => this.flush(), 5000);
    this.saveTimer.unref();
  }

  mark() {
    this.dirty = true;
  }

  flush() {
    if (this.dirty) {
      this.persist();
      this.dirty = false;
    }
    this.sessions.flush((id) => !!this.world.players[id]);
    if (Date.now() - this.lastBackupAt >= backupIntervalMs()) this.backup();
  }

  persist() {
    const { DATA_DIR, DATA_FILE } = dataPaths();
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileAtomic(DATA_FILE, JSON.stringify(this.world, null, 2));
  }

  /**
   * Snapshot the pre-deploy world, unless a boot seconds ago already did — a dev watch loop
   * or a crash loop must not rotate the real history out of the backup directory.
   */
  private backupOnBoot() {
    const [newest] = listBackups();
    try {
      if (newest && Date.now() - statSync(newest).mtimeMs < 60_000) {
        this.lastBackupAt = Date.now();
        return;
      }
    } catch {
      /* unreadable backup dir — take a fresh one */
    }
    this.backup();
  }

  /** Rotating timestamped copies of the last good file; a failed backup never takes the server down. */
  backup() {
    const { DATA_FILE, BACKUP_DIR } = dataPaths();
    this.lastBackupAt = Date.now();
    try {
      if (!existsSync(DATA_FILE)) return;
      mkdirSync(BACKUP_DIR, { recursive: true });
      const stamp = new Date(this.lastBackupAt).toISOString().replace(/[:.]/g, "-");
      copyFileSync(DATA_FILE, join(BACKUP_DIR, `world-${stamp}.json`));
      for (const stale of listBackups().slice(backupKeep())) {
        rmSync(stale, { force: true });
      }
    } catch (err) {
      console.error(`[store] backup failed: ${(err as Error).message}`);
    }
  }

  /**
   * Idempotent shutdown. Every write below is synchronous and fsynced, so the caller may
   * exit the process the moment this returns; the save interval is cleared first so it
   * cannot fire against a half-closed store.
   */
  close() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.closed) return;
    this.closed = true;
    this.persist();
    this.dirty = false;
    this.sessions.persist();
  }
}
