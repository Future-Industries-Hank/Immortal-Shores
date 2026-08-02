import { api, getToken, setToken } from "./api.js";
import { SettlementView, type Quality } from "./render/scene.js";
import {
  initUi,
  renderSnapshot,
  selectBuilding,
  selectConstruction,
  selectPad,
} from "./ui.js";
import { applyAppearance, initModern, renderModernHud } from "./modern.js";
import type { PublicSnapshot } from "@immortal/shared";
import { sfx } from "./audio.js";

const authEl = document.getElementById("auth")!;
const gameEl = document.getElementById("game")!;
const toastEl = document.getElementById("toast")!;

let view: SettlementView | null = null;
let snap: PublicSnapshot | null = null;

function toast(msg: string) {
  toastEl.hidden = false;
  toastEl.textContent = msg;
  setTimeout(() => {
    toastEl.hidden = true;
  }, 3200);
}

function applySnapshot(s: PublicSnapshot) {
  snap = s;
  renderSnapshot(s);
  renderModernHud(s);
  applyAppearance(s);
  if (view && s.settlements[0]) view.sync(s.settlements[0]);
}

function layoutCanvas() {
  // Babylon needs a resize when the viewport reflows (bars, orientation)
  window.dispatchEvent(new Event("resize"));
}

async function enterGame() {
  authEl.hidden = true;
  gameEl.hidden = false;
  const canvas = document.getElementById("view") as HTMLCanvasElement;
  view = new SettlementView(canvas);
  const q = document.getElementById("quality") as HTMLSelectElement;
  view.setQuality(q.value as Quality);
  q.addEventListener("change", () => view?.setQuality(q.value as Quality));
  const tod = document.getElementById("tod") as HTMLSelectElement | null;
  tod?.addEventListener("change", () => {
    const v = tod.value;
    if (v === "auto") view?.setDayPhase(null);
    else view?.setDayPhase(v as "day" | "dusk" | "night");
  });

  // Keep canvas sized when top/bottom bars reflow
  const viewport = document.getElementById("viewport");
  if (viewport && "ResizeObserver" in window) {
    new ResizeObserver(() => layoutCanvas()).observe(viewport);
  }
  requestAnimationFrame(layoutCanvas);

  // 3D → UI only (do not bounce clearSelection back into UI)
  view.setSelectHandler((ev) => {
    if (ev.type === "building") {
      selectBuilding(ev.buildingId, { fromScene: true });
      sfx.ok();
    } else if (ev.type === "construction") {
      selectConstruction(ev.plotId, { fromScene: true });
      sfx.ok();
    } else if (ev.type === "pad") {
      selectPad(ev.plotId, { fromScene: true });
      sfx.ok();
    } else {
      selectBuilding(null, { fromScene: true });
      selectConstruction(null, { fromScene: true });
    }
  });

  initUi({
    onSnapshot: applySnapshot,
    onToast: toast,
    onPostcard: async () => {
      if (!view || !snap?.settlements[0]) return;
      try {
        const dataUrl = view.captureDataUrl();
        await api.postcard(snap.settlements[0].id, dataUrl);
        sfx.ok();
        toast("Postcard saved for visits");
      } catch (e) {
        toast((e as Error).message);
      }
    },
    onHighlightBuilding: (id) => view?.highlightBuilding(id),
    onHighlightPad: (plotId) => view?.highlightPad(plotId),
    onHighlightConstruction: (plotId) => view?.highlightConstruction(plotId),
  });

  initModern({ onSnapshot: applySnapshot, onToast: toast });

  const s = await api.me();
  applySnapshot(s);
  // 02.9: fixed full-settlement board is the product default (no free zoom)
  const showBoardLabel =
    new URLSearchParams(location.search).get("board") === "1" ||
    new URLSearchParams(location.search).get("standard") === "1";
  view.prepareStandardBoard();
  requestAnimationFrame(() => view?.prepareStandardBoard());
  (window as unknown as {
    __prepareStandardBoard?: () => void;
    __boardDebug?: () => unknown;
  }).__prepareStandardBoard = () => view?.prepareStandardBoard();
  (window as unknown as { __boardDebug?: () => unknown }).__boardDebug = () => ({
    board: view?.isBoardApprovalMode(),
    radius: view?.camera.radius,
    beta: view?.camera.beta,
    alpha: view?.camera.alpha,
    fps: view?.getFps(),
  });
  if (showBoardLabel) {
    const lab = document.createElement("div");
    lab.id = "standard-view-label";
    lab.textContent = "STANDARD VIEW — approve POV & scale";
    lab.style.cssText =
      "position:fixed;top:52px;left:50%;transform:translateX(-50%);z-index:20;" +
      "background:rgba(20,16,12,0.85);color:#f3e6c8;padding:0.35rem 0.85rem;" +
      "border:1px solid rgba(212,168,75,0.5);border-radius:6px;font:600 0.8rem system-ui;pointer-events:none";
    document.body.appendChild(lab);
  }

  // Show province + map + unique luxury on first load
  const st0 = s.settlements[0];
  const lux = st0?.uniqueLuxury;
  const prov = s.map.provinces.find((p) => p.id === st0?.provinceId);
  if (lux && prov) {
    const mapName = (st0?.mapArchetypeId ?? prov.id).replace(/_/g, " ");
    toast(
      `${prov.name} · ${mapName}: unique ${lux.replace(/_/g, " ")} — trade for the rest`
    );
  }

  window.addEventListener("keydown", (e) => {
    if (!view) return;
    // Fixed board product: no pan via arrows (02.9/03 camera lock)
    if (view.isBoardApprovalMode()) {
      if (e.key === "Escape") selectBuilding(null, { fromScene: true });
      return;
    }
    const step = 0.9;
    if (e.key === "ArrowLeft") view.camera.target.x -= step;
    if (e.key === "ArrowRight") view.camera.target.x += step;
    if (e.key === "ArrowUp") view.camera.target.z += step;
    if (e.key === "ArrowDown") view.camera.target.z -= step;
    if (e.key === "Escape") selectBuilding(null, { fromScene: true });
  });

  setInterval(async () => {
    try {
      if (getToken()) applySnapshot(await api.me());
    } catch {
      /* ignore */
    }
  }, 20000);
}

async function tryAuth(mode: "register" | "login") {
  const name = (document.getElementById("auth-name") as HTMLInputElement).value;
  const password = (document.getElementById("auth-pass") as HTMLInputElement).value;
  const err = document.getElementById("auth-error")!;
  err.hidden = true;
  try {
    const res =
      mode === "register"
        ? await api.register(name, password)
        : await api.login(name, password);
    setToken(res.token);
    sfx.ok();
    await enterGame();
  } catch (e) {
    err.hidden = false;
    err.textContent = (e as Error).message;
    sfx.warn();
  }
}

document.getElementById("btn-register")!.addEventListener("click", () => tryAuth("register"));
document.getElementById("btn-login")!.addEventListener("click", () => tryAuth("login"));

if (getToken()) {
  enterGame().catch(() => {
    setToken(null);
    authEl.hidden = false;
    gameEl.hidden = true;
  });
}
