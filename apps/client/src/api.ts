import type { PublicSnapshot, ResourceId, ResourceStack } from "@immortal/shared";

const TOKEN_KEY = "immortal_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
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
  if (!res.ok) throw new Error(data.error || res.statusText);
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
  chat: (channel: "general" | "trade", text: string) =>
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
};
