import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { Game } from "./game.js";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "0.0.0.0";

/** A refusing store means the world file is damaged — never boot an empty world over it. */
function bootGame(): Game {
  try {
    return new Game();
  } catch (err) {
    console.error(`\n${(err as Error).message}\n`);
    process.exit(1);
  }
}

const game = bootGame();
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(websocket);

function auth(req: { headers: Record<string, string | string[] | undefined> }): string {
  const h = req.headers["authorization"];
  const raw = Array.isArray(h) ? h[0] : h;
  const token = raw?.replace(/^Bearer\s+/i, "") ?? "";
  const id = game.playerIdFromToken(token);
  if (!id) {
    const err = new Error("Unauthorized") as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }
  return id;
}

app.setErrorHandler((err, _req, reply) => {
  const e = err as Error & { statusCode?: number };
  const status = e.statusCode ?? 400;
  reply.status(status).send({ error: e.message ?? "Error" });
});

app.get("/health", async () => game.health());

app.post<{ Body: { name: string; password: string } }>("/api/register", async (req) => {
  const { name, password } = req.body ?? {};
  return game.register(name, password);
});

app.post<{ Body: { name: string; password: string } }>("/api/login", async (req) => {
  const { name, password } = req.body ?? {};
  return game.login(name, password);
});

app.get("/api/me", async (req) => {
  const id = auth(req);
  return game.snapshot(id);
});

app.post<{
  Body: { settlementId: string; buildingId: string; workers: number };
}>("/api/workers", async (req) => {
  const id = auth(req);
  const { settlementId, buildingId, workers } = req.body;
  game.assignWorkers(id, settlementId, buildingId, workers);
  return game.snapshot(id);
});

app.post<{
  Body: {
    settlementId: string;
    kind: string;
    buildingId?: string;
    plotId?: string;
  };
}>("/api/construct", async (req) => {
  const id = auth(req);
  const { settlementId, kind, buildingId, plotId } = req.body;
  game.startConstruction(id, settlementId, kind as never, buildingId, plotId);
  return game.snapshot(id);
});

app.post<{ Body: { settlementId: string } }>("/api/construct/cancel", async (req) => {
  const id = auth(req);
  game.cancelConstruction(id, req.body.settlementId);
  return game.snapshot(id);
});

app.post<{
  Body: {
    resource: string;
    amount: number;
    priceRations: number;
    provinceId: string;
  };
}>("/api/market", async (req) => {
  const id = auth(req);
  const o = game.postMarket(
    id,
    req.body.resource as never,
    req.body.amount,
    req.body.priceRations,
    req.body.provinceId
  );
  return { order: o, ...game.snapshot(id) };
});

app.post<{ Body: { orderId: string } }>("/api/market/accept", async (req) => {
  const id = auth(req);
  game.acceptMarket(id, req.body.orderId);
  return game.snapshot(id);
});

app.post<{
  Body: {
    give: { resource: string; amount: number }[];
    want: { resource: string; amount: number }[];
    channel?: "trade" | "province" | "private";
  };
}>("/api/offers", async (req) => {
  const id = auth(req);
  const offer = game.postOffer(
    id,
    req.body.give as never,
    req.body.want as never,
    req.body.channel ?? "trade"
  );
  return { offer, ...game.snapshot(id) };
});

app.post<{ Body: { offerId: string; acceptKey?: string } }>(
  "/api/offers/accept",
  async (req) => {
    const id = auth(req);
    game.acceptOffer(id, req.body.offerId, req.body.acceptKey);
    return game.snapshot(id);
  }
);

app.post<{
  Body: {
    toName: string;
    attachments: { resource: string; amount: number }[];
    subject?: string;
    body?: string;
  };
}>("/api/gift", async (req) => {
  const id = auth(req);
  const mail = game.sendGift(
    id,
    req.body.toName,
    req.body.attachments as never,
    req.body.subject ?? "",
    req.body.body ?? ""
  );
  const snap = game.snapshot(id);
  return { ...snap, mail };
});

app.post<{ Body: { mailId: string } }>("/api/mail/accept", async (req) => {
  const id = auth(req);
  game.acceptMail(id, req.body.mailId);
  return game.snapshot(id);
});

app.post<{
  Body: {
    channel: "general" | "trade" | "province" | "private";
    text: string;
    offerId?: string;
  };
}>("/api/chat", async (req) => {
  const id = auth(req);
  const msg = game.chat(id, req.body.channel, req.body.text, req.body.offerId);
  return { msg, ...game.snapshot(id) };
});

app.post<{ Body: { settlementId: string } }>("/api/barge/build", async (req) => {
  const id = auth(req);
  const barge = game.buildBarge(id, req.body.settlementId);
  return { barge, ...game.snapshot(id) };
});

app.post<{
  Body: {
    settlementId: string;
    bargeId: string;
    toSettlementId: string;
    cargo: { resource: string; amount: number }[];
  };
}>("/api/barge/launch", async (req) => {
  const id = auth(req);
  const barge = game.launchBarge(
    id,
    req.body.settlementId,
    req.body.bargeId,
    req.body.toSettlementId,
    req.body.cargo as never
  );
  return { barge, ...game.snapshot(id) };
});

app.post<{
  Body: { settlementId: string; kind: string; count?: number };
}>("/api/military/train", async (req) => {
  const id = auth(req);
  game.trainUnit(id, req.body.settlementId, req.body.kind as never, req.body.count ?? 1);
  return game.snapshot(id);
});

app.post<{
  Body: { settlementId: string; siteId: string };
}>("/api/monument/capture", async (req) => {
  const id = auth(req);
  game.captureMonument(id, req.body.settlementId, req.body.siteId);
  return game.snapshot(id);
});

app.post<{
  Body: { settlementId: string; siteId: string; workers: number };
}>("/api/monument/workers", async (req) => {
  const id = auth(req);
  game.assignMonumentWorkers(
    id,
    req.body.settlementId,
    req.body.siteId,
    req.body.workers
  );
  return game.snapshot(id);
});

app.post<{ Body: { siteId: string; name: string } }>("/api/found", async (req) => {
  const id = auth(req);
  const settlement = game.foundSettlement(id, req.body.siteId, req.body.name);
  return { settlement, ...game.snapshot(id) };
});

app.post<{ Body: { settlementId: string; amount: number } }>(
  "/api/shrine",
  async (req) => {
    const id = auth(req);
    game.contributeShrine(id, req.body.settlementId, req.body.amount);
    return game.snapshot(id);
  }
);

app.post<{ Body: { settlementId: string } }>("/api/envoy", async (req) => {
  const id = auth(req);
  game.dispatchEnvoy(id, req.body.settlementId);
  return game.snapshot(id);
});

app.post("/api/ascend", async (req) => {
  const id = auth(req);
  game.ascend(id);
  return { ok: true };
});

app.post<{ Body: { settlementId: string; dataUrl: string } }>(
  "/api/postcard",
  async (req) => {
    const id = auth(req);
    const card = game.savePostcard(id, req.body.settlementId, req.body.dataUrl);
    return { card };
  }
);

app.get<{ Params: { id: string } }>("/api/visit/:id", async (req) => {
  return game.visitSettlement(req.params.id);
});

app.post<{ Body: { hours: number } }>("/api/debug/advance", async (req) => {
  const id = auth(req);
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEBUG !== "1") {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
  const summary = game.debugAdvance(id, req.body.hours ?? 1);
  // snapshot without a second tick: pull player state only via another debug path
  // re-tick would report ~0h; attach the catch-up summary explicitly
  const snap = game.snapshot(id);
  return { ...snap, tickSummary: summary, summary };
});

app.post<{ Body: { resource: string; amount: number } }>(
  "/api/debug/grant",
  async (req) => {
    const id = auth(req);
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEBUG !== "1") {
      throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    }
    game.adminGrant(id, req.body.resource as never, req.body.amount);
    return game.snapshot(id);
  }
);

// --- Prompt 01.5 routes ---
app.post<{ Body: { settlementId: string } }>("/api/workers/suggest", async (req) => {
  const id = auth(req);
  game.applySuggestedWorkers(id, req.body.settlementId);
  return game.snapshot(id);
});

app.post<{ Body: { pause: boolean } }>("/api/production/pause", async (req) => {
  const id = auth(req);
  game.setPauseNonEssential(id, !!req.body.pause);
  return game.snapshot(id);
});

app.post<{ Body: { step: number } }>("/api/tutorial/step", async (req) => {
  const id = auth(req);
  game.setTutorialStep(id, req.body.step ?? 0);
  return game.snapshot(id);
});

app.post("/api/tutorial/dismiss-goals", async (req) => {
  const id = auth(req);
  game.dismissGoals(id);
  return game.snapshot(id);
});

app.post<{ Body: { goal: string } }>("/api/tutorial/goal", async (req) => {
  const id = auth(req);
  game.markTutorialGoal(id, req.body.goal as never);
  return game.snapshot(id);
});

app.post<{
  Body: {
    name: string;
    give: { resource: string; amount: number }[];
    want: { resource: string; amount: number }[];
  };
}>("/api/templates", async (req) => {
  const id = auth(req);
  const t = game.saveOfferTemplate(
    id,
    req.body.name,
    req.body.give as never,
    req.body.want as never
  );
  return { template: t, ...game.snapshot(id) };
});

app.post<{ Body: { partnerId: string; add: boolean } }>(
  "/api/partners",
  async (req) => {
    const id = auth(req);
    game.setPreferredPartner(id, req.body.partnerId, !!req.body.add);
    return game.snapshot(id);
  }
);

app.post<{ Body: { targetId: string; mute: boolean } }>("/api/mute", async (req) => {
  const id = auth(req);
  game.mutePlayer(id, req.body.targetId, !!req.body.mute);
  return game.snapshot(id);
});

app.post<{ Body: Record<string, boolean> }>("/api/notify-prefs", async (req) => {
  const id = auth(req);
  game.updateNotifyPrefs(id, req.body as never);
  return game.snapshot(id);
});

app.post("/api/notifications/read", async (req) => {
  const id = auth(req);
  game.markNotificationsRead(id);
  return game.snapshot(id);
});

app.post<{ Body: { email: string } }>("/api/account/email", async (req) => {
  const id = auth(req);
  game.setEmail(id, req.body.email);
  return game.snapshot(id);
});

app.post("/api/account/totp/setup", async (req) => {
  const id = auth(req);
  return game.setupTotp(id);
});

app.post<{ Body: { code: string } }>("/api/account/totp/enable", async (req) => {
  const id = auth(req);
  game.enableTotp(id, req.body.code);
  return game.snapshot(id);
});

app.post<{ Body: { name: string; password: string; code?: string } }>(
  "/api/login-2fa",
  async (req) => game.loginWithTotp(req.body.name, req.body.password, req.body.code)
);

app.get("/api/circles", async () => game.listCircles());

app.post<{ Body: { name: string } }>("/api/circles", async (req) => {
  const id = auth(req);
  const c = game.createCircle(id, req.body.name);
  return { circle: c, ...game.snapshot(id) };
});

app.post<{ Body: { circleId: string } }>("/api/circles/join", async (req) => {
  const id = auth(req);
  const c = game.joinCircle(id, req.body.circleId);
  return { circle: c, ...game.snapshot(id) };
});

app.post<{ Body: { circleId: string; text: string } }>(
  "/api/circles/post",
  async (req) => {
    const id = auth(req);
    const msg = game.postCircleBoard(id, req.body.circleId, req.body.text);
    return { msg, ...game.snapshot(id) };
  }
);

app.post<{ Body: { slot: string; cosmeticId: string } }>(
  "/api/cosmetics/equip",
  async (req) => {
    const id = auth(req);
    game.equipCosmetic(id, req.body.slot, req.body.cosmeticId);
    return game.snapshot(id);
  }
);

app.post<{ Body: { cosmeticId: string; sealCost?: number } }>(
  "/api/cosmetics/purchase",
  async (req) => {
    const id = auth(req);
    game.purchaseCosmetic(id, req.body.cosmeticId, req.body.sealCost ?? 0);
    return game.snapshot(id);
  }
);

app.get("/api/seasonal", async () => game.ensureSeasonalEvent());

app.post<{ Body: { amount: number } }>("/api/seasonal/contribute", async (req) => {
  const id = auth(req);
  const ev = game.contributeSeasonal(id, req.body.amount ?? 0);
  return { event: ev, ...game.snapshot(id) };
});

app.get<{ Querystring: { since?: string } }>("/api/poll", async (req) => {
  const id = auth(req);
  const since = Number(req.query.since ?? 0);
  return game.longPoll(id, since);
});

// WebSocket: snapshots + live events (chat, trade, barge, notify)
app.register(async (instance) => {
  instance.get("/ws", { websocket: true }, (socket, req) => {
    const url = new URL(req.url, "http://localhost");
    const token = url.searchParams.get("token") ?? "";
    const playerId = game.playerIdFromToken(token);
    if (!playerId) {
      socket.close();
      return;
    }
    const send = (obj: unknown) => {
      try {
        socket.send(JSON.stringify(obj));
      } catch {
        /* closed */
      }
    };
    send({ type: "snapshot", data: game.snapshot(playerId) });
    const unsub = game.onEvent((ev) => {
      if (ev.type === "chat") send({ type: "event", event: ev });
      if (ev.type === "tick" && ev.playerId === playerId) {
        send({ type: "event", event: ev });
      }
      if (ev.type === "trade" && ev.playerIds.includes(playerId)) {
        send({ type: "event", event: ev });
        send({ type: "snapshot", data: game.snapshot(playerId) });
      }
      if (ev.type === "barge" && ev.playerIds.includes(playerId)) {
        send({ type: "event", event: ev });
      }
      if (ev.type === "notify" && ev.playerId === playerId) {
        send({ type: "event", event: ev });
      }
    });
    const iv = setInterval(() => {
      send({ type: "ping", t: Date.now() });
    }, 20_000);
    socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === "ping" || msg.type === "refresh") {
          send({ type: "snapshot", data: game.snapshot(playerId) });
        }
      } catch {
        /* ignore */
      }
    });
    socket.on("close", () => {
      clearInterval(iv);
      unsub();
    });
  });
});

let shuttingDown = false;
/**
 * Stop accepting requests, then flush. store.close() clears the 5s save interval before it
 * writes and every write inside it is synchronous + fsynced, so exiting right after it
 * returns cannot truncate or lose the last mutations.
 */
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info(`${signal} received — flushing world to disk`);
  try {
    await app.close();
  } catch {
    /* closing the listener must never block the final save */
  }
  try {
    game.store.close();
  } catch (err) {
    app.log.error(`final save FAILED: ${(err as Error).message}`);
    process.exit(1);
  }
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
// Last-ditch save: a crashing process still owns unsaved player progress.
process.on("uncaughtException", (err) => {
  app.log.error(`uncaught exception: ${err?.message}`);
  try {
    game.store.close();
  } catch {
    /* nothing left to try */
  }
  process.exit(1);
});

await app.listen({ port: PORT, host: HOST });
console.log(`Immortal Shores server on http://${HOST}:${PORT}`);
