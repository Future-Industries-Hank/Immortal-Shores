/**
 * Day → dusk → night lighting, fog, and river atmosphere.
 * Presentation only — no sim coupling.
 */
import {
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  Scene,
  Vector3,
  type Mesh,
  type StandardMaterial,
} from "@babylonjs/core";
import { STYLE } from "@immortal/shared";
import { hexToColor3 } from "./colors.js";

export type DayPhase = "day" | "dusk" | "night";

export class Atmosphere {
  private sun: DirectionalLight;
  private hemi: HemisphericLight;
  private t0 = performance.now() * 0.001;
  /** Full cycle seconds (default ~90s for readable TOD in playtest). */
  cycleSeconds = 90;
  private pausedPhase: DayPhase | null = null;

  constructor(
    private scene: Scene,
    sun: DirectionalLight,
    hemi: HemisphericLight
  ) {
    this.sun = sun;
    this.hemi = hemi;
    // Fog off by default in ortho iso — EXP fog often washes near ground into white wedges
    this.scene.fogMode = Scene.FOGMODE_NONE;
    this.scene.fogDensity = 0;
    this.scene.fogColor = hexToColor3("#B8C8D0");
  }

  /** 0 day → 0.5 dusk → 1 night. */
  phase01(now = performance.now() * 0.001): number {
    if (this.pausedPhase === "day") return 0;
    if (this.pausedPhase === "dusk") return 0.5;
    if (this.pausedPhase === "night") return 1;
    const u = ((now - this.t0) / this.cycleSeconds) % 1;
    // Long day, short dusk/night
    if (u < 0.55) return 0;
    if (u < 0.7) return (u - 0.55) / 0.15;
    if (u < 0.85) return 1;
    return 1 - (u - 0.85) / 0.15;
  }

  nightFactor(now?: number): number {
    return this.phase01(now);
  }

  phaseName(now?: number): DayPhase {
    const p = this.phase01(now);
    if (p < 0.25) return "day";
    if (p < 0.7) return "dusk";
    return "night";
  }

  setPhase(phase: DayPhase | null) {
    this.pausedPhase = phase;
  }

  update(now = performance.now() * 0.001, river?: Mesh | null) {
    const n = this.phase01(now);
    const dayColor = hexToColor3("#FFD9A0");
    const duskColor = hexToColor3("#E08050");
    const nightColor = hexToColor3("#2A3858");
    const sunCol =
      n < 0.5
        ? Color3.Lerp(dayColor, duskColor, n * 2)
        : Color3.Lerp(duskColor, nightColor, (n - 0.5) * 2);
    this.sun.diffuse = sunCol;
    // Strong key + raking angle for long contact shadows (day & dusk)
    this.sun.intensity = 1.55 - n * 1.25;
    // More horizontal sun = longer shadows on ground
    const elev = n < 0.35 ? -0.55 : n < 0.7 ? -0.4 : -0.35;
    this.sun.direction = new Vector3(-0.95, elev, 0.55);

    this.hemi.intensity = 0.55 - n * 0.42;
    this.hemi.diffuse = Color3.Lerp(
      hexToColor3("#E8F0F8"),
      hexToColor3("#1A2840"),
      n
    );
    this.hemi.groundColor = hexToColor3(STYLE.sandDeep).scale(0.35 * (1 - n * 0.7));

    // Day sky leans warm-sand so ground edge never reads as pure black void
    const clearDay = Color4.FromColor3(hexToColor3("#A8B8B0"), 1);
    const clearDusk = Color4.FromColor3(hexToColor3("#C07050"), 1);
    const clearNight = Color4.FromColor3(hexToColor3("#0A1018"), 1);
    this.scene.clearColor =
      n < 0.5
        ? Color4.Lerp(clearDay, clearDusk, n * 2)
        : Color4.Lerp(clearDusk, clearNight, (n - 0.5) * 2);

    // Distance falloff so far sand softens (depth + atmosphere in stills)
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    if (n < 0.35) {
      this.scene.fogDensity = 0.019;
      this.scene.fogColor = hexToColor3("#C4B490");
    } else if (n < 0.7) {
      this.scene.fogDensity = 0.024;
      this.scene.fogColor = hexToColor3("#B88860");
    } else {
      this.scene.fogDensity = 0.028;
      this.scene.fogColor = hexToColor3("#101820");
    }

    if (river) {
      const rm = river.material as StandardMaterial | null;
      if (rm) {
        const deep = hexToColor3(STYLE.riverDeep);
        const light = hexToColor3(STYLE.riverLight);
        rm.diffuseColor = Color3.Lerp(light, deep, 0.4 + n * 0.4);
        rm.specularColor = light.scale(0.35 + (1 - n) * 0.25);
        rm.alpha = 0.88;
        rm.emissiveColor = light.scale(0.04 + Math.sin(now * 1.4) * 0.02);
      }
    }
  }
}
