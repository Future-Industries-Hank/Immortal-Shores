import { api, getToken, setToken } from "./api.js";
import { SettlementView, type Quality } from "./render/scene.js";
import {
  initUi,
  renderSnapshot,
  selectBuilding,
  selectPad,
} from "./ui.js";
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
  if (view && s.settlements[0]) view.sync(s.settlements[0]);
}

async function enterGame() {
  authEl.hidden = true;
  gameEl.hidden = false;
  const canvas = document.getElementById("view") as HTMLCanvasElement;
  view = new SettlementView(canvas);
  const q = document.getElementById("quality") as HTMLSelectElement;
  view.setQuality(q.value as Quality);
  q.addEventListener("change", () => view?.setQuality(q.value as Quality));

  // 3D → UI only (do not bounce clearSelection back into UI)
  view.setSelectHandler((ev) => {
    if (ev.type === "building") {
      selectBuilding(ev.buildingId, { fromScene: true });
      sfx.ok();
    } else if (ev.type === "pad") {
      selectPad(ev.plotId, { fromScene: true });
      sfx.ok();
    } else {
      selectBuilding(null, { fromScene: true });
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
  });

  const s = await api.me();
  applySnapshot(s);

  // Show province + unique luxury on first load
  const lux = s.settlements[0]?.uniqueLuxury;
  const prov = s.map.provinces.find((p) => p.id === s.settlements[0]?.provinceId);
  if (lux && prov) {
    toast(
      `${prov.name}: your unique luxury is ${lux.replace(/_/g, " ")} — trade for the rest`
    );
  }

  window.addEventListener("keydown", (e) => {
    if (!view) return;
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
