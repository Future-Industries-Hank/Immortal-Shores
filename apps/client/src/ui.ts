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
import {
  GLYPHS,
  UNIT_GLYPH,
  buildingIcon,
  formatChatHtml,
  levelPips,
  resourceIcon,
  resourceShort,
  toggleProdOverlay,
} from "./modern.js";

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

const ARROW_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6"/></svg>`;

export type UiHandlers = {
  onSnapshot: (s: PublicSnapshot) => void;
  onToast: (msg: string) => void;
  onPostcard: () => void;
  onHighlightBuilding?: (buildingId: string | null) => void;
  onHighlightPad?: (plotId: string | null) => void;
  onHighlightConstruction?: (plotId: string | null) => void;
};

let state: PublicSnapshot | null = null;
let handlers: UiHandlers;
let selectedBuildingId: string | null = null;
let selectedPlotId: string | null = null;
/** True when inspecting an in-progress construction job (scaffold). */
let selectedConstruction = false;
/** Currently open menu popup panel id, or null when closed. */
let activePanel: string | null = null;
/** Shore panel "Settings & Debug" collapsible state (survives re-render). */
let settingsOpen = false;
/** World map legend filters (survive re-render). */
let mapKindFilter: string = "all";
let mapProvFilter: string | null = null;

const PANEL_TITLES: Record<string, string> = {
  settlement: "Shore",
  harbor: "Harbor",
  tablets: "Tablets",
  allies: "Allies",
  wall: "Wall",
  build: "Build",
  military: "Military",
  map: "Map",
};

export function initUi(h: UiHandlers) {
  handlers = h;
  document.querySelectorAll<HTMLButtonElement>("#nav button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.dataset.panel;
      if (panel) showPanel(panel);
    });
  });
  document.getElementById("btn-map")?.addEventListener("click", () => {
    showPanel("map");
  });
  document.getElementById("menu-popup-close")?.addEventListener("click", () => {
    closeMenuPopup();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const popup = document.getElementById("menu-popup");
    if (popup && !popup.hidden) {
      closeMenuPopup();
      e.preventDefault();
    }
  });
  document.getElementById("btn-postcard")?.addEventListener("click", () => {
    handlers.onPostcard();
  });
}

/** Close floating menu popup and clear tab active state. */
export function closeMenuPopup() {
  activePanel = null;
  const popup = document.getElementById("menu-popup");
  if (popup) popup.hidden = true;
  document.querySelectorAll("#nav button").forEach((b) => b.classList.remove("active"));
  document.getElementById("btn-map")?.classList.remove("active");
}

/**
 * Open a menu as a floating popup over the world.
 * Re-clicking the same tab (or Map) while open toggles it closed.
 */
export function showPanel(name: string) {
  const popup = document.getElementById("menu-popup");
  if (!popup) return;

  if (activePanel === name && !popup.hidden) {
    closeMenuPopup();
    return;
  }

  activePanel = name;
  document.querySelectorAll(".side-panel").forEach((el) => {
    (el as HTMLElement).hidden = el.id !== `panel-${name}`;
  });
  document.querySelectorAll("#nav button").forEach((b) => {
    const btn = b as HTMLButtonElement;
    btn.classList.toggle("active", btn.dataset.panel === name);
  });
  document.getElementById("btn-map")?.classList.toggle("active", name === "map");

  const title = document.getElementById("menu-popup-title");
  if (title) title.textContent = PANEL_TITLES[name] ?? name;

  popup.hidden = false;
}

export function renderSnapshot(s: PublicSnapshot) {
  state = s;
  // Construction finished while popup open — drop selection
  if (selectedConstruction && !s.settlements[0]?.construction) {
    selectedConstruction = false;
  }
  renderHud(s);
  renderSettlement(s);
  renderHarbor(s);
  renderTablets(s);
  renderAllies(s);
  renderWall(s);
  renderBuild(s);
  renderMilitary(s);
  renderMap(s);
  // Refresh open inspect (construction progress, building state)
  if (selectedConstruction || selectedBuildingId || selectedPlotId) {
    renderInspect();
  }
}

export type SelectOpts = { fromScene?: boolean };

/** Call from 3D pick or list row. */
export function selectBuilding(buildingId: string | null, opts: SelectOpts = {}) {
  selectedBuildingId = buildingId;
  selectedPlotId = null;
  selectedConstruction = false;
  if (!opts.fromScene) {
    handlers.onHighlightBuilding?.(buildingId);
    handlers.onHighlightPad?.(null);
    handlers.onHighlightConstruction?.(null);
  }
  renderInspect();
  const hint = document.getElementById("hint");
  if (hint) hint.classList.toggle("hidden", !!buildingId || !!selectedPlotId);
}

/** Empty typed pad — open category-restricted build menu. */
export function selectPad(plotId: string, opts: SelectOpts = {}) {
  selectedBuildingId = null;
  selectedPlotId = plotId;
  selectedConstruction = false;
  if (!opts.fromScene) {
    handlers.onHighlightPad?.(plotId);
    handlers.onHighlightBuilding?.(null);
    handlers.onHighlightConstruction?.(null);
  }
  renderPadBuildMenu();
  const hint = document.getElementById("hint");
  if (hint) hint.classList.add("hidden");
}

/** Scaffold / construction site — show what's being built. */
export function selectConstruction(plotId: string | null, opts: SelectOpts = {}) {
  selectedBuildingId = null;
  selectedPlotId = null;
  selectedConstruction = !!plotId;
  if (!opts.fromScene) {
    handlers.onHighlightConstruction?.(plotId);
    handlers.onHighlightBuilding?.(null);
    handlers.onHighlightPad?.(null);
  }
  renderInspect();
  const hint = document.getElementById("hint");
  if (hint) hint.classList.toggle("hidden", selectedConstruction);
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
  if (selectedConstruction) {
    renderConstructionInspect();
    return;
  }
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

function renderConstructionInspect() {
  const el = document.getElementById("building-inspect");
  if (!el || !state) return;
  const st = state.settlements[0];
  const job = st?.construction;
  if (!st || !job) {
    selectedConstruction = false;
    hidePopup(el);
    return;
  }

  const title =
    job.luxury && job.kind === "luxury_material"
      ? `${prettyKind(job.kind)} (${RESOURCE_LABELS[job.luxury]})`
      : prettyKind(job.kind);
  const blurb =
    job.kind in BUILDING_BLURB
      ? BUILDING_BLURB[job.kind as BuildingKind]
      : "Structure under construction.";
  const isUpgrade = !!job.buildingId && job.targetLevel > 1;
  const pct = Math.min(
    100,
    Math.floor((job.workerHoursDone / Math.max(0.01, job.workerHoursRequired)) * 100)
  );
  const plot = job.plotId ? getPlot(job.plotId) : null;
  const previews = levelPreviews(
    job.kind,
    Math.max(1, job.targetLevel - (isUpgrade ? 1 : 0)),
    job.luxury ?? st.uniqueLuxury,
    4
  );
  const levelTableHtml = `
    <table class="lvl-table">
      <thead><tr><th>Lvl</th><th>Workers</th><th>Time</th><th>Outputs</th></tr></thead>
      <tbody>
        ${previews
          .map(
            (row) =>
              `<tr class="${row.level === job.targetLevel ? "is-next" : ""}">
                <td>L${row.level}</td>
                <td>${row.workerCap || "—"}</td>
                <td>${formatHours(row.buildHours)}</td>
                <td>${row.outputs
                  .slice(0, 2)
                  .map((o) => o.text)
                  .join(" · ") || "—"}</td>
              </tr>`
          )
          .join("")}
      </tbody>
    </table>`;

  renderGenericPopup(el, {
    title: isUpgrade ? `Upgrading: ${title}` : `Building: ${title}`,
    subtitle: `Under construction · L${job.targetLevel} · ${pct}%`,
    glyphKind: job.kind,
    what: blurb,
    details: [
      isUpgrade
        ? `Upgrade to level ${job.targetLevel}`
        : `New construction to level ${job.targetLevel}`,
      `Progress: ${job.workerHoursDone.toFixed(1)} / ${job.workerHoursRequired.toFixed(1)} worker-hours (${pct}%)`,
      plot ? `Site: ${plot.label}` : job.buildingId ? "Upgrading existing building" : "Site: pad",
      job.trainingUnit
        ? `Training unit: ${job.trainingUnit.replace(/_/g, " ")}`
        : "",
      `Cost paid: ${formatStacks(job.cost)}`,
      "Cancel refunds about 25% of materials.",
    ].filter(Boolean),
    levelTableHtml,
    primaryLabel: "Cancel construction (~25% refund)",
    onPrimary: async () => {
      try {
        handlers.onSnapshot(await api.cancelConstruct(st.id));
        sfx.ok();
        selectConstruction(null);
      } catch (e) {
        sfx.warn();
        handlers.onToast((e as Error).message);
      }
    },
    onClose: () => selectConstruction(null),
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
    subtitle: catLabel,
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
  const chip = (r: string, v: number, note = "") =>
    `<span class="res-chip" title="${RESOURCE_LABELS[r as ResourceId] ?? r}">${resourceIcon(r)}<span class="res-name">${resourceShort(r)}</span> <span class="res-val">${fmt(v)}</span>${note ? `<span class="res-note">${note}</span>` : ""}</span>`;
  for (const r of HUD_RESOURCES) {
    if (r === "seals") continue;
    const v = s.player.vault[r] ?? 0;
    if (v > 0 || ["emmer", "rations", "mudbricks"].includes(r)) {
      parts.push(chip(r, v));
    }
  }
  // show unique luxury always (assigned at founding — may not produce until Luxury Works built)
  const lux = s.settlements[0]?.uniqueLuxury;
  if (lux) {
    const hasWorks = s.settlements[0]?.buildings.some((b) => b.kind === "luxury_material");
    parts.push(chip(lux, s.player.vault[lux] ?? 0, hasWorks ? "" : "build works"));
  }
  el.innerHTML = parts.join("");
  const prov = s.map.provinces.find((p) => p.id === s.settlements[0]?.provinceId);
  document.getElementById("seals")!.innerHTML =
    `<span class="wax-dot" aria-hidden="true"></span>Seals ${s.player.seals}${prov ? ` <span class="seals-prov">· ${prov.name}</span>` : ""}`;
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
    <div class="stat-band">
      <span class="b-card-glyph">${GLYPHS.ziggurat}</span>
      <div class="stat-band-text">
        <strong>${st.name}</strong>
        <div class="muted">Great House L${st.greatHouseLevel} · ${st.workers} Workers (${st.workersAssigned} assigned, ${free} free) · ${resourceShort(st.uniqueLuxury)}</div>
      </div>
    </div>
    ${
      tick && tick.elapsedHours > 0.01
        ? `<p class="muted">While you were away: ${tick.elapsedHours.toFixed(2)}h passed · shortage ×${tick.shortageMultiplier.toFixed(2)}</p>`
        : ""
    }
    ${
      st.construction
        ? `<p>Building <strong>${prettyKind(st.construction.kind)}</strong> → L${st.construction.targetLevel}
        (${st.construction.workerHoursDone.toFixed(1)}/${st.construction.workerHoursRequired.toFixed(1)} h)
        <button class="small secondary" id="cancel-build">Cancel (~25% refund)</button></p>`
        : ""
    }
    <h3>Buildings</h3>
    <div id="building-list"></div>
    <details class="settings-debug" id="settings-debug" ${settingsOpen ? "open" : ""}>
      <summary>Settings &amp; Debug</summary>
      <div>
        <div class="row">
          <button class="small secondary" id="btn-overlay">Production overlay</button>
          <button class="small secondary" id="btn-balance">Balance helper</button>
        </div>
        <div class="row">
          <button class="small secondary" id="btn-pause">${s.player.pauseNonEssential ? "Resume non-essential" : "Pause non-essential"}</button>
        </div>
        <p class="muted">Time advance (testing / catch-up — never monetized):</p>
        <div class="row">
          <button class="small secondary" id="btn-advance-1">+1 hour</button>
          <button class="small secondary" id="btn-advance-8">+8 hours</button>
        </div>
        <div class="row">
          <button class="small secondary" id="btn-dark">Dark mode</button>
          <button class="small secondary" id="btn-cb">Color-blind</button>
        </div>
      </div>
    </details>
  `;
  const list = panel.querySelector("#building-list")!;
  for (const b of st.buildings) {
    const row = document.createElement("div");
    row.className = "b-card" + (b.id === selectedBuildingId ? " selected" : "");
    const label = b.luxury
      ? `${prettyKind(b.kind)} (${RESOURCE_LABELS[b.luxury] ?? b.luxury})`
      : prettyKind(b.kind);
    const cap = buildingWorkerCap(b.kind, b.level);
    row.innerHTML = `
      <div class="b-card-head">
        <span class="b-card-glyph" data-pick="${b.id}">${buildingIcon(b.kind)}</span>
        <span class="b-card-title" data-pick="${b.id}">
          <strong>${label}</strong>
          ${levelPips(b.level)}
        </span>
        <button type="button" class="small secondary" data-pick="${b.id}">Open</button>
      </div>
      <div class="b-card-actions">
        ${
          canAssignWorkers(b.kind)
            ? `<span class="stepper" title="Workers">
                 <button type="button" data-minus="${b.id}" aria-label="Fewer workers">−</button>
                 <span class="stepper-val">${b.workers}<span class="muted">/${cap}</span></span>
                 <button type="button" data-plus="${b.id}" aria-label="More workers">+</button>
               </span>`
            : `<span class="muted">No production Workers</span>`
        }
        ${
          b.kind !== "great_house" && b.kind !== "market"
            ? `<button type="button" class="small secondary" data-up="${b.id}" data-kind="${b.kind}">Upgrade</button>`
            : b.kind === "great_house"
              ? `<button type="button" class="small secondary" data-up-gh="1">Upgrade GH</button>`
              : ""
        }
      </div>
    `;
    list.appendChild(row);
  }
  panel.querySelector("#settings-debug")?.addEventListener("toggle", (e) => {
    settingsOpen = (e.target as HTMLDetailsElement).open;
  });
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

const BARGE_NAMES = [
  "Reed Dancer",
  "Ibis Wing",
  "Silt Runner",
  "Morning Star",
  "Heron's Path",
  "Golden Wake",
  "Papyrus Crown",
  "River Ghost",
];

function bargeName(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * 31) % 997;
  return BARGE_NAMES[h % BARGE_NAMES.length]!;
}

function etaText(ms: number): string {
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  if (mins < 60) return `arrives in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `arrives in ${h}h ${m}m`;
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
        ? `<p class="muted">Fleet of the shore · ${st.barges.length} barge${st.barges.length === 1 ? "" : "s"}</p>
           <div id="barge-list"></div>
           <div class="panel-footer">
             <button id="build-barge" class="primary">Lay a new barge <span class="muted">· 25 Cedar + 25 Rations + 20 wh</span></button>
           </div>`
        : `<div class="stat-band">
             <span class="b-card-glyph">${GLYPHS.barge}</span>
             <div class="stat-band-text">
               <strong>No Harbor yet</strong>
               <div class="muted">Build a Harbor on a Special pad to launch barges up and down the river.</div>
             </div>
           </div>
           <div class="panel-footer"><button id="build-harbor" class="primary">Build Harbor</button></div>`
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
      row.className = "barge-card";
      const status =
        b.status === "in_transit" && b.arriveAt
          ? etaText(b.arriveAt - Date.now())
          : b.status === "building"
            ? "under construction"
            : b.status;
      row.innerHTML = `
        <div class="barge-head">${GLYPHS.barge}<strong>${bargeName(b.id)}</strong><span class="muted">${status}</span></div>
        ${
          b.status === "docked"
            ? `<label>Cargo <input type="range" min="1" max="100" value="10" data-cargo="${b.id}" /></label>
               <div class="row"><button class="small primary" data-launch="${b.id}">Launch to own shore</button></div>`
            : b.status === "building"
              ? `<span class="muted">${(b.workerHoursDone ?? 0).toFixed(1)}/${b.workerHoursRequired ?? 20} worker-hours laid</span>`
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

function relTime(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}

function renderTablets(s: PublicSnapshot) {
  const panel = document.getElementById("panel-tablets")!;
  panel.innerHTML = `
    <h2>Private Tablets</h2>
    <h3>Send gift</h3>
    <label>To <input id="gift-to" placeholder="player name" /></label>
    <label>Amount of unique luxury <input id="gift-amt" type="number" value="2" min="1" /></label>
    <div class="row"><button id="send-gift" class="primary small">Send gift</button></div>
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
  const myMail = s.mail.filter((x) => x.toId === s.player.id).slice().reverse();
  if (myMail.length === 0) {
    mailList.innerHTML = `<p class="muted">No tablets have arrived. Gifts and trade notes appear here, sealed.</p>`;
  }
  for (const m of myMail) {
    const row = document.createElement("div");
    row.className = "tablet-card";
    row.innerHTML = `<div class="tablet-info"><strong>${m.subject}</strong>
      <div class="muted">${m.attachments.map((a) => `${a.amount} ${resourceShort(a.resource)}`).join(", ") || "no attachments"} · ${relTime(m.createdAt)}</div></div>
      ${!m.acceptedAt ? `<button class="wax-seal" data-mail="${m.id}" title="Break the seal and claim">Accept</button>` : `<span class="seal-broken">opened</span>`}`;
    mailList.appendChild(row);
  }
  // unread badge on the Tablets nav tab
  const navBtn = document.querySelector<HTMLButtonElement>('#nav button[data-panel="tablets"]');
  if (navBtn) {
    const unread = myMail.filter((m) => !m.acceptedAt).length;
    navBtn.querySelector(".badge-dot")?.remove();
    if (unread > 0) {
      const dot = document.createElement("span");
      dot.className = "badge-dot";
      dot.title = `${unread} sealed tablet${unread === 1 ? "" : "s"}`;
      navBtn.appendChild(dot);
    }
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
        `<div class="ally-row"><span class="chat-avatar">${(r.name[0] ?? "?").toUpperCase()}</span>
        <span class="ally-info"><strong>${r.name}</strong><span class="trade-pips" title="${r.successCount} successful trades">${"<i></i>".repeat(Math.min(r.successCount, 8))}</span>
        <div class="muted">${r.successCount} successful trade${r.successCount === 1 ? "" : "s"}</div></span>
        <button class="small secondary" data-pref="${r.playerId}">Prefer</button></div>`
    )
    .join("");
  const hist = (s.player.tradeHistory ?? [])
    .slice()
    .reverse()
    .slice(0, 8)
    .map((h) => `<div class="muted">${h.withName}: ${h.summary}</div>`)
    .join("");
  const circles = (s.circles ?? [])
    .map((c) => `<div class="ally-row"><span class="chat-avatar">${(c.name[0] ?? "?").toUpperCase()}</span><span class="ally-info"><strong>${c.name}</strong><div class="muted">${c.memberIds.length} / 12 members</div></span></div>`)
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
    <h3>Trade partners</h3>
    ${rep || "<p class='muted'>No completed trades yet — the river remembers every honest deal.</p>"}
    <h3>Trade history</h3>
    ${hist || "<p class='muted'>—</p>"}
    <h3>Trading Circles</h3>
    ${circles || "<p class='muted'>None joined</p>"}
    <div class="row"><button class="small secondary" id="mk-circle">Create circle</button></div>
    <h3>Notifications</h3>
    ${notes || "<p class='muted'>Quiet shores</p>"}
    <button class="small secondary" id="read-notes">Mark read</button>
    <h3>Legacy</h3>
    ${legacy}
    <h3>Seasonal</h3>
    <p class="muted">${s.seasonal ? `${s.seasonal.title}: ${s.seasonal.progress}/${s.seasonal.goalAmount}` : "No event"}</p>
    <button class="small secondary" id="seasonal-join">Contribute 10 Rations</button>
    <h3>Cosmetics (no power)</h3>
    <p class="muted">Owned: ${(s.player.cosmeticsOwned ?? []).join(", ") || "none"}</p>
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

function stackList(stacks: { resource: string; amount: number }[]): string {
  return stacks
    .map((g) => `${resourceIcon(g.resource)}${g.amount} ${resourceShort(g.resource)}`)
    .join(", ");
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
      <button id="post-offer" class="primary small">Post trust offer</button>
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
    <div class="row"><button id="mkt-post" class="small">List</button></div>
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
      const mine = m.fromId === s.player.id;
      line.className = `chat-msg chat-md${mine ? " mine" : ""}`;
      const t = new Date(m.createdAt);
      const hh = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
      line.innerHTML = `<span class="chat-avatar" aria-hidden="true">${(m.fromName[0] ?? "?").toUpperCase()}</span>
        <span class="chat-body"><span class="chat-name ch-${m.channel}">${m.fromName}</span><span class="chat-time">${hh}</span><br />${formatChatHtml(m.text)}</span>`;
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
  const posted = s.offers.filter((x) => x.state === "posted");
  if (posted.length === 0) {
    offerList.innerHTML = `<p class="muted">No open offers on the Wall.</p>`;
  }
  for (const o of posted) {
    const row = document.createElement("div");
    row.className = "offer-card";
    const mine = o.posterId === s.player.id;
    row.innerHTML = `<div class="offer-flow">
        <span class="offer-give">${stackList(o.give)}</span>
        <span class="offer-arrow" aria-label="for">${ARROW_SVG}</span>
        <span class="offer-want">${stackList(o.want)}</span>
      </div>
      ${mine ? `<span class="muted">yours</span>` : `<button class="small primary" data-acc="${o.id}">Accept</button>`}`;
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
    row.className = "mkt-row";
    row.innerHTML = `<span class="mkt-qty">${resourceIcon(o.resource)}${o.amount} ${resourceShort(o.resource)}</span>
      <span class="mkt-price">${o.priceRations} Rations</span>
      ${
        o.sellerId === s.player.id
          ? `<span class="muted">yours</span>`
          : `<button class="small primary" data-buy="${o.id}">Buy</button>`
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
    glyphKind: kind,
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
        ? `${prettyKind(st.construction.kind)} ${st.construction.workerHoursDone.toFixed(1)}/${st.construction.workerHoursRequired.toFixed(1)} h`
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
  const unitKinds: ("bowmen" | "spearmen" | "chariot_warriors")[] = [
    "bowmen",
    "spearmen",
    "chariot_warriors",
  ];
  const unitTitle: Record<string, string> = {
    bowmen: "Bowmen",
    spearmen: "Spearmen",
    chariot_warriors: "Chariots",
  };
  const unitCards = unitKinds
    .map((k) => {
      const count = st.units.find((u) => u.kind === k)?.count ?? 0;
      return `<div class="unit-card">
        <span class="unit-glyph">${GLYPHS[UNIT_GLYPH[k] ?? "spear"]}</span>
        <strong>${unitTitle[k]}</strong>
        <span class="unit-count">${count}</span>
        <span class="muted">1 Ration/h each</span>
        <button class="small secondary" data-train="${k}">Train</button>
      </div>`;
    })
    .join("");
  panel.innerHTML = `
    <h2>Military & Monuments</h2>
    <p class="muted">Units guard your shore and take monument grounds. Every soldier eats.</p>
    <div class="unit-cards">${unitCards}</div>
    <h3>Held monuments</h3>
    <div id="mon-list"></div>
    <h3>Envoy</h3>
    <button id="envoy" class="small secondary">Dispatch envoy (GH7+)</button>
    <h3>Shrine offering</h3>
    <button id="shrine" class="small secondary">Contribute 1 patron good</button>
  `;
  panel.querySelectorAll<HTMLButtonElement>("[data-train]").forEach((btn) => {
    btn.onclick = () => {
      const kind = btn.dataset.train as "bowmen" | "spearmen" | "chariot_warriors";
      const def = UNIT_COSTS[kind];
      const el = document.getElementById("building-inspect")!;
      renderGenericPopup(el, {
        title: kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        subtitle: def.note,
        glyphName: UNIT_GLYPH[kind] ?? "spear",
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
  if (st.monuments.length === 0) {
    mon.innerHTML = `<p class="muted">No monument grounds held. Capture one from the World Map.</p>`;
  }
  for (const m of st.monuments) {
    const siteName = s.map.sites.find((x) => x.id === m.siteId)?.name ?? m.siteId;
    const row = document.createElement("div");
    row.className = "b-card";
    row.innerHTML = `<div class="b-card-head">
        <span class="b-card-glyph">${GLYPHS.obelisk}</span>
        <span class="b-card-title"><strong>${siteName}</strong>${levelPips(m.level)}</span>
        <button class="small secondary" data-mw="${m.siteId}">Inspect</button>
      </div>
      <div class="muted">${m.workers} Workers · Limestone ${m.limestone}</div>`;
    row.onclick = () => {
      const el = document.getElementById("building-inspect")!;
      renderGenericPopup(el, {
        title: "Monument hold",
        subtitle: siteName,
        glyphName: "obelisk",
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
      glyphName: "flag",
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
      glyphName: "shrine",
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

/* ── World map: authored papyrus river board ─────────────────────── */

/** Authored marker anchors ON the river banks of the board (640×300). */
const PROVINCE_ANCHORS: [number, number][] = [
  [62, 226],
  [158, 174],
  [258, 150],
  [354, 178],
  [452, 128],
  [548, 78],
];

/** Inline a GLYPHS entry into an outer SVG at (x, y) with size s. */
function glyphAt(name: string, x: number, y: number, size: number, color: string): string {
  const g = GLYPHS[name] ?? GLYPHS.cartouche!;
  return g.replace(
    "<svg ",
    `<svg x="${x}" y="${y}" width="${size}" height="${size}" style="color:${color}" `
  );
}

function buildRiverBoard(
  provinces: { id: string; name: string }[],
  myProvinceId: string | undefined
): string {
  const markers = provinces
    .map((p, i) => {
      const [x, y] = PROVINCE_ANCHORS[i % PROVINCE_ANCHORS.length]!;
      const mine = p.id === myProvinceId;
      const labelW = Math.max(48, p.name.length * 5.6 + 14);
      return `<g class="wm-prov${mine ? " wm-mine" : ""}" data-prov="${p.id}" tabindex="0" role="button"
        aria-label="${p.name}${mine ? " (your province)" : ""}">
        <circle class="halo" cx="${x}" cy="${y}" r="17" fill="#e8c26a"/>
        ${mine ? `<circle class="pulse" cx="${x}" cy="${y}" r="12" fill="none" stroke="#d4a84b" stroke-width="1.6"/>` : ""}
        <circle class="sel-ring" cx="${x}" cy="${y}" r="14" fill="none" stroke="#a97f2e" stroke-width="2"/>
        <circle class="roundel" cx="${x}" cy="${y}" r="10.5" fill="${mine ? "#e2b558" : "#f2e6c6"}" stroke="#6b512c" stroke-width="1.3"/>
        ${glyphAt("ziggurat", x - 6.5, y - 6.5, 13, mine ? "#3d2c0e" : "#8a6b34")}
        <rect x="${x - labelW / 2}" y="${y + 14}" width="${labelW}" height="14" rx="7" fill="#fdf6e4" fill-opacity="0.88" stroke="#c2a26c" stroke-width="0.6"/>
        <text x="${x}" y="${y + 24}" text-anchor="middle" font-size="9.5" font-family="Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif" font-weight="${mine ? 700 : 400}" fill="#4a3413">${p.name}</text>
      </g>`;
    })
    .join("");

  return `
  <svg class="world-river-map" viewBox="0 0 640 300" role="img" aria-label="The Eternal River and its provinces">
    <defs>
      <pattern id="wmFiber" width="26" height="26" patternUnits="userSpaceOnUse">
        <path d="M0 7h26M0 19h26" stroke="#917748" stroke-opacity="0.075"/>
        <path d="M7 0v26M19 0v26" stroke="#917748" stroke-opacity="0.05"/>
      </pattern>
      <linearGradient id="wmRiver" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#1c4761"/>
        <stop offset="0.5" stop-color="#2e6787"/>
        <stop offset="1" stop-color="#1c4761"/>
      </linearGradient>
      <g id="wmPalm" stroke="#7a6134" stroke-linecap="round" fill="none">
        <path d="M0 10V2" stroke-width="1.8"/>
        <path d="M0 2C-3.5 -1 -7 -2 -10 -1.2M0 2c-2-3.5-4.5-6-8-7M0 2c.8-4 .2-7.5-1.6-10M0 2c3.5-3 7-4 10-3.2M0 2c2.4-3.2 5.2-5.2 8.6-6" stroke-width="1.2"/>
      </g>
    </defs>

    <!-- papyrus field -->
    <rect width="640" height="300" rx="10" fill="#ead7b2"/>
    <rect width="640" height="300" rx="10" fill="url(#wmFiber)"/>
    <!-- layered desert tones -->
    <path d="M0 0h640v42C520 22 380 56 260 40 160 28 60 52 0 38Z" fill="#dec394" opacity="0.55"/>
    <path d="M0 300v-52c130 20 290-12 430 8 90 12 160 26 210 12v32Z" fill="#d8bc8c" opacity="0.6"/>
    <!-- dune crescents -->
    <g stroke="#c2a26c" stroke-width="1.5" fill="none" opacity="0.6">
      <path d="M74 62q14 -9 28 0"/><path d="M116 78q11 -7 22 0"/>
      <path d="M394 52q13 -8 26 0"/><path d="M444 66q11 -7 22 0"/>
      <path d="M488 226q14 -9 28 0"/><path d="M540 246q12 -7 24 0"/>
      <path d="M180 262q14 -9 28 0"/><path d="M232 276q11 -7 22 0"/>
      <path d="M580 180q12 -7 24 0"/>
    </g>

    <!-- floodplain bands (offset from the banks, not restrokes of the path) -->
    <path d="M0 240c60-8 110-30 158-52 44-20 76-30 104-24 34 7 60 22 96 14 40-9 62-38 96-52 30-12 62-22 96-34" stroke="#7fa85a" stroke-width="9" fill="none" opacity="0.2" stroke-linecap="round"/>
    <path d="M0 272c66-8 124-34 174-58 42-20 72-28 98-23 34 7 62 24 100 15 42-9 66-40 100-55 28-12 58-21 92-32" stroke="#8fae66" stroke-width="7" fill="none" opacity="0.16" stroke-linecap="round"/>

    <!-- the Eternal River: closed tapering body -->
    <path d="M0 246c62-10 112-32 158-54 44-21 74-30 100-24 32 7 58 21 94 13 40-9 62-37 96-51 30-13 64-23 98-35 12-4 24-9 34-14l-8-20c-10 5-22 10-34 14-34 12-68 23-99 36-35 15-57 42-94 50-32 7-56-7-90-14-30-6-64 4-110 26-46 21-94 42-152 51z" fill="url(#wmRiver)"/>
    <!-- darker center line -->
    <path d="M0 236c60-10 108-31 154-52 45-21 76-31 104-25 33 7 58 21 93 13 39-9 61-36 95-51 31-13 64-24 98-36 11-4 21-8 30-12" stroke="#123448" stroke-width="2.2" fill="none" opacity="0.5"/>
    <!-- inner highlight -->
    <path d="M0 231c58-10 104-30 150-51 45-21 78-32 106-26 33 7 59 21 94 13 39-9 62-36 96-51 30-13 62-23 96-35" stroke="#6fa7c4" stroke-width="2.6" fill="none" opacity="0.5"/>
    <!-- bank highlights -->
    <path d="M0 226c62-10 110-31 156-53 44-21 76-31 102-25 32 7 58 21 94 13 40-9 62-37 96-51 30-13 64-23 98-35 12-4 24-9 34-14" stroke="#f8eed3" stroke-width="1.4" fill="none" opacity="0.7"/>
    <path d="M0 246c62-10 112-32 158-54 44-21 74-30 100-24 32 7 58 21 94 13 40-9 62-37 96-51 30-13 64-23 98-35 12-4 24-9 34-14" stroke="#a98d5e" stroke-width="1.3" fill="none" opacity="0.55"/>
    <!-- delta fan into the far sea -->
    <g stroke="url(#wmRiver)" fill="none" stroke-linecap="round">
      <path d="M578 66c16-8 30-18 46-32" stroke-width="8"/>
      <path d="M580 74c18 0 34 6 46 16" stroke-width="7"/>
      <path d="M582 70c14-4 28-4 40-2" stroke-width="5"/>
    </g>

    <!-- palm and reed accents -->
    <use href="#wmPalm" transform="translate(96 150)"/>
    <use href="#wmPalm" transform="translate(112 158) scale(0.8)"/>
    <use href="#wmPalm" transform="translate(300 210) scale(0.9)"/>
    <use href="#wmPalm" transform="translate(314 218) scale(0.7)"/>
    <use href="#wmPalm" transform="translate(478 160) scale(0.85)"/>
    <use href="#wmPalm" transform="translate(560 132) scale(0.7)"/>
    <g stroke="#6d7c46" stroke-width="1.3" stroke-linecap="round" opacity="0.7">
      <path d="M212 186v-9M217 187v-11M222 186v-8"/>
      <path d="M402 138v-9M407 139v-11M412 138v-8"/>
    </g>

    ${markers}
  </svg>`;
}

const SITE_GLYPH: Record<string, string> = {
  city: "ziggurat",
  monument: "obelisk",
  founding: "flag",
  ancestral: "cartouche",
};

function renderMap(s: PublicSnapshot) {
  const panel = document.getElementById("panel-map")!;
  const st = s.settlements[0];
  const myMap = st?.mapArchetypeId?.replace(/_/g, " ") ?? "—";
  const provinces = s.map.provinces ?? [];
  const provName = (id: string | undefined) =>
    provinces.find((p) => p.id === id)?.name ?? "the river";

  const filterChip = (kf: string, glyphName: string | null, label: string) =>
    `<button type="button" data-kf="${kf}" class="${mapKindFilter === kf ? "active" : ""}">${glyphName ? GLYPHS[glyphName] : ""}${label}</button>`;

  panel.innerHTML = `<h2>World Map — Eternal River</h2>
    <p class="muted">Your shore: <strong>${st ? RESOURCE_LABELS[st.uniqueLuxury] : "—"}</strong> on <strong>${myMap}</strong> · ${provName(st?.provinceId)}</p>
    ${buildRiverBoard(provinces, st?.provinceId)}
    <div class="map-filter" id="map-filter">
      ${filterChip("all", null, "All")}
      ${filterChip("city", "ziggurat", "Cities")}
      ${filterChip("monument", "obelisk", "Monuments")}
      ${filterChip("founding", "flag", "Open shores")}
    </div>
    <p class="muted">Six provinces line the Eternal River; newcomers are settled where their luxury is scarcest, so every shore has something to trade.</p>
    <div class="map-grid" id="map-grid"></div>`;

  const grid = panel.querySelector("#map-grid")!;

  const applyFilters = () => {
    grid.querySelectorAll<HTMLButtonElement>(".map-site").forEach((b) => {
      const okKind = mapKindFilter === "all" || b.dataset.kind === mapKindFilter;
      const okProv = !mapProvFilter || b.dataset.prov === mapProvFilter;
      b.hidden = !(okKind && okProv);
    });
    panel.querySelectorAll<HTMLButtonElement>("#map-filter button").forEach((b) => {
      b.classList.toggle("active", b.dataset.kf === mapKindFilter);
    });
    panel.querySelectorAll<SVGGElement>(".wm-prov").forEach((g) => {
      g.classList.toggle("sel", g.getAttribute("data-prov") === mapProvFilter);
    });
  };

  panel.querySelectorAll<HTMLButtonElement>("#map-filter button").forEach((b) => {
    b.addEventListener("click", () => {
      mapKindFilter = b.dataset.kf ?? "all";
      applyFilters();
    });
  });

  panel.querySelectorAll<SVGGElement>(".wm-prov").forEach((g) => {
    const pick = () => {
      const id = g.getAttribute("data-prov");
      mapProvFilter = mapProvFilter === id ? null : id;
      applyFilters();
    };
    g.addEventListener("click", pick);
    g.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") {
        e.preventDefault();
        pick();
      }
    });
  });

  const clearCardSel = () => {
    grid.querySelectorAll(".map-site.selected").forEach((x) => x.classList.remove("selected"));
  };

  for (const site of s.map.sites) {
    const btn = document.createElement("button");
    btn.className = `map-site ${site.kind}`;
    btn.type = "button";
    btn.dataset.kind = site.kind;
    btn.dataset.prov = site.provinceId;
    const status =
      site.kind === "city"
        ? site.ownerPlayerId === s.player.id
          ? "Your city"
          : "Player city"
        : site.kind === "monument"
          ? site.ownerPlayerId
            ? "Held grounds"
            : "Bandit-held"
          : site.kind === "founding"
            ? site.ownerPlayerId
              ? "Claimed shore"
              : "Open shore"
            : "River site";
    btn.innerHTML = `<span class="site-glyph">${GLYPHS[SITE_GLYPH[site.kind] ?? "cartouche"]}</span>
      <span class="site-info"><strong>${site.name}</strong><span class="muted">${provName(site.provinceId)} · ${status}</span></span>`;
    btn.onclick = () => {
      const el = document.getElementById("building-inspect")!;
      const st = settlement();
      clearCardSel();
      btn.classList.add("selected");
      const closeSite = () => {
        clearCardSel();
        hidePopup(el);
      };
      if (site.kind === "monument") {
        renderGenericPopup(el, {
          title: site.name,
          subtitle: `Monument grounds · ${provName(site.provinceId)}`,
          glyphName: "obelisk",
          what: "Bandit-held monument site. Capture with military power to harvest Limestone and gain empire-wide production/transport bonuses.",
          details: [
            `Defending force: ${site.banditForce ?? "—"}`,
            site.ownerPlayerId ? "Held by another ruler" : "Unheld — capturable",
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
              closeSite();
            } catch (e) {
              handlers.onToast((e as Error).message);
            }
          },
          onClose: closeSite,
        });
      } else if (site.kind === "founding") {
        renderGenericPopup(el, {
          title: site.name,
          subtitle: `Founding site · ${provName(site.provinceId)}`,
          glyphName: "flag",
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
              closeSite();
            } catch (e) {
              handlers.onToast((e as Error).message);
            }
          },
          onClose: closeSite,
        });
      } else if (site.kind === "city") {
        const id = site.id.replace(/^city-/, "");
        renderGenericPopup(el, {
          title: site.name,
          subtitle: `Player city · ${provName(site.provinceId)}`,
          glyphName: "ziggurat",
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
              closeSite();
            } catch (e) {
              handlers.onToast((e as Error).message);
            }
          },
          onClose: closeSite,
        });
      } else {
        renderGenericPopup(el, {
          title: site.name,
          subtitle: provName(site.provinceId),
          glyphName: "cartouche",
          what: "A marked place on the eternal river.",
          details: [`Province: ${provName(site.provinceId)}`],
          onClose: closeSite,
        });
      }
    };
    grid.appendChild(btn);
  }

  applyFilters();
}
