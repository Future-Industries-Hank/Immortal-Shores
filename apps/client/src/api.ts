import type { PublicSnapshot, ResourceId, ResourceStack } from "@immortal/shared";

const TOKEN_KEY = "immortal_token";

// iOS Safari private browsing throws on localStorage access instead of returning null,
// and mobile browsers evict storage under pressure. Probe once, then keep a memory copy
// so a storage failure degrades to "logged in for this tab" instead of a hard crash.
const storage: Storage | null = (() => {
  try {
    const s = window.localStorage;
    s.setItem(`${TOKEN_KEY}__probe`, "1");
    s.removeItem(`${TOKEN_KEY}__probe`);
    return s;
  } catch {
    return null;
  }
})();

let memoryToken: string | null = null;

export function getToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    memoryToken = storage?.getItem(TOKEN_KEY) ?? null;
  } catch {
    memoryToken = null;
  }
  return memoryToken;
}

export function setToken(token: string | null) {
  memoryToken = token;
  try {
    if (token) storage?.setItem(TOKEN_KEY, token);
    else storage?.removeItem(TOKEN_KEY);
  } catch {
    /* evicted or quota-full — the in-memory token still carries this tab */
  }
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

let authMessage: string | null = null;

/** Reason the last session ended, for the login screen. Reading it clears it. */
export function takeAuthMessage(): string | null {
  const msg = authMessage;
  authMessage = null;
  return msg;
}

async function req<T>(
  path: string,
  opts: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, {
    ...opts,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    // Expired or rejected token: drop it so the app falls back to the login screen
    // with a reason instead of retrying a dead session forever.
    setToken(null);
    authMessage = "Your session expired. Sign in to return to your settlement.";
    window.dispatchEvent(
      new CustomEvent("immortal:signed-out", { detail: authMessage })
    );
    throw new ApiError(401, data.error || authMessage);
  }
  if (!res.ok) throw new ApiError(res.status, data.error || res.statusText);
  return data as T;
}

export const api = {
  register: (name: string, password: string) =>
    req<{ token: string; playerId: string }>("/api/register", {
      method: "POST",
      json: { name, password },
    }),
  login: (name: string, password: string) =>
    req<{ token: string; playerId: string }>("/api/login", {
      method: "POST",
      json: { name, password },
    }),
  me: () => req<PublicSnapshot>("/api/me"),
  workers: (settlementId: string, buildingId: string, workers: number) =>
    req<PublicSnapshot>("/api/workers", {
      method: "POST",
      json: { settlementId, buildingId, workers },
    }),
  construct: (
    settlementId: string,
    kind: string,
    buildingId?: string,
    plotId?: string
  ) =>
    req<PublicSnapshot>("/api/construct", {
      method: "POST",
      json: {
        settlementId,
        kind,
        buildingId,
        plotId,
      },
    }),
  cancelConstruct: (settlementId: string) =>
    req<PublicSnapshot>("/api/construct/cancel", {
      method: "POST",
      json: { settlementId },
    }),
  market: (
    resource: ResourceId,
    amount: number,
    priceRations: number,
    provinceId: string
  ) =>
    req<PublicSnapshot>("/api/market", {
      method: "POST",
      json: { resource, amount, priceRations, provinceId },
    }),
  acceptMarket: (orderId: string) =>
    req<PublicSnapshot>("/api/market/accept", {
      method: "POST",
      json: { orderId },
    }),
  postOffer: (give: ResourceStack[], want: ResourceStack[]) =>
    req<PublicSnapshot>("/api/offers", {
      method: "POST",
      json: { give, want, channel: "trade" },
    }),
  acceptOffer: (offerId: string) =>
    req<PublicSnapshot>("/api/offers/accept", {
      method: "POST",
      json: { offerId, acceptKey: crypto.randomUUID() },
    }),
  gift: (toName: string, attachments: ResourceStack[], subject: string) =>
    req<PublicSnapshot>("/api/gift", {
      method: "POST",
      json: { toName, attachments, subject },
    }),
  acceptMail: (mailId: string) =>
    req<PublicSnapshot>("/api/mail/accept", {
      method: "POST",
      json: { mailId },
    }),
  chat: (channel: "general" | "trade" | "province" | "private", text: string) =>
    req<PublicSnapshot>("/api/chat", {
      method: "POST",
      json: { channel, text },
    }),
  buildBarge: (settlementId: string) =>
    req<PublicSnapshot>("/api/barge/build", {
      method: "POST",
      json: { settlementId },
    }),
  launchBarge: (
    settlementId: string,
    bargeId: string,
    toSettlementId: string,
    cargo: ResourceStack[]
  ) =>
    req<PublicSnapshot>("/api/barge/launch", {
      method: "POST",
      json: { settlementId, bargeId, toSettlementId, cargo },
    }),
  train: (settlementId: string, kind: string) =>
    req<PublicSnapshot>("/api/military/train", {
      method: "POST",
      json: { settlementId, kind, count: 1 },
    }),
  capture: (settlementId: string, siteId: string) =>
    req<PublicSnapshot>("/api/monument/capture", {
      method: "POST",
      json: { settlementId, siteId },
    }),
  monumentWorkers: (settlementId: string, siteId: string, workers: number) =>
    req<PublicSnapshot>("/api/monument/workers", {
      method: "POST",
      json: { settlementId, siteId, workers },
    }),
  found: (siteId: string, name: string) =>
    req<PublicSnapshot>("/api/found", {
      method: "POST",
      json: { siteId, name },
    }),
  shrine: (settlementId: string, amount: number) =>
    req<PublicSnapshot>("/api/shrine", {
      method: "POST",
      json: { settlementId, amount },
    }),
  envoy: (settlementId: string) =>
    req<PublicSnapshot>("/api/envoy", {
      method: "POST",
      json: { settlementId },
    }),
  postcard: (settlementId: string, dataUrl: string) =>
    req<{ card: unknown }>("/api/postcard", {
      method: "POST",
      json: { settlementId, dataUrl },
    }),
  visit: (id: string) => req<unknown>(`/api/visit/${id}`),
  advance: (hours: number) =>
    req<PublicSnapshot>("/api/debug/advance", {
      method: "POST",
      json: { hours },
    }),
  grant: (resource: string, amount: number) =>
    req<PublicSnapshot>("/api/debug/grant", {
      method: "POST",
      json: { resource, amount },
    }),
  suggestWorkers: (settlementId: string) =>
    req<PublicSnapshot>("/api/workers/suggest", {
      method: "POST",
      json: { settlementId },
    }),
  pauseProduction: (pause: boolean) =>
    req<PublicSnapshot>("/api/production/pause", {
      method: "POST",
      json: { pause },
    }),
  tutorialStep: (step: number) =>
    req<PublicSnapshot>("/api/tutorial/step", {
      method: "POST",
      json: { step },
    }),
  tutorialGoal: (goal: string) =>
    req<PublicSnapshot>("/api/tutorial/goal", {
      method: "POST",
      json: { goal },
    }),
  dismissGoals: () =>
    req<PublicSnapshot>("/api/tutorial/dismiss-goals", { method: "POST", json: {} }),
  saveTemplate: (
    name: string,
    give: ResourceStack[],
    want: ResourceStack[]
  ) =>
    req<PublicSnapshot>("/api/templates", {
      method: "POST",
      json: { name, give, want },
    }),
  partner: (partnerId: string, add: boolean) =>
    req<PublicSnapshot>("/api/partners", {
      method: "POST",
      json: { partnerId, add },
    }),
  mute: (targetId: string, mute: boolean) =>
    req<PublicSnapshot>("/api/mute", {
      method: "POST",
      json: { targetId, mute },
    }),
  notifyPrefs: (patch: Record<string, boolean>) =>
    req<PublicSnapshot>("/api/notify-prefs", {
      method: "POST",
      json: patch,
    }),
  readNotifications: () =>
    req<PublicSnapshot>("/api/notifications/read", { method: "POST", json: {} }),
  setEmail: (email: string) =>
    req<PublicSnapshot>("/api/account/email", {
      method: "POST",
      json: { email },
    }),
  totpSetup: () => req<{ secret: string; otpauth: string }>("/api/account/totp/setup", {
    method: "POST",
    json: {},
  }),
  totpEnable: (code: string) =>
    req<PublicSnapshot>("/api/account/totp/enable", {
      method: "POST",
      json: { code },
    }),
  login2fa: (name: string, password: string, code?: string) =>
    req<{ token: string; playerId: string }>("/api/login-2fa", {
      method: "POST",
      json: { name, password, code },
    }),
  listCircles: () =>
    req<{ id: string; name: string; members: number; max: number }[]>("/api/circles"),
  createCircle: (name: string) =>
    req<PublicSnapshot>("/api/circles", { method: "POST", json: { name } }),
  joinCircle: (circleId: string) =>
    req<PublicSnapshot>("/api/circles/join", {
      method: "POST",
      json: { circleId },
    }),
  circlePost: (circleId: string, text: string) =>
    req<PublicSnapshot>("/api/circles/post", {
      method: "POST",
      json: { circleId, text },
    }),
  equipCosmetic: (slot: string, cosmeticId: string) =>
    req<PublicSnapshot>("/api/cosmetics/equip", {
      method: "POST",
      json: { slot, cosmeticId },
    }),
  purchaseCosmetic: (cosmeticId: string, sealCost = 0) =>
    req<PublicSnapshot>("/api/cosmetics/purchase", {
      method: "POST",
      json: { cosmeticId, sealCost },
    }),
  seasonal: () => req<unknown>("/api/seasonal"),
  seasonalContribute: (amount: number) =>
    req<PublicSnapshot>("/api/seasonal/contribute", {
      method: "POST",
      json: { amount },
    }),
  poll: (since: number) =>
    req<{ serverTime: number; chat: unknown[]; notifications: unknown[] }>(
      `/api/poll?since=${since}`
    ),
};
