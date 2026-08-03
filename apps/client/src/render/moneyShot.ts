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

/**
 * Standard board view (02.9 Step 2): high classic isometric full settlement.
 * Matches director POV law — whole river + pads + buildings visible, no people close-up.
 */
export function applyStandardBoardCamera(camera: ArcRotateCamera) {
  // High classic isometric full-board (director POV law)
  camera.alpha = -Math.PI / 3.5;
  camera.beta = 0.78; // more top-down than mid-iso money-shot
  // Owner law (full-overhaul goal): board was too zoomed out at 48 —
  // settlement + river should FILL the frame. Still fixed: no wheel zoom.
  camera.radius = 30;
  camera.target.set(-1.8, 0, 2.4);
  camera.lowerRadiusLimit = 30;
  camera.upperRadiusLimit = 30;
  camera.lowerBetaLimit = 0.78;
  camera.upperBetaLimit = 0.78;
  camera.lowerAlphaLimit = camera.alpha;
  camera.upperAlphaLimit = camera.alpha;
  camera.panningSensibility = 0;
  camera.wheelPrecision = 100000;
  camera.pinchPrecision = 100000;
  camera.angularSensibilityX = 1000000;
  camera.angularSensibilityY = 1000000;
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
