import {
  BUILDING_BLURB,
  BUILDING_TITLE,
  NEW_BUILD_COST,
  RESOURCE_LABELS,
  UNIT_COSTS,
  allowedKindsForPlot,
  buildingOutputsAtLevel,
  buildingWorkerCap,
  canAssignWorkers,
  constructionHours,
  formatHours,
  formatStacks,
  getPlot,
  levelPreviews,
  type BuildingKind,
  type PublicSnapshot,
  type ResourceId,
} from "@immortal/shared";
import { api } from "./api.js";
import { sfx } from "./audio.js";
import {
  hidePopup,
  renderBuildingPopup,
  renderGenericPopup,
} from "./inspectPopup.js";
import { formatChatHtml, toggleProdOverlay } from "./modern.js";

const HUD_RESOURCES: ResourceId[] = [
  "emmer",
  "river_clay",
  "marsh_reeds",
  "rations",
  "mudbricks",
  "hides",
  "bronze",
  "cedarwood",
  "seals",
];

export type UiHandlers = {
  onSnapshot: (s: PublicSnapshot) => void;
  onToast: (msg: string) => void;
  onPostcard: () => void;
  onHighlightBuilding?: (buildingId: string | null) => void;
  onHighlightPad?: (plotId: string | null) => void;
};

let state: PublicSnapshot | null = null;
let handlers: UiHandlers;
let selectedBuildingId: string | null = null;
let selectedPlotId: string | null = null;

export function initUi(h: UiHandlers) {
  handlers = h;
  document.querySelectorAll<HTMLButtonElement>("#nav button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.dataset.panel!;
      document.querySelectorAll("#nav button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      showPanel(panel === "settlement" ? "settlement" : panel);
      if (panel === "map" || btn.id === "btn-map") showPanel("map");
    });
  });
  document.getElementById("btn-map")?.addEventListener("click", () => {
    showPanel("map");
  });
  document.getElementById("btn-postcard")?.addEventListener("click", () => {
    handlers.onPostcard();
  });
}

export function showPanel(name: string) {
  document.querySelectorAll(".side-panel").forEach((el) => {
    (el as HTMLElement).hidden = el.id !== `panel-${name}`;
  });
  document.querySelectorAll("#nav button").forEach((b) => {
    const btn = b as HTMLButtonElement;
    btn.classList.toggle("active", btn.dataset.panel === name);
  });
}

export function renderSnapshot(s: PublicSnapshot) {
  state = s;
  renderHud(s);
  renderSettlement(s);
  renderHarbor(s);
  renderTablets(s);
  renderAllies(s);
  renderWall(s);
  renderBuild(s);
  renderMilitary(s);
  renderMap(s);
  renderInspect();
}

export type SelectOpts = { fromScene?: boolean };

/** Call from 3D pick or list row. */
export function selectBuilding(buildingId: string | null, opts: SelectOpts = {}) {
  selectedBuildingId = buildingId;
  selectedPlotId = null;
  if (!opts.fromScene) handlers.onHighlightBuilding?.(buildingId);
  if (!opts.fromScene) handlers.onHighlightPad?.(null);
  renderInspect();
  const hint = document.getElementById("hint");
  if (hint) hint.classList.toggle("hidden", !!buildingId || !!selectedPlotId);
}

/** Empty typed pad — open category-restricted build menu. */
export function selectPad(plotId: string, opts: SelectOpts = {}) {
  selectedBuildingId = null;
  selectedPlotId = plotId;
  if (!opts.fromScene) handlers.onHighlightPad?.(plotId);
  if (!opts.fromScene) handlers.onHighlightBuilding?.(null);
  renderPadBuildMenu();
  const hint = document.getElementById("hint");
  if (hint) hint.classList.add("hidden");
}

export function getSelectedBuildingId() {
  return selectedBuildingId;
}

function prettyKind(kind: BuildingKind | string) {
  if (kind in BUILDING_TITLE) return BUILDING_TITLE[kind as BuildingKind];
  return kind
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function renderInspect() {
  const el = document.getElementById("building-inspect");
  if (!el || !state) return;
  if (selectedPlotId) {
    renderPadBuildMenu();
    return;
  }
  const st = state.settlements[0];
  if (!st || !selectedBuildingId) {
    hidePopup(el);
    return;
  }
  const b = st.buildings.find((x) => x.id === selectedBuildingId);
  if (!b) {
    hidePopup(el);
    return;
  }
  renderBuildingPopup(el, state, b, {
    onSnapshot: handlers.onSnapshot,
    onToast: handlers.onToast,
    onClose: () => selectBuilding(null),
    onOpenPanel: (panel) => showPanel(panel),
  });
}

function renderPadBuildMenu() {
  const el = document.getElementById("building-inspect");
  if (!el || !state || !selectedPlotId) return;
  const st = state.settlements[0];
  if (!st) return;
  const plot = getPlot(selectedPlotId);
  if (!plot) {
    hidePopup(el);
    return;
  }
  const busy = st.construction;
  const existing = st.buildings.map((b) => b.kind);
  const kinds = allowedKindsForPlot(selectedPlotId, existing);

  const catLabel =
    plot.category === "shop"
      ? "Flexible shop plot"
      : plot.category === "special"
        ? "Special plot"
        : plot.category === "training"
          ? "Training grounds"
          : "Plot";

  const buttons =
    kinds.length === 0
      ? `<p class="muted">Nothing left to place here (or you already built the allowed kinds).</p>`
      : kinds
          .map((k) => {
            const cost = NEW_BUILD_COST[k] ?? [];
            const hours = constructionHours(k, 1);
            let title = BUILDING_TITLE[k];
            if (k === "luxury_material") {
              title = `Luxury Works (${RESOURCE_LABELS[st.uniqueLuxury]})`;
            }
            if (k === "training_grounds" && plot.trainingUnit) {
              title = `Training Grounds — ${plot.trainingUnit.replace(/_/g, " ")}`;
            }
            const out = buildingOutputsAtLevel(k, 1, st.uniqueLuxury)
              .slice(0, 1)
              .map((o) => o.text)
              .join("");
            return `<button type="button" class="build-choice" data-kind="${k}">
        <strong>${title}</strong>
        <span class="muted">${formatStacks(cost as never)} · ${formatHours(hours)}</span>
        <span class="muted">${out}</span>
      </button>`;
          })
          .join("");

  const province = state.map.provinces.find((p) => p.id === st.provinceId);

  renderGenericPopup(el, {
    title: plot.label,
    subtitle: `${catLabel} · ${selectedPlotId}`,
    what:
      plot.category === "shop"
        ? "One of five flexible shop slots. Place Ration House, Mudbrick Yard, Vessel Shop, Reed Basket Shop, or a Luxury Goods Shop — each only once. Early order matters: bricks and rations first."
        : plot.category === "special"
          ? "One of four Special pads: Warehouse, Shrine, Harbor, or your unique luxury works. Your unique luxury specialty is fixed at founding — you must trade for every other luxury."
          : plot.category === "training"
            ? `Barracks pad for ${plot.trainingUnit?.replace(/_/g, " ") ?? "troops"}. Low early priority unless you want monuments soon.`
            : "Build site.",
    details: [
      busy
        ? `Queue busy: ${BUILDING_TITLE[busy.kind] ?? busy.kind} (${busy.workerHoursDone.toFixed(1)}/${busy.workerHoursRequired.toFixed(1)} h)`
        : "Construction queue free — one building at a time.",
      `Province: ${province?.name ?? st.provinceId} — neighbors here trade fastest.`,
      `Your unique luxury: ${RESOURCE_LABELS[st.uniqueLuxury]} (build Luxury Works on its Special pad to produce it).`,
      "You cannot produce other raw luxuries here — Tablet Wall / Market / barges with other players.",
    ],
    levelTableHtml: `<div class="build-choice-grid">${buttons}</div>`,
    onClose: () => {
      selectedPlotId = null;
      hidePopup(el);
      handlers.onHighlightPad?.(null);
    },
  });

  el.querySelectorAll<HTMLButtonElement>("[data-kind]").forEach((btn) => {
    btn.onclick = () => {
      const kind = btn.dataset.kind as BuildingKind;
      openNewBuildPopup(kind, selectedPlotId!);
    };
  });
}

function renderHud(s: PublicSnapshot) {
  const el = document.getElementById("resources")!;
  const parts: string[] = [];
  for (const r of HUD_RESOURCES) {
    if (r === "seals") continue;
    const v = s.player.vault[r] ?? 0;
    if (v > 0 || ["emmer", "rations", "mudbricks"].includes(r)) {
      parts.push(`<span title="${RESOURCE_LABELS[r]}">${short(r)} ${fmt(v)}</span>`);
    }
  }
  // show unique luxury always (assigned at founding — may not produce until Luxury Works built)
  const lux = s.settlements[0]?.uniqueLuxury;
  if (lux) {
    const hasWorks = s.settlements[0]?.buildings.some((b) => b.kind === "luxury_material");
    parts.push(
      `<span title="Your unique luxury — trade for others">${RESOURCE_LABELS[lux]} ${fmt(s.player.vault[lux] ?? 0)}${hasWorks ? "" : " (build works)"}</span>`
    );
  }
  el.innerHTML = parts.join("");
  const prov = s.map.provinces.find((p) => p.id === s.settlements[0]?.provinceId);
  document.getElementById("seals")!.textContent = `◎ Seals ${s.player.seals}${prov ? ` · ${prov.name}` : ""}`;
}

function short(r: string) {
  return r
    .split("_")
    .map((w) => w[0]!.toUpperCase() + w.slice(1, 3))
    .join("");
}

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.floor(n));
}

function settlement() {
  return state?.settlements[0] ?? null;
}

function renderSettlement(s: PublicSnapshot) {
  const panel = document.getElementById("panel-settlement")!;
  const st = s.settlements[0];
  if (!st) {
    panel.innerHTML = "<p>No settlement</p>";
    return;
  }
  const free = st.workers - st.workersAssigned;
  const tick = s.tickSummary;
  panel.innerHTML = `
    <h2>${st.name}</h2>
    <p class="muted">GH L${st.greatHouseLevel} · ${st.workers} Workers (${st.workersAssigned} assigned, ${free} free) · Unique: ${RESOURCE_LABELS[st.uniqueLuxury]}</p>
    ${
      tick && tick.elapsedHours > 0.01
        ? `<p class="muted">Offline tick: ${tick.elapsedHours.toFixed(2)}h · shortage×${tick.shortageMultiplier.toFixed(2)}</p>`
        : ""
    }
    ${
      st.construction
        ? `<p>Building <strong>${st.construction.kind}</strong> → L${st.construction.targetLevel}
        (${st.construction.workerHoursDone.toFixed(1)}/${st.construction.workerHoursRequired.toFixed(1)} h)
        <button class="small secondary" id="cancel-build">Cancel (~25% refund)</button></p>`
        : ""
    }
    <h3>Buildings</h3>
    <div id="building-list"></div>
    <h3>Production QoL</h3>
    <div class="row">
      <button class="small" id="btn-overlay">Toggle overlay</button>
      <button class="small secondary" id="btn-balance">Apply balance helper</button>
    </div>
    <div class="row">
      <button class="small secondary" id="btn-pause">${s.player.pauseNonEssential ? "Resume non-essential" : "Pause non-essential"}</button>
    </div>
    <h3>Time</h3>
    <p class="muted">Real hours only. Speed-up is testing/catch-up — not monetized.</p>
    <div class="row">
      <button class="small" id="btn-advance-1">+1 hour</button>
      <button class="small secondary" id="btn-advance-8">+8 hours</button>
    </div>
    <h3>Account</h3>
    <div class="row">
      <button class="small secondary" id="btn-dark">Dark mode</button>
      <button class="small secondary" id="btn-cb">Color-blind</button>
    </div>
  `;
  const list = panel.querySelector("#building-list")!;
  for (const b of st.buildings) {
    const row = document.createElement("div");
    row.className = "building-row" + (b.id === selectedBuildingId ? " selected" : "");
    row.style.cursor = "pointer";
    const label = b.luxury
      ? `${prettyKind(b.kind)} (${RESOURCE_LABELS[b.luxury] ?? b.luxury})`
      : prettyKind(b.kind);
    const cap = buildingWorkerCap(b.kind, b.level);
    row.innerHTML = `
      <strong data-pick="${b.id}">${label} L${b.level}</strong>
      <span class="muted" data-pick="${b.id}">${b.workers}${canAssignWorkers(b.kind) ? ` / ${cap}` : ""} Workers</span>
      <button type="button" class="small" data-pick="${b.id}">Open</button>
      ${
        canAssignWorkers(b.kind)
          ? `<button type="button" class="small secondary" data-minus="${b.id}">−</button>
             <button type="button" class="small secondary" data-plus="${b.id}">+</button>`
          : ""
      }
      ${
        b.kind !== "great_house" && b.kind !== "market"
          ? `<button type="button" class="small secondary" data-up="${b.id}" data-kind="${b.kind}">Upgrade</button>`
          : b.kind === "great_house"
            ? `<button type="button" class="small secondary" data-up-gh="1">Upgrade GH</button>`
            : ""
      }
    `;
    list.appendChild(row);
  }
  list.querySelectorAll<HTMLElement>("[data-pick]").forEach((node) => {
    node.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = node.dataset.pick!;
      selectBuilding(id);
    });
  });
  list.querySelectorAll<HTMLButtonElement>("[data-minus]").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const b = st.buildings.find((x) => x.id === btn.dataset.minus)!;
      try {
        handlers.onSnapshot(await api.workers(st.id, b.id, Math.max(0, b.workers - 1)));
        sfx.ok();
      } catch (err) {
        handlers.onToast((err as Error).message);
      }
    };
  });
  list.querySelectorAll<HTMLButtonElement>("[data-plus]").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const b = st.buildings.find((x) => x.id === btn.dataset.plus)!;
      const cap = buildingWorkerCap(b.kind, b.level);
      try {
        handlers.onSnapshot(await api.workers(st.id, b.id, Math.min(cap, b.workers + 1)));
        sfx.ok();
      } catch (err) {
        handlers.onToast((err as Error).message);
      }
    };
  });
  list.querySelectorAll<HTMLButtonElement>("[data-up]").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      try {
        const next = await api.construct(st.id, btn.dataset.kind!, btn.dataset.up);
        sfx.build();
        handlers.onSnapshot(next);
      } catch (err) {
        sfx.warn();
        handlers.onToast((err as Error).message);
      }
    };
  });
  panel.querySelector<HTMLButtonElement>("[data-up-gh]")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      const next = await api.construct(st.id, "great_house");
      sfx.build();
      handlers.onSnapshot(next);
    } catch (err) {
      sfx.warn();
      handlers.onToast((err as Error).message);
    }
  });
  panel.querySelector("#cancel-build")?.addEventListener("click", async () => {
    try {
      handlers.onSnapshot(await api.cancelConstruct(st.id));
    } catch (e) {
      handlers.onToast((e as Error).message);
    }
  });
  panel.querySelector("#btn-advance-1")?.addEventListener("click", async () => {
    try {
      handlers.onSnapshot(await api.advance(1));
      sfx.ok();
    } catch (e) {
      handlers.onToast((e as Error).message);
    }
  });
  panel.querySelector("#btn-advance-8")?.addEventListener("click", async () => {
    try {
      handlers.onSnapshot(await api.advance(8));
      sfx.ok();
    } catch (e) {
      handlers.onToast((e as Error).message);
    }
  });
  panel.querySelector("#btn-overlay")?.addEventListener("click", () => {
    toggleProdOverlay();
    handlers.onSnapshot(s);
  });
  panel.querySelector("#btn-balance")?.addEventListener("click", async () => {
    try {
      handlers.onSnapshot(await api.suggestWorkers(st.id));
      sfx.ok();
    } catch (e) {
      handlers.onToast((e as Error).message);
    }
  });
  panel.querySelector("#btn-pause")?.addEventListener("click", async () => {
    try {
      handlers.onSnapshot(await api.pauseProduction(!s.player.pauseNonEssential));
      sfx.ok();
    } catch (e) {
      handlers.onToast((e as Error).message);
    }
  });
  panel.querySelector("#btn-dark")?.addEventListener("click", () => {
    const on = localStorage.getItem("dark") !== "1";
    localStorage.setItem("dark", on ? "1" : "0");
    document.documentElement.classList.toggle("dark", on);
  });
  panel.querySelector("#btn-cb")?.addEventListener("click", () => {
    const on = localStorage.getItem("cb") !== "1";
    localStorage.setItem("cb", on ? "1" : "0");
    document.documentElement.classList.toggle("cb", on);
  });
}

function renderHarbor(s: PublicSnapshot) {
  const panel = document.getElementById("panel-harbor")!;
  const st = s.settlements[0];
  if (!st) return;
  const hasHarbor = st.buildings.some((b) => b.kind === "harbor");
  panel.innerHTML = `
    <h2>Harbor</h2>
    ${
      hasHarbor
        ? `<p class="muted">Fleet: ${st.barges.length} barges</p>
           <button id="build-barge">Build barge (25 Cedarwood + 25 Rations + 20 wh)</button>
           <div id="barge-list"></div>`
        : `<p>No Harbor yet.</p><button id="build-harbor">Build Harbor</button>`
    }
  `;
  panel.querySelector("#build-harbor")?.addEventListener("click", async () => {
    try {
      handlers.onSnapshot(await api.construct(st.id, "harbor"));
      sfx.build();
    } catch (e) {
      handlers.onToast((e as Error).message);
    }
  });
  panel.querySelector("#build-barge")?.addEventListener("click", async () => {
    try {
      handlers.onSnapshot(await api.buildBarge(st.id));
      sfx.build();
    } catch (e) {
      handlers.onToast((e as Error).message);
    }
  });
  const list = panel.querySelector("#barge-list");
  if (list) {
    for (const b of st.barges) {
      const row = document.createElement("div");
      row.className = "building-row";
      const eta =
        b.status === "in_transit" && b.arriveAt
          ? `ETA ${Math.max(0, (b.arriveAt - Date.now()) / 3_600_000).toFixed(2)}h`
          : b.status;
      row.innerHTML = `<strong>Barge ${b.id.slice(0, 6)}</strong> <span class="muted">${eta}</span>
        ${
          b.status === "docked"
            ? `<label>Cargo <input type="range" min="1" max="100" value="10" data-cargo="${b.id}" /></label>
               <button class="small" data-launch="${b.id}">Launch to own shore</button>`
            : b.status === "building"
              ? `<span class="muted">${(b.workerHoursDone ?? 0).toFixed(1)}/${b.workerHoursRequired ?? 20} h</span>`
              : ""
        }`;
      list.appendChild(row);
    }
    list.querySelectorAll<HTMLButtonElement>("[data-launch]").forEach((btn) => {
      btn.onclick = async () => {
        try {
          const lux = st.uniqueLuxury;
          const slider = list.querySelector<HTMLInputElement>(
            `input[data-cargo="${btn.dataset.launch}"]`
          );
          const amt = Number(slider?.value ?? 10);
          handlers.onSnapshot(
            await api.launchBarge(st.id, btn.dataset.launch!, st.id, [
              { resource: lux, amount: amt },
            ])
          );
          sfx.trade();
        } catch (e) {
          handlers.onToast((e as Error).message);
        }
      };
    });
  }
}

function renderTablets(s: PublicSnapshot) {
  const panel = document.getElementById("panel-tablets")!;
  panel.innerHTML = `
    <h2>Private Tablets</h2>
    <h3>Send gift</h3>
    <label>To <input id="gift-to" placeholder="player name" /></label>
    <label>Amount of unique luxury <input id="gift-amt" type="number" value="2" min="1" /></label>
    <button id="send-gift">Send gift</button>
    <h3>Inbox</h3>
    <div id="mail-list"></div>
  `;
  const st = s.settlements[0];
  panel.querySelector("#send-gift")?.addEventListener("click", async () => {
    if (!st) return;
    const to = (panel.querySelector("#gift-to") as HTMLInputElement).value;
    const amt = Number((panel.querySelector("#gift-amt") as HTMLInputElement).value);
    try {
      handlers.onSnapshot(
        await api.gift(to, [{ resource: st.uniqueLuxury, amount: amt }], "River gift")
      );
      sfx.trade();
    } catch (e) {
      sfx.warn();
      handlers.onToast((e as Error).message);
    }
  });
  const mailList = panel.querySelector("#mail-list")!;
  for (const m of s.mail.filter((x) => x.toId === s.player.id).slice().reverse()) {
    const row = document.createElement("div");
    row.className = "offer-row";
    row.innerHTML = `<div><strong>${m.subject}</strong><div class="muted">${m.attachments.map((a) => `${a.amount} ${a.resource}`).join(", ")}</div></div>
      ${!m.acceptedAt ? `<button class="small" data-mail="${m.id}">Accept</button>` : `<span class="muted">accepted</span>`}`;
    mailList.appendChild(row);
  }
  mailList.querySelectorAll<HTMLButtonElement>("[data-mail]").forEach((btn) => {
    btn.onclick = async () => {
      try {
        handlers.onSnapshot(await api.acceptMail(btn.dataset.mail!));
        sfx.trade();
      } catch (e) {
        handlers.onToast((e as Error).message);
      }
    };
  });
}

function renderAllies(s: PublicSnapshot) {
  const panel = document.getElementById("panel-allies")!;
  const rep = (s.reputation ?? [])
    .map(
      (r) =>
        `<div class="offer-row"><strong>${r.name}</strong> · ${r.successCount} successful trades
        <button class="small" data-pref="${r.playerId}">Prefer</button></div>`
    )
    .join("");
  const hist = (s.player.tradeHistory ?? [])
    .slice()
    .reverse()
    .slice(0, 8)
    .map((h) => `<div class="muted">${h.withName}: ${h.summary}</div>`)
    .join("");
  const circles = (s.circles ?? [])
    .map((c) => `<div>${c.name} (${c.memberIds.length}/12)</div>`)
    .join("");
  const legacy = (s.player.legacyAscensions ?? [])
    .map((a) => `<div>${a.name} · prestige ${a.prestige}</div>`)
    .join("") || "<div class='muted'>No Ascensions yet</div>";
  const notes = (s.notifications ?? [])
    .slice()
    .reverse()
    .slice(0, 5)
    .map((n) => `<div class="muted">${n.title}: ${n.body}</div>`)
    .join("");
  panel.innerHTML = `
    <h2>Allies & reputation</h2>
    <p class="muted">Prestige ${s.player.prestige} · preferred partners pin to trade lists</p>
    <h3>Successful trade partners</h3>
    ${rep || "<p class='muted'>No completed trades yet</p>"}
    <h3>Trade history</h3>
    ${hist || "<p class='muted'>—</p>"}
    <h3>Trading Circles</h3>
    ${circles || "<p class='muted'>None joined</p>"}
    <div class="row"><button class="small" id="mk-circle">Create circle</button></div>
    <h3>Notifications</h3>
    ${notes || "<p class='muted'>Quiet shores</p>"}
    <button class="small secondary" id="read-notes">Mark read</button>
    <h3>Legacy</h3>
    ${legacy}
    <h3>Seasonal</h3>
    <p class="muted">${s.seasonal ? `${s.seasonal.title}: ${s.seasonal.progress}/${s.seasonal.goalAmount}` : "No event"}</p>
    <button class="small secondary" id="seasonal-join">Contribute 10 Rations</button>
    <h3>Cosmetics (no power)</h3>
    <p class="muted">Owned: ${(s.player.cosmeticsOwned ?? []).join(", ")}</p>
    <button class="small secondary" id="buy-banner">Unlock river banner (0 Seals demo)</button>
  `;
  panel.querySelectorAll<HTMLButtonElement>("[data-pref]").forEach((btn) => {
    btn.onclick = async () => {
      try {
        handlers.onSnapshot(await api.partner(btn.dataset.pref!, true));
      } catch (e) {
        handlers.onToast((e as Error).message);
      }
    };
  });
  panel.querySelector("#mk-circle")?.addEventListener("click", async () => {
    try {
      handlers.onSnapshot(await api.createCircle("Province partners"));
      sfx.ok();
    } catch (e) {
      handlers.onToast((e as Error).message);
    }
  });
  panel.querySelector("#read-notes")?.addEventListener("click", async () => {
    try {
      handlers.onSnapshot(await api.readNotifications());
    } catch (e) {
      handlers.onToast((e as Error).message);
    }
  });
  panel.querySelector("#seasonal-join")?.addEventListener("click", async () => {
    try {
      await api.seasonal();
      handlers.onSnapshot(await api.seasonalContribute(10));
      sfx.ok();
    } catch (e) {
      handlers.onToast((e as Error).message);
    }
  });
  panel.querySelector("#buy-banner")?.addEventListener("click", async () => {
    try {
      handlers.onSnapshot(await api.purchaseCosmetic("banner_river", 0));
      sfx.ok();
    } catch (e) {
      handlers.onToast((e as Error).message);
    }
  });
}

function renderWall(s: PublicSnapshot) {
  const panel = document.getElementById("panel-wall")!;
  const st = s.settlements[0];
  const defaultCh = s.player.prefs?.defaultChatChannel ?? "province";
  panel.innerHTML = `
    <h2>Tablet Wall</h2>
    <p class="muted">Trust trade — no escrow. Province channel is home while on your shore.</p>
    <div class="row">
      <select id="chat-channel">
        <option value="province" ${defaultCh === "province" ? "selected" : ""}>Province</option>
        <option value="trade" ${defaultCh === "trade" ? "selected" : ""}>Trade</option>
        <option value="general" ${defaultCh === "general" ? "selected" : ""}>General</option>
      </select>
      <input id="chat-search" placeholder="Search…" style="flex:1" />
    </div>
    <div class="chat-box" id="chat-box"></div>
    <div class="row">
      <input id="chat-input" placeholder="**bold** *italic* @name emoji ok" />
      <button class="small" id="chat-send">Send</button>
    </div>
    <h3>Trust offer (Wall)</h3>
    <p class="muted">You promise goods; taker pays atomically if both still hold stock. Free text never settles.</p>
    <label>Give amount <input id="offer-give" type="number" value="3" min="1" /></label>
    <label>Want rations <input id="offer-want" type="number" value="15" min="1" /></label>
    <div class="row">
      <button id="post-offer">Post trust offer</button>
      <button class="small secondary" id="save-tpl">Save template</button>
    </div>
    <h3>Open offers</h3>
    <div id="offer-list"></div>
    <h3>Market (Rations · province range)</h3>
    <label>Sell resource
      <select id="mkt-res">
        <option value="emmer">Emmer</option>
        <option value="mudbricks">Mudbricks</option>
        <option value="${st?.uniqueLuxury ?? "hides"}">Unique luxury</option>
      </select>
    </label>
    <label>Amount <input id="mkt-amt" type="number" value="5" /></label>
    <label>Price (Rations) <input id="mkt-price" type="number" value="10" /></label>
    <button id="mkt-post">List</button>
    <div id="mkt-list"></div>
  `;
  const box = panel.querySelector("#chat-box")!;
  const search = () =>
    ((panel.querySelector("#chat-search") as HTMLInputElement)?.value ?? "").toLowerCase();
  const redrawChat = () => {
    const q = search();
    box.innerHTML = "";
    const preferred = new Set(s.player.prefs?.preferredPartners ?? []);
    let msgs = s.chat.slice(-50);
    if (q) msgs = msgs.filter((m) => m.text.toLowerCase().includes(q) || m.fromName.toLowerCase().includes(q));
    // Prefer province channel messages first when sorting soft
    msgs = [...msgs].sort((a, b) => {
      const ap = preferred.has(a.fromId) ? 1 : 0;
      const bp = preferred.has(b.fromId) ? 1 : 0;
      return bp - ap || a.createdAt - b.createdAt;
    });
    for (const m of msgs.slice(-40)) {
      const line = document.createElement("div");
      line.className = "chat-line chat-md";
      line.innerHTML = `<span class="muted">[${m.channel}] ${m.fromName}:</span> ${formatChatHtml(m.text)}`;
      box.appendChild(line);
    }
    box.scrollTop = box.scrollHeight;
  };
  redrawChat();
  panel.querySelector("#chat-search")?.addEventListener("input", redrawChat);
  panel.querySelector("#chat-send")?.addEventListener("click", async () => {
    const text = (panel.querySelector("#chat-input") as HTMLInputElement).value;
    const channel = (panel.querySelector("#chat-channel") as HTMLSelectElement)
      .value as "general" | "trade" | "province";
    try {
      handlers.onSnapshot(await api.chat(channel, text));
      sfx.chat();
    } catch (e) {
      handlers.onToast((e as Error).message);
    }
  });
  panel.querySelector("#save-tpl")?.addEventListener("click", async () => {
    if (!st) return;
    const give = Number((panel.querySelector("#offer-give") as HTMLInputElement).value);
    const want = Number((panel.querySelector("#offer-want") as HTMLInputElement).value);
    try {
      handlers.onSnapshot(
        await api.saveTemplate(
          "Luxury for rations",
          [{ resource: st.uniqueLuxury, amount: give }],
          [{ resource: "rations", amount: want }]
        )
      );
      sfx.ok();
    } catch (e) {
      handlers.onToast((e as Error).message);
    }
  });
  panel.querySelector("#post-offer")?.addEventListener("click", async () => {
    if (!st) return;
    const give = Number((panel.querySelector("#offer-give") as HTMLInputElement).value);
    const want = Number((panel.querySelector("#offer-want") as HTMLInputElement).value);
    try {
      handlers.onSnapshot(
        await api.postOffer(
          [{ resource: st.uniqueLuxury, amount: give }],
          [{ resource: "rations", amount: want }]
        )
      );
      sfx.trade();
    } catch (e) {
      sfx.warn();
      handlers.onToast((e as Error).message);
    }
  });
  const offerList = panel.querySelector("#offer-list")!;
  for (const o of s.offers.filter((x) => x.state === "posted")) {
    const row = document.createElement("div");
    row.className = "offer-row";
    const mine = o.posterId === s.player.id;
    row.innerHTML = `<div>${o.give.map((g) => `${g.amount} ${g.resource}`).join(", ")}
      → ${o.want.map((w) => `${w.amount} ${w.resource}`).join(", ")}
      <div class="muted">${o.id.slice(0, 8)}</div></div>
      ${mine ? `<span class="muted">yours</span>` : `<button class="small" data-acc="${o.id}">Accept</button>`}`;
    offerList.appendChild(row);
  }
  offerList.querySelectorAll<HTMLButtonElement>("[data-acc]").forEach((btn) => {
    btn.onclick = async () => {
      try {
        handlers.onSnapshot(await api.acceptOffer(btn.dataset.acc!));
        sfx.trade();
      } catch (e) {
        handlers.onToast((e as Error).message);
      }
    };
  });
  panel.querySelector("#mkt-post")?.addEventListener("click", async () => {
    if (!st) return;
    const resource = (panel.querySelector("#mkt-res") as HTMLSelectElement)
      .value as ResourceId;
    const amount = Number((panel.querySelector("#mkt-amt") as HTMLInputElement).value);
    const price = Number((panel.querySelector("#mkt-price") as HTMLInputElement).value);
    try {
      handlers.onSnapshot(await api.market(resource, amount, price, st.provinceId));
      sfx.trade();
    } catch (e) {
      handlers.onToast((e as Error).message);
    }
  });
  const mkt = panel.querySelector("#mkt-list")!;
  for (const o of s.market) {
    const row = document.createElement("div");
    row.className = "offer-row";
    row.innerHTML = `<div>${o.amount} ${o.resource} @ ${o.priceRations} rations</div>
      ${
        o.sellerId === s.player.id
          ? `<span class="muted">yours</span>`
          : `<button class="small" data-buy="${o.id}">Buy</button>`
      }`;
    mkt.appendChild(row);
  }
  mkt.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((btn) => {
    btn.onclick = async () => {
      try {
        handlers.onSnapshot(await api.acceptMarket(btn.dataset.buy!));
        sfx.trade();
      } catch (e) {
        handlers.onToast((e as Error).message);
      }
    };
  });
}

function openNewBuildPopup(kind: BuildingKind, plotId: string) {
  const el = document.getElementById("building-inspect");
  if (!el || !state) return;
  const st = state.settlements[0];
  if (!st) return;
  const plot = getPlot(plotId);
  const cost = (NEW_BUILD_COST[kind] ?? []) as {
    resource: ResourceId;
    amount: number;
  }[];
  const hours = constructionHours(kind, 1);
  const outs = buildingOutputsAtLevel(kind, 1, st.uniqueLuxury)
    .map((o) => o.text)
    .join(" · ");
  const previews = levelPreviews(kind, 1, st.uniqueLuxury, 6);
  const table = `<table class="lvl-table"><thead><tr><th>Lvl</th><th>Workers</th><th>Time</th><th>Cost to reach</th><th>Outputs</th></tr></thead><tbody>
    ${previews
      .map(
        (r) => `<tr class="${r.level === 1 ? "is-current" : ""}">
      <td>L${r.level}</td><td>${r.workerCap || "—"}</td><td>${formatHours(r.buildHours)}</td>
      <td>${r.level === 1 ? "Found cost below" : formatStacks(r.upgradeCost)}</td>
      <td>${r.outputs
        .slice(0, 2)
        .map((o) => o.text)
        .join(" · ")}</td></tr>`
      )
      .join("")}
  </tbody></table>`;

  let title = BUILDING_TITLE[kind];
  if (kind === "luxury_material") {
    title = `Luxury Works (${RESOURCE_LABELS[st.uniqueLuxury]})`;
  }
  if (kind === "training_grounds" && plot?.trainingUnit) {
    title = `Training Grounds — ${plot.trainingUnit.replace(/_/g, " ")}`;
  }

  renderGenericPopup(el, {
    title,
    subtitle: `${plot?.label ?? plotId} · ~${formatHours(hours)}`,
    what: BUILDING_BLURB[kind],
    details: [
      `Found cost: ${formatStacks(cost)}`,
      `Build time: ~${formatHours(hours)} worker-hours (unassigned workers advance the queue in real time)`,
      `At L1: ${outs || "—"}`,
      st.construction
        ? `Queue busy: ${st.construction.kind} → L${st.construction.targetLevel}`
        : "Construction queue free",
    ],
    levelTableHtml: table,
    primaryLabel: st.construction ? "Queue busy" : "Start construction",
    primaryDisabled: !!st.construction,
    secondaryLabel: "Back to pad",
    onPrimary: async () => {
      try {
        handlers.onSnapshot(await api.construct(st.id, kind, undefined, plotId));
        sfx.build();
        selectedPlotId = null;
        selectBuilding(null);
      } catch (e) {
        sfx.warn();
        handlers.onToast((e as Error).message);
      }
    },
    onSecondary: () => {
      selectPad(plotId);
    },
    onClose: () => {
      selectedPlotId = null;
      hidePopup(el);
      handlers.onHighlightPad?.(null);
    },
  });
}

function renderBuild(s: PublicSnapshot) {
  const panel = document.getElementById("panel-build")!;
  const st = s.settlements[0];
  if (!st) return;
  const empty = 12 - (st.buildings.length - 5); // 5 starter + 12 empty pads = 17 total plots; occupied non-starter
  const occupiedPads = st.buildings.length;
  panel.innerHTML = `
    <h2>Build</h2>
    <p><strong>Click a colored empty pad</strong> on the shore — not free placement.</p>
    <ul class="action-list">
      <li><strong>Shop</strong> (sand) — 5 slots: Ration House, Mudbrick Yard, Vessel, Basket, Luxury Goods</li>
      <li><strong>Special</strong> — Harbor, Warehouse, Shrine, your unique Luxury Works</li>
      <li><strong>Training</strong> — 3 barracks (Bow / Spear / Chariot)</li>
    </ul>
    <p class="muted">Starter only: Great House, Market, Emmer, Clay, Reeds. One construction at a time. Buildings: ${occupiedPads} · Queue: ${
      st.construction
        ? `${st.construction.kind} ${st.construction.workerHoursDone.toFixed(1)}/${st.construction.workerHoursRequired.toFixed(1)} h`
        : "free"
    }</p>
    <p class="muted">Unique luxury: <strong>${RESOURCE_LABELS[st.uniqueLuxury]}</strong> — trade for every other luxury. Province: <strong>${s.map.provinces.find((p) => p.id === st.provinceId)?.name ?? st.provinceId}</strong></p>
  `;
  void empty;
}

function renderMilitary(s: PublicSnapshot) {
  const panel = document.getElementById("panel-military")!;
  const st = s.settlements[0];
  if (!st) return;
  panel.innerHTML = `
    <h2>Military & Monuments</h2>
    <p class="muted">Units: ${st.units.map((u) => `${u.count} ${u.kind}`).join(", ") || "none"}</p>
    <div class="row">
      <button class="small" data-train="bowmen">Train Bowmen</button>
      <button class="small" data-train="spearmen">Train Spearmen</button>
      <button class="small" data-train="chariot_warriors">Train Chariots</button>
    </div>
    <h3>Held monuments</h3>
    <div id="mon-list"></div>
    <h3>Envoy</h3>
    <button id="envoy">Dispatch envoy (GH7+)</button>
    <h3>Shrine offering</h3>
    <button id="shrine">Contribute 1 patron good</button>
  `;
  panel.querySelectorAll<HTMLButtonElement>("[data-train]").forEach((btn) => {
    btn.onclick = () => {
      const kind = btn.dataset.train as "bowmen" | "spearmen" | "chariot_warriors";
      const def = UNIT_COSTS[kind];
      const el = document.getElementById("building-inspect")!;
      renderGenericPopup(el, {
        title: kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        subtitle: def.note,
        what: "Military unit trained at Training Grounds. Consumes 1 Ration/hour or begins to desert.",
        details: [
          `Cost: ${formatStacks(def.cost)}`,
          "Travel: 2 Rations per hour of travel",
          "Need Training Grounds built first",
          `You have: ${st.units.find((u) => u.kind === kind)?.count ?? 0}`,
        ],
        primaryLabel: "Train 1",
        onPrimary: async () => {
          try {
            handlers.onSnapshot(await api.train(st.id, kind));
            sfx.ok();
            hidePopup(el);
          } catch (e) {
            handlers.onToast((e as Error).message);
          }
        },
        onClose: () => hidePopup(el),
      });
    };
  });
  const mon = panel.querySelector("#mon-list")!;
  for (const m of st.monuments) {
    const row = document.createElement("div");
    row.className = "building-row";
    row.style.cursor = "pointer";
    row.innerHTML = `<strong>${m.siteId}</strong> L${m.level} · ${m.workers} Workers · limestone ${m.limestone}
      <button class="small" data-mw="${m.siteId}">Inspect</button>`;
    row.onclick = () => {
      const el = document.getElementById("building-inspect")!;
      renderGenericPopup(el, {
        title: "Monument hold",
        subtitle: m.siteId,
        what: "Captured monument grounds. Workers sent here stay permanently and harvest Limestone. Each level grants +1% production & transport to all your settlements.",
        details: [
          `Level ${m.level}`,
          `${m.workers} monument Workers (cannot return)`,
          `Limestone stockpile ${m.limestone}`,
          "Output: 1 Limestone / Worker / hour",
          "Max 2 monuments held",
        ],
        primaryLabel: "Send +1 Worker (permanent)",
        onPrimary: async () => {
          try {
            handlers.onSnapshot(
              await api.monumentWorkers(st.id, m.siteId, m.workers + 1)
            );
            sfx.ok();
            hidePopup(el);
          } catch (e) {
            handlers.onToast((e as Error).message);
          }
        },
        onClose: () => hidePopup(el),
      });
    };
    mon.appendChild(row);
  }
  panel.querySelector("#envoy")?.addEventListener("click", () => {
    const el = document.getElementById("building-inspect")!;
    renderGenericPopup(el, {
      title: "Envoy expedition",
      subtitle: "Unlocks at Great House 7",
      what: "Dispatch envoys on land or river expeditions. Success can yield Mudbricks, occasional Seals, or prestige.",
      details: [
        "Cost: 15 Rations + 5 of your unique luxury",
        `Great House level: ${st.greatHouseLevel}`,
        "Requires GH ≥ 7",
      ],
      primaryLabel: "Dispatch",
      onPrimary: async () => {
        try {
          handlers.onSnapshot(await api.envoy(st.id));
          sfx.ok();
          hidePopup(el);
        } catch (e) {
          handlers.onToast((e as Error).message);
        }
      },
      onClose: () => hidePopup(el),
    });
  });
  panel.querySelector("#shrine")?.addEventListener("click", () => {
    const el = document.getElementById("building-inspect")!;
    const province = s.map.provinces.find((p) => p.id === st.provinceId);
    renderGenericPopup(el, {
      title: "Provincial offering",
      subtitle: province?.name ?? st.provinceId,
      what: "Contribute the province patron luxury good via your Shrine. When the province threshold is met, every shrined settlement gets +10% production for 48 hours.",
      details: [
        `Patron good: ${province ? RESOURCE_LABELS[province.patronGood] : "—"}`,
        "Requires a Shrine building",
        "This action contributes 1 unit",
      ],
      primaryLabel: "Contribute 1",
      onPrimary: async () => {
        try {
          handlers.onSnapshot(await api.shrine(st.id, 1));
          sfx.ok();
          hidePopup(el);
        } catch (e) {
          handlers.onToast((e as Error).message);
        }
      },
      onClose: () => hidePopup(el),
    });
  });
}

function renderMap(s: PublicSnapshot) {
  const panel = document.getElementById("panel-map")!;
  const st = s.settlements[0];
  const myMap = st?.mapArchetypeId?.replace(/_/g, " ") ?? "—";
  panel.innerHTML = `<h2>World Map — Eternal River</h2>
    <p class="muted">Your shore: <strong>${st?.uniqueLuxury?.replace(/_/g, " ") ?? "—"}</strong> on <strong>${myMap}</strong> · ${st?.provinceId ?? ""}</p>
    <p class="muted">Six province maps are live. New players get least-used luxury + province so multiplayer trade works.</p>
    <div class="map-grid" id="map-grid"></div>`;
  const grid = panel.querySelector("#map-grid")!;
  for (const site of s.map.sites) {
    const btn = document.createElement("button");
    btn.className = `map-site ${site.kind}`;
    btn.type = "button";
    btn.innerHTML = `<strong>${site.name}</strong><div class="muted">${site.kind} · ${site.provinceId} · (${site.mapX},${site.mapY})</div>`;
    btn.onclick = () => {
      const el = document.getElementById("building-inspect")!;
      const st = settlement();
      if (site.kind === "monument") {
        renderGenericPopup(el, {
          title: site.name,
          subtitle: `Monument grounds · ${site.provinceId}`,
          what: "Bandit-held monument site. Capture with military power to harvest Limestone and gain empire-wide production/transport bonuses.",
          details: [
            `Defending force: ${site.banditForce ?? "—"}`,
            site.ownerPlayerId ? `Held by ${site.ownerPlayerId}` : "Unheld — capturable",
            "Max 2 monuments per player",
            "Limestone: 1 / Worker / hour after capture",
            "+1% production & transport per monument level to all settlements",
          ],
          primaryLabel: site.ownerPlayerId ? "Already held" : "Attempt capture",
          primaryDisabled: !!site.ownerPlayerId || !st,
          onPrimary: async () => {
            if (!st) return;
            try {
              handlers.onSnapshot(await api.capture(st.id, site.id));
              sfx.ok();
              hidePopup(el);
            } catch (e) {
              handlers.onToast((e as Error).message);
            }
          },
          onClose: () => hidePopup(el),
        });
      } else if (site.kind === "founding") {
        renderGenericPopup(el, {
          title: site.name,
          subtitle: `Founding site · ${site.provinceId}`,
          what: "Empty shore where you can found another settlement (up to 4). Each new shore gets its own unique luxury.",
          details: [
            site.ownerPlayerId ? "Already claimed" : "Available",
            "Seal cost: 2 / 3 / 4 for 2nd / 3rd / 4th settlement",
            "Also costs Mudbricks, Rations, Vessels from capital",
            `You have ${state!.player.seals} Seals · ${state!.settlements.length} settlement(s)`,
          ],
          primaryLabel: site.ownerPlayerId ? "Unavailable" : "Found settlement",
          primaryDisabled: !!site.ownerPlayerId,
          onPrimary: async () => {
            try {
              handlers.onSnapshot(await api.found(site.id, "New Shore"));
              sfx.build();
              hidePopup(el);
            } catch (e) {
              handlers.onToast((e as Error).message);
            }
          },
          onClose: () => hidePopup(el),
        });
      } else if (site.kind === "city") {
        const id = site.id.replace(/^city-/, "");
        renderGenericPopup(el, {
          title: site.name,
          subtitle: `Player city · ${site.provinceId}`,
          what: "Another shore on the eternal river. Visits are read-only postcards — no live co-building.",
          details: [
            site.ownerPlayerId === state!.player.id ? "Your city" : "Foreign shore",
            "Visit shows buildings + postcard if uploaded",
          ],
          primaryLabel: "Visit (read-only)",
          onPrimary: async () => {
            try {
              const v = (await api.visit(id)) as {
                settlement: { name: string; greatHouseLevel: number; uniqueLuxury: string };
                ownerName: string;
              };
              handlers.onToast(
                `${v.ownerName}: ${v.settlement.name} GH${v.settlement.greatHouseLevel} · ${v.settlement.uniqueLuxury}`
              );
              hidePopup(el);
            } catch (e) {
              handlers.onToast((e as Error).message);
            }
          },
          onClose: () => hidePopup(el),
        });
      } else {
        renderGenericPopup(el, {
          title: site.name,
          subtitle: site.kind,
          what: "Map marker on the eternal river.",
          details: [`Province ${site.provinceId}`, `(${site.mapX}, ${site.mapY})`],
          onClose: () => hidePopup(el),
        });
      }
    };
    grid.appendChild(btn);
  }
}
