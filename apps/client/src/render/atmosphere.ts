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
  /** 02.9 Step 2 — minimal fog for board readability */
  private boardApprovalFog = false;

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

  setBoardApprovalFog(on: boolean) {
    this.boardApprovalFog = on;
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
    // Clear colony-board day key — readable solid buildings (Surviving Mars)
    this.sun.intensity = 1.9 - n * 1.35;
    // Sun path: high warm day key -> long low western dusk -> faint moon.
    // Judges: "dusk is the day shot with an orange tint" — direction must move.
    const dayDir = new Vector3(-0.7, -0.55, 0.42);
    const duskDir = new Vector3(-0.97, -0.2, 0.1);
    const nightDir = new Vector3(-0.45, -0.5, 0.3);
    const dir =
      n < 0.5
        ? Vector3.Lerp(dayDir, duskDir, n * 2)
        : Vector3.Lerp(duskDir, nightDir, (n - 0.5) * 2);
    this.sun.direction = dir.normalize();
    this.sun.position = new Vector3(14, 26 - n * 14, -8);

    this.hemi.intensity = 0.52 - n * 0.32;
    this.hemi.diffuse = Color3.Lerp(
      hexToColor3("#F0E8D8"),
      hexToColor3("#1A2840"),
      n
    );
    this.hemi.groundColor = hexToColor3(STYLE.sandDeep).scale(0.28 * (1 - n * 0.75));

    // Day clear matches desert sand so map fringe never reads as void edge
    const clearDay = Color4.FromColor3(hexToColor3("#C4B490"), 1);
    const clearDusk = Color4.FromColor3(hexToColor3("#B86848"), 1);
    const clearNight = Color4.FromColor3(hexToColor3("#070C12"), 1);
    this.scene.clearColor =
      n < 0.5
        ? Color4.Lerp(clearDay, clearDusk, n * 2)
        : Color4.Lerp(clearDusk, clearNight, (n - 0.5) * 2);

    // Subtle desert heat + soft far falloff (depth without soup) (02.8/03)
    // Board approval law: fog minimal — the fixed board camera sits ~48 units
    // out, so density 0.012 washed 28% grey over every building. Near-zero
    // density keeps depth cue without the film.
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    const fogScale = this.boardApprovalFog ? 0.35 : 1;
    if (n < 0.35) {
      this.scene.fogDensity = 0.012 * fogScale;
      this.scene.fogColor = hexToColor3("#C4B898");
    } else if (n < 0.7) {
      this.scene.fogDensity = 0.015 * fogScale;
      this.scene.fogColor = hexToColor3("#B8A080");
    } else {
      this.scene.fogDensity = 0.018 * fogScale;
      this.scene.fogColor = hexToColor3("#101820");
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
