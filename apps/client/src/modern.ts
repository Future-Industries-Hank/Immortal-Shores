/**
 * Prompt 01.5 UX: tutorial, production overlay, ration warnings, live channel.
 * Also hosts the shared etched-gold inline-SVG glyph set used across the UI.
 */
import type { PublicSnapshot } from "@immortal/shared";
import { BUILDING_TITLE, RESOURCE_LABELS, greatHouseUpgradeCost } from "@immortal/shared";
import { api, getToken } from "./api.js";

/* ── Etched-gold glyph set (single line style, currentColor) ────── */

const G = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

/** Core drawn glyphs. One stroke style — no emoji, no dingbats. */
export const GLYPHS: Record<string, string> = {
  wheat: G(
    '<path d="M12 21V6"/><path d="M12 6c-.8-1.2-.8-2.6 0-4 .8 1.4.8 2.8 0 4z"/><path d="M12 10C10 9.5 8.6 8 8 5.8 10 6.3 11.4 7.8 12 10zM12 10c2-.5 3.4-2 4-4.2C14 6.3 12.6 7.8 12 10zM12 15c-2-.5-3.4-2-4-4.2 2 .5 3.4 2 4 4.2zM12 15c2-.5 3.4-2 4-4.2-2 .5-3.4 2-4 4.2z"/>'
  ),
  clay: G(
    '<path d="M5 18c0-4 3-7 7-7s7 3 7 7"/><path d="M3.5 18h17M9 11.2c0-1.8 1.2-3.2 3-3.2s3 1.4 3 3.2"/>'
  ),
  reeds: G(
    '<path d="M7.5 21C8 15 7.8 10 6.5 5.5M12 21c.5-7 .5-12.5 0-16.5M16.5 21c-.5-6-.3-11 1-15.5"/><ellipse cx="12" cy="4" rx="1.3" ry="2.3"/>'
  ),
  loaf: G(
    '<path d="M4 16c0-4.5 3.6-7.5 8-7.5s8 3 8 7.5c0 .9-.7 1.5-1.5 1.5h-13c-.8 0-1.5-.6-1.5-1.5z"/><path d="M8.5 13l1.5-1.6M11.2 12.6l1.6-1.7M14 13l1.4-1.5"/>'
  ),
  brick: G(
    '<rect x="4" y="13" width="7.5" height="4.5" rx="0.5"/><rect x="12.5" y="13" width="7.5" height="4.5" rx="0.5"/><rect x="8" y="8" width="8" height="4.5" rx="0.5"/>'
  ),
  hide: G(
    '<path d="M6 4.5C7.5 6 9.5 6.5 12 6.5S16.5 6 18 4.5c1 2 1.5 4 .8 6 1 1.5 1.2 3.4.5 5.5-1.5-.4-2.8-.3-4 .3-.6 1.8-1.7 3-3.3 3.5-1.6-.5-2.7-1.7-3.3-3.5-1.2-.6-2.5-.7-4-.3-.7-2.1-.5-4 .5-5.5-.7-2-.2-4 .8-6z"/>'
  ),
  ingot: G(
    '<path d="M4.5 7C7 8.5 9.5 9 12 9s5-.5 7.5-2c1 3.3 1 6.7 0 10-2.5-1.5-5-2-7.5-2s-5 .5-7.5 2c-1-3.3-1-6.7 0-10z"/>'
  ),
  log: G(
    '<ellipse cx="7" cy="12" rx="3" ry="3.6"/><path d="M7 8.4h10c1.9 0 3.5 1.6 3.5 3.6s-1.6 3.6-3.5 3.6H7"/><circle cx="7" cy="12" r="1.1"/>'
  ),
  ochre: G(
    '<path d="M4.5 13h15c-.6 3.6-3.6 6-7.5 6s-6.9-2.4-7.5-6z"/><path d="M8 13c.4-2.3 2-4 4-4s3.6 1.7 4 4"/>'
  ),
  eye: G(
    '<path d="M3.5 12c2.5-3.5 5.5-5.2 8.5-5.2s6 1.7 8.5 5.2c-2.5 3.5-5.5 5.2-8.5 5.2S6 15.5 3.5 12z"/><circle cx="12" cy="12" r="2.6"/>'
  ),
  amphora: G(
    '<path d="M9.5 3h5"/><path d="M10 3c.3 1.8-.3 3-1.4 4.3C7.2 8.9 6.7 11 7.4 13.2 8.2 15.8 9.9 17.5 12 17.5s3.8-1.7 4.6-4.3c.7-2.2.2-4.3-1.2-5.9C14.3 6 13.7 4.8 14 3"/><path d="M12 17.5V21M10 21h4"/>'
  ),
  basket: G(
    '<path d="M5 10h14l-1.5 8h-11L5 10z"/><path d="M8 10c0-2.5 1.7-4.5 4-4.5s4 2 4 4.5M7 13.5h10M6.6 16.5h10.8"/>'
  ),
  cartouche: G(
    '<rect x="5.5" y="3.5" width="13" height="17" rx="6.5"/><path d="M9.5 9.5h5M9.5 13h5"/>'
  ),
  seal: G('<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3"/>'),
  ziggurat: G('<path d="M4 20h16M6 20v-4h12v4M8 16v-4h8v4M10 12V8h4v4"/>'),
  obelisk: G('<path d="M10 20l1-14 1-2.5L14 6l1 14M7 20h10M10.6 10.5h2.8"/>'),
  flag: G('<path d="M6 21V4M6 4h9.5l-2.7 3.2L15.5 10H6"/>'),
  stall: G('<path d="M4.5 9L6 5h12l1.5 4M4 9h16M6 9v11h12V9M9.5 20v-5.5h5V20"/>'),
  hut: G('<path d="M3.5 20h17M5.5 20v-8.5L12 5l6.5 6.5V20M9.5 20v-6h5v6"/>'),
  barge: G(
    '<path d="M3 14.5h18c-.5 2.6-3 4.5-6 4.5H9c-3 0-5.5-1.9-6-4.5z"/><path d="M7 14.5V12h10v2.5M12 12V5.5M12 5.5c2.8.6 4.5 2.4 5 4.5"/>'
  ),
  crates: G(
    '<rect x="4" y="12" width="7" height="7" rx="0.5"/><rect x="13" y="12" width="7" height="7" rx="0.5"/><rect x="8.5" y="5" width="7" height="7" rx="0.5"/>'
  ),
  spear: G('<path d="M4 20l9.8-9.8"/><path d="M13 6.5L17.5 4 20 8.5l-3.6 2.7-3.4-4.7z"/>'),
  trowel: G(
    '<path d="M13.5 10.5L20 4"/><path d="M13.8 10.2l-8.6 3.1c-1.5.6-1.8 2.6-.6 3.7l2.4 2.4c1.1 1.2 3.1.9 3.7-.6l3.1-8.6z"/>'
  ),
  /* Recurve bow: vertical string, curved limb, arrow through it with head + fletching */
  bow: G(
    '<path d="M7.5 3.5c4.2 5.3 4.2 11.7 0 17"/><path d="M7.5 3.5v17"/><path d="M3.5 12h16"/><path d="M15.9 8.6l3.6 3.4-3.6 3.4"/><path d="M3.5 12l2.7-2.3M3.5 12l2.7 2.3"/>'
  ),
  /* Spear behind a round shield with boss — infantry, not a key */
  spearshield: G(
    '<path d="M13.2 10.8L20.5 3.5"/><path d="M20.5 3.5l-4 .9M20.5 3.5l-.9 4"/><circle cx="9.5" cy="14.5" r="6"/><circle cx="9.5" cy="14.5" r="1.3"/>'
  ),
  /* Chariot wheel: rim, hub, eight spokes stopping at the hub */
  wheel: G(
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.2"/><path d="M12 4v5.8M12 14.2V20M4 12h5.8M14.2 12H20M6.3 6.3l4.1 4.1M17.7 6.3l-4.1 4.1M6.3 17.7l4.1-4.1M17.7 17.7l-4.1-4.1"/>'
  ),
  lock: G(
    '<rect x="6" y="10.5" width="12" height="9" rx="1.8"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><path d="M12 14v2.5"/>'
  ),
  scribe: G(
    '<rect x="4" y="4.5" width="10" height="15" rx="1.5"/><path d="M7 9h4M7 12.5h4M7 16h2.5"/><path d="M20.5 6L15 11.5l-.5 2.7 2.7-.5L22.5 8 20.5 6z"/>'
  ),
  shrine: G('<path d="M5 20h14M6.5 20V9h11v11M4.5 9L12 4l7.5 5M10 20v-5h4v5"/>'),
  handshake: G('<circle cx="8.8" cy="12" r="4.8"/><circle cx="15.2" cy="12" r="4.8"/>'),
};

/** Resource id → drawn glyph (no emoji, ever). */
const RESOURCE_GLYPH: Record<string, string> = {
  emmer: "wheat",
  river_clay: "clay",
  marsh_reeds: "reeds",
  rations: "loaf",
  mudbricks: "brick",
  vessels: "amphora",
  reed_baskets: "basket",
  limestone: "cartouche",
  hides: "hide",
  bronze: "ingot",
  cedarwood: "log",
  red_ochre: "ochre",
  eye_paint: "eye",
  sacred_oil: "amphora",
  green_stones: "cartouche",
  royal_gold: "cartouche",
  fine_sandals: "cartouche",
  stone_idols: "obelisk",
  eye_cosmetics: "eye",
  sacred_perfume: "amphora",
  amulets: "cartouche",
  seals: "seal",
};

export function resourceIcon(r: string): string {
  return GLYPHS[RESOURCE_GLYPH[r] ?? "cartouche"] ?? GLYPHS.cartouche!;
}

/** GLYPHS key for a resource — for popup headers that take glyphName. */
export function resourceGlyphName(r: string): string {
  return RESOURCE_GLYPH[r] ?? "cartouche";
}

/** Full short display names — no machine mangles like "RiCl". */
export const RESOURCE_SHORT: Record<string, string> = {
  emmer: "Emmer",
  river_clay: "Clay",
  marsh_reeds: "Reeds",
  rations: "Rations",
  mudbricks: "Bricks",
  vessels: "Vessels",
  reed_baskets: "Baskets",
  limestone: "Limestone",
  hides: "Hides",
  bronze: "Bronze",
  cedarwood: "Cedar",
  red_ochre: "Ochre",
  eye_paint: "Eye Paint",
  sacred_oil: "Oil",
  green_stones: "Stones",
  royal_gold: "Gold",
  fine_sandals: "Sandals",
  stone_idols: "Idols",
  eye_cosmetics: "Kohl",
  sacred_perfume: "Perfume",
  amulets: "Amulets",
  seals: "Seals",
};

export function resourceShort(r: string): string {
  return RESOURCE_SHORT[r] ?? (RESOURCE_LABELS as Record<string, string>)[r] ?? r;
}

const BUILDING_GLYPH: Record<string, string> = {
  great_house: "ziggurat",
  market: "stall",
  emmer_field: "wheat",
  river_clay_pit: "clay",
  marsh_reed_bed: "reeds",
  ration_house: "loaf",
  mudbrick_yard: "brick",
  vessel_shop: "amphora",
  reed_basket_shop: "basket",
  luxury_material: "cartouche",
  luxury_workshop: "cartouche",
  warehouse: "crates",
  shrine: "shrine",
  harbor: "barge",
  training_grounds: "spear",
};

export function buildingIcon(kind: string): string {
  return GLYPHS[BUILDING_GLYPH[kind] ?? "hut"] ?? GLYPHS.hut!;
}

export const UNIT_GLYPH: Record<string, string> = {
  bowmen: "bow",
  spearmen: "spearshield",
  chariot_warriors: "wheel",
};

/** Level pip row (diamond pips, filled up to `level`). */
export function levelPips(level: number, max = 8): string {
  const shown = Math.max(max, Math.min(level, 12));
  let out = "";
  for (let i = 1; i <= shown; i++) {
    out += `<i class="${i <= level ? "on" : ""}"></i>`;
  }
  return `<span class="lvl-pips" title="Level ${level}">${out}</span>`;
}

/* ── Live channel plumbing ──────────────────────────────────────── */

let pollSince = 0;
let ws: WebSocket | null = null;
let onSnap: ((s: PublicSnapshot) => void) | null = null;
let onToast: ((m: string) => void) | null = null;

export function initModern(handlers: {
  onSnapshot: (s: PublicSnapshot) => void;
  onToast: (m: string) => void;
}) {
  onSnap = handlers.onSnapshot;
  onToast = handlers.onToast;
  registerPwa();
  connectLive();
}

function registerPwa() {
  if (!("serviceWorker" in navigator)) return;
  // Only register outside pure Vite HMR pain — still works in prod build
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* dev without public root is fine */
    });
  });
}

function connectLive() {
  const token = getToken();
  if (!token) return;
  // WebSocket primary
  try {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`;
    ws = new WebSocket(url);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg.type === "snapshot" && msg.data) onSnap?.(msg.data);
        if (msg.type === "event" && msg.event?.type === "notify") {
          onToast?.(msg.event.payload?.title ?? "Notification");
        }
        if (msg.type === "event" && msg.event?.type === "chat") {
          /* soft refresh via poll/snapshot */
        }
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      ws = null;
      // long-poll fallback
      startLongPoll();
    };
  } catch {
    startLongPoll();
  }
}

function startLongPoll() {
  const tick = async () => {
    if (!getToken()) return;
    try {
      const data = await api.poll(pollSince);
      pollSince = data.serverTime;
      if (data.notifications?.length) {
        const n = data.notifications[data.notifications.length - 1] as {
          title?: string;
        };
        if (n.title) onToast?.(n.title);
      }
    } catch {
      /* offline */
    }
    setTimeout(tick, 8000);
  };
  tick();
}

export function renderModernHud(s: PublicSnapshot) {
  renderRationWarn(s);
  renderProdOverlay(s);
  renderTutorial(s);
  renderGoals(s);
}

function renderRationWarn(s: PublicSnapshot) {
  const el = document.getElementById("ration-warn");
  if (!el) return;
  const h = s.hoursUntilRationEmpty;
  if (h == null) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  if (h <= 2) {
    el.className = "ration-warn red";
    el.textContent = `Rations critical — empty in ~${h.toFixed(1)}h`;
  } else if (h <= 8) {
    el.className = "ration-warn yellow";
    el.textContent = `Rations low — ~${h.toFixed(1)}h until empty`;
  } else {
    el.hidden = true;
  }
}

function renderProdOverlay(s: PublicSnapshot) {
  const el = document.getElementById("prod-overlay");
  if (!el) return;
  const open = localStorage.getItem("prod_overlay") === "1";
  if (!open || !s.production?.length) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const titles = BUILDING_TITLE as Record<string, string>;
  const rows = s.production
    .filter((p) => p.workers > 0 || p.cap > 0)
    .map(
      (p) =>
        `<tr class="${p.paused ? "is-paused" : ""}">
          <td>${titles[p.kind] ?? p.kind.replace(/_/g, " ")}</td>
          <td>${p.workers}/${p.cap}</td>
          <td>${p.outputPerHour.toFixed(1)}${p.outputResource ? " " + (RESOURCE_LABELS[p.outputResource] ?? "") : ""}/h</td>
          <td class="drain">−${p.rationDrainPerHour.toFixed(1)}</td>
          <td>${p.paused ? "paused" : ""}</td>
        </tr>`
    )
    .join("");
  el.innerHTML = `
    <strong>Production</strong>
    <table>
      <tr><th>Building</th><th>Workers</th><th>Output</th><th>Drain</th><th></th></tr>
      ${rows}
    </table>
  `;
}

const TUTORIAL_STEPS = [
  {
    title: "Welcome to your shore",
    body: "You have limited plots. First, place a Mudbrick Yard on a Shop pad (sand-colored) — bricks fund every future building.",
  },
  {
    title: "Feed your people",
    body: "Place a Ration House on another Shop pad. Assign Workers to Emmer Field and the Ration House so Rations keep flowing.",
  },
  {
    title: "Your unique luxury",
    body: "This settlement can only produce one unique luxury. Build Luxury Works on its Special pad to produce yours — you must trade for the rest.",
  },
  {
    title: "Trust-based trade",
    body: "Post a Tablet Wall offer or accept one. There is no bank escrow: honest deals settle atomically when the taker accepts. Free chat never moves goods.",
  },
  {
    title: "Great House climb",
    body: "GH upgrades need Mudbricks, Vessels, Baskets, and later multiple luxuries. That is why neighbors in your Province matter.",
  },
];

function renderTutorial(s: PublicSnapshot) {
  const el = document.getElementById("tutorial");
  if (!el) return;
  const t = s.player.tutorial;
  if (!t || t.completed || t.step >= TUTORIAL_STEPS.length) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const step = TUTORIAL_STEPS[t.step] ?? TUTORIAL_STEPS[0]!;
  const dots = TUTORIAL_STEPS.map(
    (_, i) => `<i class="${i <= t.step ? "on" : ""}"></i>`
  ).join("");
  el.innerHTML = `
    <h2>${GLYPHS.scribe}${step.title}</h2>
    <p>${step.body}</p>
    <div class="tut-dots" title="Step ${t.step + 1} of ${TUTORIAL_STEPS.length}">${dots}</div>
    <div class="actions">
      <button type="button" class="small primary" id="tut-next">Continue</button>
      <button type="button" class="small linklike" id="tut-skip">Skip tutorial</button>
    </div>
  `;
  el.querySelector("#tut-next")?.addEventListener("click", async () => {
    const next = t.step + 1;
    try {
      onSnap?.(await api.tutorialStep(next));
    } catch (e) {
      onToast?.((e as Error).message);
    }
  });
  el.querySelector("#tut-skip")?.addEventListener("click", async () => {
    try {
      onSnap?.(await api.tutorialStep(99));
    } catch (e) {
      onToast?.((e as Error).message);
    }
  });
}

function renderGoals(s: PublicSnapshot) {
  const el = document.getElementById("goals");
  if (!el) return;
  const t = s.player.tutorial;
  if (!t || t.dismissedGoals || !t.completed) {
    // show after tutorial, or if tutorial skipped (step 99)
    if (!t || t.dismissedGoals) {
      el.hidden = true;
      return;
    }
    if (!t.completed && t.step < TUTORIAL_STEPS.length) {
      el.hidden = true;
      return;
    }
  }
  if (t.dismissedGoals) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const g = t.goals;
  const entries: [boolean, string][] = [
    [g.mudbrickYard, "Build Mudbrick Yard"],
    [g.rationHouse, "Build Ration House"],
    [g.assignWorkers, "Assign Workers"],
    [g.luxuryLesson, "Place Luxury Works"],
    [g.firstTrade, "Complete a trade"],
    [g.seeGhUpgrade, "Review GH upgrade path"],
  ];
  const doneCount = entries.filter(([d]) => d).length;
  const item = (done: boolean, label: string) =>
    `<div class="goal-row ${done ? "done" : ""}"><span class="goal-seal ${done ? "on" : ""}"></span>${label}</div>`;
  const cost = greatHouseUpgradeCost(2);
  el.innerHTML = `
    <div class="goals-head">
      <strong>First Week</strong>
      <span class="goals-ring">${doneCount}/${entries.length}</span>
    </div>
    ${entries.map(([d, l]) => item(d, l)).join("")}
    <p class="muted">GH L2 needs: ${cost.map((c) => `${c.amount} ${resourceShort(c.resource)}`).join(", ")}</p>
    <button type="button" class="small linklike" id="goals-dismiss">Dismiss</button>
  `;
  el.querySelector("#goals-dismiss")?.addEventListener("click", async () => {
    try {
      onSnap?.(await api.dismissGoals());
    } catch (e) {
      onToast?.((e as Error).message);
    }
  });
}

/** Basic markdown + emoji passthrough for chat lines */
export function formatChatHtml(text: string): string {
  let t = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*(.+?)\*/g, "<em>$1</em>");
  t = t.replace(/@([A-Za-z0-9_]+)/g, '<span class="mention">@$1</span>');
  return t;
}

export function toggleProdOverlay() {
  const cur = localStorage.getItem("prod_overlay") === "1";
  localStorage.setItem("prod_overlay", cur ? "0" : "1");
}

export function applyAppearance(s: PublicSnapshot) {
  const dark = s.player.prefs?.darkMode || localStorage.getItem("dark") === "1";
  const cb = s.player.prefs?.colorBlind || localStorage.getItem("cb") === "1";
  document.documentElement.classList.toggle("dark", !!dark);
  document.documentElement.classList.toggle("cb", !!cb);
}
