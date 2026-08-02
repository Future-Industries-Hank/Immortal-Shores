/**
 * Day → dusk → night lighting, fog, and river atmosphere.
 * Presentation only — no sim coupling.
 */
import {
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  PointLight,
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
  private ghLight: PointLight;
  private marketLight: PointLight;
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
    // Local warm lights for night (Great House + Market)
    this.ghLight = new PointLight("ghLight", new Vector3(-2.2, 2.2, 0.5), scene);
    this.ghLight.diffuse = hexToColor3("#FFB060");
    this.ghLight.intensity = 0;
    this.ghLight.range = 8;
    this.marketLight = new PointLight("mktLight", new Vector3(2.5, 1.8, 1.5), scene);
    this.marketLight.diffuse = hexToColor3("#FFD080");
    this.marketLight.intensity = 0;
    this.marketLight.range = 6;
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
    const dayColor = hexToColor3("#FFE0A8");
    const duskColor = hexToColor3("#E07040");
    const nightColor = hexToColor3("#1A2840");
    const sunCol =
      n < 0.5
        ? Color3.Lerp(dayColor, duskColor, n * 2)
        : Color3.Lerp(duskColor, nightColor, (n - 0.5) * 2);
    this.sun.diffuse = sunCol;
    // Hard key + very low rake = long black bars on open sand (day money-shot)
    this.sun.intensity = 2.05 - n * 1.55;
    const elev = n < 0.35 ? -0.28 : n < 0.7 ? -0.24 : -0.22;
    this.sun.direction = new Vector3(-1.35, elev, 0.85);
    this.sun.position = new Vector3(28, 14, -18);

    // Low fill so rakes survive stills
    this.hemi.intensity = 0.28 - n * 0.2;
    this.hemi.diffuse = Color3.Lerp(
      hexToColor3("#D8E4EC"),
      hexToColor3("#121C28"),
      n
    );
    this.hemi.groundColor = hexToColor3(STYLE.sandDeep).scale(0.28 * (1 - n * 0.75));

    // Day sky cooler-haze so far sand falloff is readable against clear color
    const clearDay = Color4.FromColor3(hexToColor3("#9AA8A0"), 1);
    const clearDusk = Color4.FromColor3(hexToColor3("#B86848"), 1);
    const clearNight = Color4.FromColor3(hexToColor3("#070C12"), 1);
    this.scene.clearColor =
      n < 0.5
        ? Color4.Lerp(clearDay, clearDusk, n * 2)
        : Color4.Lerp(clearDusk, clearNight, (n - 0.5) * 2);

    // Aggressive EXP2 fog — far sand MUST desaturate vs near at mid-iso
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    if (n < 0.35) {
      this.scene.fogDensity = 0.056;
      this.scene.fogColor = hexToColor3("#A09880");
    } else if (n < 0.7) {
      this.scene.fogDensity = 0.06;
      this.scene.fogColor = hexToColor3("#906848");
    } else {
      this.scene.fogDensity = 0.062;
      this.scene.fogColor = hexToColor3("#0A1016");
    }

    // Night local lamps (window/hearth falloff — not roof flood)
    this.ghLight.intensity = n > 0.55 ? 2.2 * (n - 0.4) : 0;
    this.marketLight.intensity = n > 0.55 ? 1.6 * (n - 0.4) : 0;

    // PRESERVE dark depth water — never lerp toward candy riverLight
    if (river) {
      const rm = river.material as StandardMaterial | null;
      if (rm) {
        const deep = hexToColor3("#061820");
        const mid = hexToColor3("#0C2838");
        rm.diffuseColor = Color3.Lerp(mid, deep, 0.55 + n * 0.35);
        rm.specularColor = hexToColor3("#6AA8C0").scale(0.35 + (1 - n) * 0.2);
        rm.specularPower = 72;
        rm.alpha = 0.97;
        rm.emissiveColor = deep.scale(0.12 + Math.sin(now * 1.1) * 0.02);
      }
    }
  }
}
