/**
 * Stack-1 money shot: settlement day mid-iso, resource strip only.
 * Used by capture loops so judge frames are comparable.
 */
import type { ArcRotateCamera } from "@babylonjs/core";

/** Fixed camera framing for day mid-iso money shot. */
export function applyMoneyShotCamera(camera: ArcRotateCamera) {
  camera.alpha = -Math.PI / 3.05;
  camera.beta = Math.PI / 3.15;
  // Tight mid-iso — settlement fills frame (not postage stamp on void)
  camera.radius = 24;
  camera.target.set(-1.5, 0.2, 1.8);
}

/** Hide junk overlays so capture is world + top resource strip only. */
export function hideCaptureChrome() {
  for (const id of [
    "goals",
    "tutorial",
    "menu-popup",
    "building-inspect",
    "toast",
    "hint",
    "prod-overlay",
    "ration-warn",
    "hub",
  ]) {
    const el = document.getElementById(id);
    if (el) {
      (el as HTMLElement).hidden = true;
      el.style.display = "none";
    }
  }
  // Skip / dismiss any remaining onboarding buttons
  document.querySelectorAll("#tutorial button, .tutorial-panel, .goals-panel").forEach((el) => {
    (el as HTMLElement).style.display = "none";
  });
  document.querySelectorAll("#nav button").forEach((b) => b.classList.remove("active"));
}
