/**
 * Prompt 01.5 UX: tutorial, production overlay, ration warnings, live channel.
 */
import type { PublicSnapshot } from "@immortal/shared";
import { RESOURCE_LABELS, greatHouseUpgradeCost } from "@immortal/shared";
import { api, getToken } from "./api.js";

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
  const rows = s.production
    .filter((p) => p.workers > 0 || p.cap > 0)
    .map(
      (p) =>
        `<tr>
          <td>${p.kind.replace(/_/g, " ")}</td>
          <td>${p.workers}/${p.cap}</td>
          <td>${p.outputPerHour.toFixed(1)}${p.outputResource ? " " + (RESOURCE_LABELS[p.outputResource] ?? "") : ""}/h</td>
          <td>−${p.rationDrainPerHour.toFixed(1)} rat</td>
          <td>${p.paused ? "paused" : ""}</td>
        </tr>`
    )
    .join("");
  el.innerHTML = `
    <strong>Production overlay</strong>
    <table>
      <tr><th>Building</th><th>W</th><th>Out</th><th>Drain</th><th></th></tr>
      ${rows}
    </table>
    <p class="muted">Dismissible QoL — toggle from Shore panel</p>
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
  el.innerHTML = `
    <h2>${step.title}</h2>
    <p>${step.body}</p>
    <p class="muted">Step ${t.step + 1} / ${TUTORIAL_STEPS.length}</p>
    <div class="actions">
      <button type="button" class="small" id="tut-next">Continue</button>
      <button type="button" class="small secondary" id="tut-skip">Skip tutorial</button>
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
  const item = (done: boolean, label: string) =>
    `<li class="${done ? "done" : ""}">${done ? "✓" : "○"} ${label}</li>`;
  const cost = greatHouseUpgradeCost(2);
  el.innerHTML = `
    <strong>First Week Goals</strong>
    <ul>
      ${item(g.mudbrickYard, "Build Mudbrick Yard")}
      ${item(g.rationHouse, "Build Ration House")}
      ${item(g.assignWorkers, "Assign Workers")}
      ${item(g.luxuryLesson, "Place Luxury Works")}
      ${item(g.firstTrade, "Complete a trade")}
      ${item(g.seeGhUpgrade, "Review GH upgrade path")}
    </ul>
    <p class="muted">GH L2 needs: ${cost.map((c) => `${c.amount} ${c.resource}`).join(", ")}</p>
    <button type="button" class="small secondary" id="goals-dismiss">Dismiss</button>
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
  t = t.replace(/@([A-Za-z0-9_]+)/g, '<span style="color:#1e4d6b">@$1</span>');
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
