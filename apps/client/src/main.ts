import { api, getToken, setToken, takeAuthMessage } from "./api.js";
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

// A token can die mid-session (expiry, server-side reap), and api.ts signals that
// by clearing it and firing immortal:signed-out. Without this the game screen just
// stops updating, so fall back to the login form and say why.
function showAuthScreen(message?: string | null) {
  authEl.hidden = false;
  gameEl.hidden = true;
  const err = document.getElementById("auth-error")!;
  const msg = message ?? takeAuthMessage();
  if (msg) {
    err.hidden = false;
    err.textContent = msg;
  }
}

window.addEventListener("immortal:signed-out", (e) => {
  showAuthScreen((e as CustomEvent<string>).detail);
});

async function enterGame() {
  authEl.hidden = true;
  gameEl.hidden = false;
  const canvas = document.getElementById("view") as HTMLCanvasElement;
  view = new SettlementView(canvas);
  // No detail picker in the HUD any more — everyone gets the medium preset,
  // and the day/night cycle stays on auto (the scene's own default).
  view.setQuality("med" satisfies Quality);

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
  // Capture tooling: ?closeup=<kind> frames one hero for judge evidence.
  // Debug-only path — the product board never reaches any of this.
  //
  // Why the extra frustum step: scene.setOrtho() clamps every frame to a
  // MIN_HALF_WIDTH (11.5 world units) so the whole settlement still fits on a
  // narrow phone. That clamp also floors the closeup: at radius 7 the derived
  // half-width is 5.9, so the clamp inflated it back to 11.5 — the closeup
  // could never actually get close, AND the inflated frame ran off the south
  // edge of the terrain mesh, letting the day clear colour (#C9A972) through
  // as a flat ~29px band at the bottom of 15/16. Re-deriving the frustum here
  // after prepareCloseup() fixes both without touching setOrtho or the board.
  const qp = new URLSearchParams(location.search);
  const closeupKind = qp.get("closeup");
  if (closeupKind) {
    // world half-width of the closeup frame; ?closeupHalf= overrides
    const halfW = Math.max(1, Number(qp.get("closeupHalf")) || 6);
    const tighten = (half = halfW) => {
      const v = view;
      if (!v) return;
      const aspect =
        v.engine.getRenderWidth() / Math.max(1, v.engine.getRenderHeight());
      v.camera.orthoLeft = -half;
      v.camera.orthoRight = half;
      v.camera.orthoTop = half / aspect;
      v.camera.orthoBottom = -half / aspect;
    };
    const frameHero = () => {
      const ok = view?.prepareCloseup(closeupKind) ?? false;
      tighten(); // prepareCloseup() ends in setOrtho(), so re-derive after it
      return ok;
    };
    frameHero();
    setTimeout(frameHero, 800); // re-apply once kits/snapshot settle
    setTimeout(frameHero, 2000);
    // scene.ts re-runs setOrtho on every resize; re-tighten behind it
    window.addEventListener("resize", () => setTimeout(tighten, 0));
    (window as unknown as { __closeup?: (k: string, h?: number) => boolean }).__closeup = (
      k: string,
      h?: number
    ) => {
      const ok = view?.prepareCloseup(k) ?? false;
      tighten(h && h > 0 ? h : halfW);
      return ok;
    };
  }
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
    // frustum, so the harness can assert framing instead of guessing from px
    orthoLeft: view?.camera.orthoLeft,
    orthoRight: view?.camera.orthoRight,
    orthoTop: view?.camera.orthoTop,
    orthoBottom: view?.camera.orthoBottom,
    target: view ? { x: view.camera.target.x, z: view.camera.target.z } : null,
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
    const luxName = lux.replace(/_/g, " ");
    toast(
      `${prov.name}: your unique luxury is ${luxName} — trade for the rest`
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
    showAuthScreen();
  });
}
