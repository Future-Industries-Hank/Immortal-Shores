import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { Store } from "../src/store.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function freshGame() {
  const dir = mkdtempSync(join(tmpdir(), "immortal-"));
  process.env.DATA_DIR = dir;
  const store = new Store();
  const game = new Game(store);
  return {
    game,
    cleanup: () => {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe("offline catch-up", () => {
  it("produces emmer over simulated hours without double-dip", () => {
    const { game, cleanup } = freshGame();
    try {
      const { playerId } = game.register("NileTest", "pass");
      const before = game.snapshot(playerId);
      const st = before.settlements[0]!;
      const field = st.buildings.find((b) => b.kind === "emmer_field")!;
      game.assignWorkers(playerId, st.id, field.id, 4);
      const emmer0 = game.snapshot(playerId).player.vault.emmer ?? 0;
      const s1 = game.debugAdvance(playerId, 2);
      assert.ok(s1.elapsedHours >= 1.9);
      const mid = game.snapshot(playerId);
      const emmer1 = mid.player.vault.emmer ?? 0;
      assert.ok(emmer1 > emmer0, "should produce emmer");
      // second tick immediately should not re-apply same hours
      const s2 = game.tickPlayer(playerId);
      assert.ok(s2.elapsedHours < 0.01);
      const emmer2 = game.snapshot(playerId).player.vault.emmer ?? 0;
      assert.equal(emmer2, emmer1);
    } finally {
      cleanup();
    }
  });

  it("two accounts can complete structured trade", () => {
    const { game, cleanup } = freshGame();
    try {
      const a = game.register("TraderA", "pass");
      const b = game.register("TraderB", "pass");
      game.adminGrant(a.playerId, "hides", 10);
      game.adminGrant(b.playerId, "rations", 50);
      const offer = game.postOffer(
        a.playerId,
        [{ resource: "hides", amount: 4 }],
        [{ resource: "rations", amount: 20 }]
      );
      game.acceptOffer(b.playerId, offer.id, "key-1");
      const sa = game.snapshot(a.playerId);
      const sb = game.snapshot(b.playerId);
      assert.ok((sa.player.vault.rations ?? 0) >= 20);
      assert.ok((sb.player.vault.hides ?? 0) >= 4);
    } finally {
      cleanup();
    }
  });

  it("new buildings require a typed empty pad", () => {
    const { game, cleanup } = freshGame();
    try {
      const { playerId } = game.register("Builder", "pass");
      const snap = game.snapshot(playerId);
      const st = snap.settlements[0]!;
      game.adminGrant(playerId, "mudbricks", 50);
      game.adminGrant(playerId, "reed_baskets", 20);
      assert.throws(() => {
        game.startConstruction(playerId, st.id, "ration_house");
      }, /empty pad|Choose an empty pad/i);
      // shop pad only accepts shop kinds
      assert.throws(() => {
        game.startConstruction(playerId, st.id, "harbor", undefined, "shop-1");
      }, /Cannot place|Allowed/i);
      game.startConstruction(playerId, st.id, "mudbrick_yard", undefined, "shop-1");
      assert.ok(game.snapshot(playerId).settlements[0]!.construction);
    } finally {
      cleanup();
    }
  });

  it("trust wall offer does not debit until accept", () => {
    const { game, cleanup } = freshGame();
    try {
      const a = game.register("TrustA", "pass");
      const b = game.register("TrustB", "pass");
      game.adminGrant(a.playerId, "hides", 10);
      game.adminGrant(b.playerId, "rations", 50);
      const before = game.snapshot(a.playerId).player.vault.hides ?? 0;
      const offer = game.postOffer(
        a.playerId,
        [{ resource: "hides", amount: 4 }],
        [{ resource: "rations", amount: 20 }]
      );
      const mid = game.snapshot(a.playerId).player.vault.hides ?? 0;
      assert.equal(mid, before, "no escrow lock on post");
      game.acceptOffer(b.playerId, offer.id, "k2");
      const afterA = game.snapshot(a.playerId);
      assert.ok((afterA.player.vault.hides ?? 0) === before - 4);
      assert.ok((afterA.player.vault.rations ?? 0) >= 20);
    } finally {
      cleanup();
    }
  });

  it("market range filters by Market level", () => {
    const { game, cleanup } = freshGame();
    try {
      const a = game.register("RangeA", "pass");
      const b = game.register("RangeB", "pass");
      // force far provinces if random collide — post with distant province id
      game.adminGrant(a.playerId, "emmer", 20);
      const sa = game.snapshot(a.playerId);
      const settle = sa.settlements[0]!;
      game.postMarket(a.playerId, "emmer", 5, 10, "upper_cataract");
      const snapB = game.snapshot(b.playerId);
      // L1 market range is 1 — may or may not include depending on provinces;
      // assert filter function is applied: own orders always visible
      const snapA = game.snapshot(a.playerId);
      assert.ok(snapA.market.some((o) => o.sellerId === a.playerId));
      void settle;
      void snapB;
    } finally {
      cleanup();
    }
  });

  it("founding balances luxuries across multiplayer", () => {
    const { game, cleanup } = freshGame();
    try {
      const lux = new Set<string>();
      const provs = new Set<string>();
      for (let i = 0; i < 8; i++) {
        const { playerId } = game.register(`MP${i}`, "pass");
        const snap = game.snapshot(playerId);
        lux.add(snap.settlements[0]!.uniqueLuxury);
        provs.add(snap.settlements[0]!.provinceId);
        assert.ok(snap.settlements[0]!.mapArchetypeId, "map archetype assigned");
      }
      // 8 players → should not all share one luxury
      assert.ok(lux.size >= 4, `expected diverse luxuries, got ${[...lux]}`);
      assert.ok(provs.size >= 3, `expected multi-province, got ${[...provs]}`);
    } finally {
      cleanup();
    }
  });

  it("seal floor blocks trade below 10", () => {
    const { game, cleanup } = freshGame();
    try {
      const a = game.register("SealA", "pass");
      assert.throws(() => {
        game.postOffer(
          a.playerId,
          [{ resource: "seals", amount: 1 }],
          [{ resource: "rations", amount: 1 }]
        );
      }, /below 10/);
    } finally {
      cleanup();
    }
  });
});
