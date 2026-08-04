import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Game } from "../src/game.js";
import { Store, writeFileAtomic } from "../src/store.js";

function freshDir() {
  const dir = mkdtempSync(join(tmpdir(), "immortal-persist-"));
  process.env.DATA_DIR = dir;
  return dir;
}

function worldFile(dir: string) {
  return join(dir, "world.json");
}

function readWorld(dir: string) {
  return JSON.parse(readFileSync(worldFile(dir), "utf8")) as {
    players: Record<string, unknown>;
    schemaVersion: number;
  };
}

describe("session durability", () => {
  it("a session survives a Store/Game restart", () => {
    const dir = freshDir();
    try {
      const first = new Game(new Store());
      const { token, playerId } = first.register("Persisted", "pass");
      first.store.close();

      // simulates a redeploy: brand new process objects over the same DATA_DIR
      const second = new Game(new Store());
      assert.equal(second.playerIdFromToken(token), playerId);
      assert.ok(second.snapshot(playerId).settlements[0], "settlement still there");
      second.store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("expired tokens are rejected and reaped", () => {
    const dir = freshDir();
    try {
      const game = new Game(new Store());
      const { token } = game.register("Stale", "pass");
      game.store.close();

      // age the session past the 30 day sliding window
      const path = join(dir, "sessions.json");
      const raw = JSON.parse(readFileSync(path, "utf8")) as {
        sessions: Record<string, { issuedAt: number; lastSeenAt: number }>;
      };
      const old = Date.now() - 31 * 86_400_000;
      raw.sessions[token]!.issuedAt = old;
      raw.sessions[token]!.lastSeenAt = old;
      writeFileSync(path, JSON.stringify(raw));

      const next = new Game(new Store());
      assert.equal(next.playerIdFromToken(token), null);
      assert.equal(next.sessions.size, 0, "expired session reaped on load");
      next.store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("an unreadable sessions file costs a login, not the world", () => {
    const dir = freshDir();
    try {
      const game = new Game(new Store());
      const { playerId } = game.register("SessionJunk", "pass");
      game.store.close();
      writeFileSync(join(dir, "sessions.json"), "{ truncated");

      const next = new Game(new Store());
      assert.equal(next.sessions.size, 0);
      assert.ok(next.store.world.players[playerId], "player data untouched");
      next.store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("world durability", () => {
  it("a truncated world.json does not wipe the world", () => {
    const dir = freshDir();
    try {
      const first = new Game(new Store());
      const { playerId } = first.register("Survivor", "pass");
      first.store.close();
      // second boot snapshots the good file into backups/
      const second = new Store();
      second.close();
      assert.ok(readdirSync(join(dir, "backups")).length >= 1, "boot backup taken");

      const good = readFileSync(worldFile(dir), "utf8");
      writeFileSync(worldFile(dir), good.slice(0, Math.floor(good.length / 2)));

      const third = new Game(new Store());
      assert.ok(third.store.world.players[playerId], "restored from backup");
      assert.ok(
        readdirSync(dir).some((n) => n.includes("world.json.corrupt-")),
        "damaged file kept, not overwritten"
      );
      third.store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses to start on corruption with no usable backup, leaving the file alone", () => {
    const dir = freshDir();
    try {
      writeFileSync(worldFile(dir), '{"players":{"a":1},"settle');
      assert.throws(() => new Store(), /Refusing to start/);
      assert.equal(
        readFileSync(worldFile(dir), "utf8"),
        '{"players":{"a":1},"settle',
        "damaged world.json untouched"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses a world written by a newer schema instead of downgrading it", () => {
    const dir = freshDir();
    try {
      const store = new Store();
      store.close();
      const world = JSON.parse(readFileSync(worldFile(dir), "utf8")) as Record<
        string,
        unknown
      >;
      world.schemaVersion = 99;
      writeFileSync(worldFile(dir), JSON.stringify(world));
      assert.throws(() => new Store(), /schemaVersion 99/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("an interrupted atomic write leaves the previous file intact", () => {
    const dir = freshDir();
    try {
      const game = new Game(new Store());
      const { playerId } = game.register("Atomic", "pass");
      game.store.close();
      const before = readFileSync(worldFile(dir), "utf8");

      // a kill mid-write leaves a temp file and never touches world.json
      writeFileSync(join(dir, "world.json.tmp-999-abc"), '{"players":{},"sett');
      assert.equal(readFileSync(worldFile(dir), "utf8"), before);

      const next = new Game(new Store());
      assert.ok(next.store.world.players[playerId], "world loaded from the intact file");
      assert.ok(
        !readdirSync(dir).some((n) => n.includes(".json.tmp-")),
        "stale temp pruned on boot"
      );
      next.store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writeFileAtomic replaces content in one step", () => {
    const dir = freshDir();
    try {
      const file = join(dir, "atomic.json");
      writeFileAtomic(file, '{"a":1}');
      writeFileAtomic(file, '{"a":2}');
      assert.equal(readFileSync(file, "utf8"), '{"a":2}');
      assert.ok(!readdirSync(dir).some((n) => n.startsWith("atomic.json.tmp-")));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("migration keeps existing players and fills fields added later", () => {
    const dir = freshDir();
    try {
      const seed = new Game(new Store());
      const { playerId } = seed.register("Legacy", "pass");
      seed.store.close();

      // a v1-shaped file: no circles / notifications / seasonal, plus a field this
      // build does not know about yet
      const world = JSON.parse(readFileSync(worldFile(dir), "utf8")) as Record<
        string,
        unknown
      >;
      delete world.circles;
      delete world.notifications;
      delete world.seasonal;
      world.schemaVersion = 1;
      world.futureField = { keepMe: true };
      writeFileSync(worldFile(dir), JSON.stringify(world));

      const store = new Store();
      assert.ok(store.world.players[playerId], "player survived migration");
      assert.deepEqual(store.world.circles, []);
      assert.deepEqual(store.world.notifications, []);
      assert.equal(store.world.seasonal, null);
      assert.equal(store.world.schemaVersion, 2);
      store.close();
      const onDisk = JSON.parse(readFileSync(worldFile(dir), "utf8")) as Record<
        string,
        unknown
      >;
      assert.deepEqual(onDisk.futureField, { keepMe: true }, "unknown fields preserved");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a missing world.json is restored from backup instead of starting empty", () => {
    const dir = freshDir();
    try {
      const game = new Game(new Store());
      const { playerId } = game.register("Vanished", "pass");
      game.store.close();
      const second = new Store();
      second.close();
      rmSync(worldFile(dir));

      const third = new Store();
      assert.ok(third.world.players[playerId], "restored from backup");
      assert.ok(existsSync(worldFile(dir)), "live file rewritten");
      third.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("close() flushes pending mutations and is idempotent", () => {
    const dir = freshDir();
    try {
      const game = new Game(new Store());
      const { playerId } = game.register("Flusher", "pass");
      game.adminGrant(playerId, "mudbricks", 777);
      game.store.close();
      game.store.close();
      const players = readWorld(dir).players as Record<
        string,
        { vault: Record<string, number> }
      >;
      assert.equal(players[playerId]!.vault.mudbricks! >= 777, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("offline catch-up across a restart", () => {
  it("credits a multi-day gap once, capped, with no double-dip", () => {
    const dir = freshDir();
    try {
      const first = new Game(new Store());
      const { playerId } = first.register("Away", "pass");
      const st = first.snapshot(playerId).settlements[0]!;
      const field = st.buildings.find((b) => b.kind === "emmer_field")!;
      first.assignWorkers(playerId, st.id, field.id, 4);
      first.adminGrant(playerId, "rations", 100_000);
      const emmer0 = first.snapshot(playerId).player.vault.emmer ?? 0;
      // 30 days offline, then the process goes away
      first.store.world.settlements[st.id]!.lastTickAt -= 30 * 86_400_000;
      first.store.close();

      const second = new Game(new Store());
      const summary = second.tickPlayer(playerId);
      assert.ok(summary.elapsedHours <= 168.0001, "catch-up capped at 7 days");
      const emmer1 = second.snapshot(playerId).player.vault.emmer ?? 0;
      assert.ok(emmer1 > emmer0, "offline production credited");
      assert.ok(Number.isFinite(emmer1), "no NaN in the vault");

      // a third boot must not replay the same gap
      second.store.close();
      const third = new Game(new Store());
      third.tickPlayer(playerId);
      const emmer2 = third.snapshot(playerId).player.vault.emmer ?? 0;
      assert.ok(emmer2 - emmer1 < 10, "gap is not credited twice");
      third.store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a garbled lastTickAt re-anchors instead of poisoning the vault", () => {
    const dir = freshDir();
    try {
      const game = new Game(new Store());
      const { playerId } = game.register("Skewed", "pass");
      const st = game.snapshot(playerId).settlements[0]!;
      const before = game.snapshot(playerId).player.vault.rations ?? 0;

      const live = game.store.world.settlements[st.id]!;
      live.lastTickAt = Number.NaN;
      game.tickPlayer(playerId);
      assert.ok(Number.isFinite(live.lastTickAt), "lastTickAt re-anchored");
      assert.equal(game.snapshot(playerId).player.vault.rations ?? 0, before);

      // clock skew: a future stamp must not freeze or overflow the settlement
      live.lastTickAt = Date.now() + 86_400_000;
      game.tickPlayer(playerId);
      assert.ok(live.lastTickAt <= Date.now() + 1000);
      assert.ok(Number.isFinite(game.snapshot(playerId).player.vault.rations ?? 0));
      game.store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
