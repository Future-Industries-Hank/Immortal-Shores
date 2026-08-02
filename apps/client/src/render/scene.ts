import {
  ActionManager,
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  Engine,
  ExecuteCodeAction,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointerEventTypes,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
  ArcRotateCamera,
} from "@babylonjs/core";
import {
  PATH_EDGES,
  PATH_NODES,
  ROAD_COLORS,
  SETTLEMENT_PLOTS,
  STYLE,
  getMapArchetype,
  getPathNode,
  getPlot,
  pathBetween,
  plotEntranceNodes,
  plotWorld,
  polylineFromNodeIds,
  roadTierForGhLevel,
  transformPlotPos,
  type BuildingState,
  type MapArchetype,
  type RoadTier,
  type SettlementState,
} from "@immortal/shared";
import { Atmosphere } from "./atmosphere.js";
import {
  animateBuildingKit,
  type BuildingMeshes,
} from "./buildings.js";
import { hexToColor3 } from "./colors.js";
import {
  instantiateBuildingFromKit,
  preloadBuildingKits,
  type KitCache,
} from "./kitLoader.js";
import { applyMoneyShotCamera, applyStandardBoardCamera } from "./moneyShot.js";
import { createPadCategoryMarker } from "./padMarkers.js";

export type Quality = "low" | "med" | "high";

export type SelectEvent =
  | { type: "building"; buildingId: string }
  | { type: "pad"; plotId: string }
  /** Scaffold / pad under active construction job */
  | { type: "construction"; plotId: string }
  | { type: "none" };

export class SettlementView {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  root: TransformNode;
  private buildingNodes = new Map<string, TransformNode>();
  private buildingKits = new Map<string, BuildingMeshes>();
  private hitMeshes = new Map<string, Mesh>();
  private padMeshes = new Map<string, Mesh>();
  private padMats = new Map<string, StandardMaterial>();
  private padIcons = new Map<string, Mesh>();
  private padGhosts = new Map<string, Mesh>();
  private scaffoldNode: TransformNode | null = null;
  private roadRoot: TransformNode | null = null;
  private roadMeshes: Mesh[] = [];
  private roadTier: RoadTier = "dirt";
  private envRoot: TransformNode | null = null;
  private riverMesh: Mesh | null = null;
  private bargeNode: TransformNode | null = null;
  private foamMeshes: Mesh[] = [];
  private dustRoot: TransformNode | null = null;
  private atmosphere: Atmosphere;
  private sun: DirectionalLight;
  private shadowGen: ShadowGenerator | null = null;
  private kitCache: KitCache = new Map();
  private kitsReady = false;
  private mapArch: MapArchetype = getMapArchetype("delta_mouth");
  private workers: WorkerAgent[] = [];
  private quality: Quality = "med";
  private selectedId: string | null = null;
  private selectedPlotId: string | null = null;
  /** Plot currently under construction (scaffold + pad pick targets). */
  private constructionPlotId: string | null = null;
  private selectRing: Mesh | null = null;
  private onSelect: ((ev: SelectEvent) => void) | null = null;
  private pointerDown: { x: number; y: number; t: number } | null = null;
  private occupied = new Set<string>();
  /** Active plot ids that workers may path between */
  private activePlotIds: string[] = [];
  private lastAnimT = performance.now() * 0.001;
  private fpsFrames = 0;
  private fpsLast = performance.now();
  private lastFps = 60;
  private lastSettlement: SettlementState | null = null;
  /** When true, next clearSelection from UI will not re-notify */
  private suppressNotify = false;
  /** 02.9 Step 2 — fixed full-board approval view */
  private boardApprovalMode = false;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: true,
    });
    this.engine.resize();
    this.scene = new Scene(this.engine);
    // Clear color matches desert so any fringe never reads as void map-edge
    this.scene.clearColor = Color4.FromColor3(hexToColor3("#C4B490"), 1);
    this.scene.ambientColor = hexToColor3("#C8B8A0").scale(0.25);

    // Camera looks at settlement center; river is on the left (−X)
    this.camera = new ArcRotateCamera(
      "cam",
      -Math.PI / 3.2,
      Math.PI / 3.1,
      32,
      new Vector3(0, 0, 1.5),
      this.scene
    );
    this.camera.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA;
    this.setOrtho(32);
    this.camera.lowerBetaLimit = 0.55;
    this.camera.upperBetaLimit = 1.15;
    this.camera.lowerRadiusLimit = 18;
    this.camera.upperRadiusLimit = 55;
    this.camera.panningSensibility = 90;
    this.camera.attachControl(canvas, true);

    this.sun = new DirectionalLight("sun", new Vector3(-0.55, -1, 0.3), this.scene);
    this.sun.intensity = 1.15;
    this.sun.diffuse = hexToColor3("#FFD9A0");
    this.sun.position = new Vector3(12, 28, -8);
    this.sun.shadowEnabled = true;
    const hemi = new HemisphericLight("hemi", new Vector3(0.15, 1, 0.1), this.scene);
    hemi.intensity = 0.48;
    hemi.groundColor = hexToColor3(STYLE.sandDeep);
    this.atmosphere = new Atmosphere(this.scene, this.sun, hemi);

    // One soft real shadow system only (no mesh stamp boxes)
    this.shadowGen = new ShadowGenerator(1024, this.sun);
    this.shadowGen.useBlurExponentialShadowMap = true;
    this.shadowGen.blurKernel = 48;
    this.shadowGen.darkness = 0.32;
    this.shadowGen.bias = 0.0005;
    this.shadowGen.normalBias = 0.02;

    this.root = new TransformNode("settlement", this.scene);
    this.rebuildEnvironment(this.mapArch);
    this.buildRoads("dirt");
    this.buildFixedPads();
    this.buildSelectRing();
    this.wirePicking(canvas);

    void this.bootKits();

    this.engine.runRenderLoop(() => {
      const now = performance.now() * 0.001;
      this.atmosphere.update(now, this.riverMesh);
      this.animateWorkers();
      animateBuildingKit(this.buildingKits, now, this.atmosphere.nightFactor(now));
      this.animateRiverLife(now);
      this.scene.render();
      this.fpsFrames++;
      const wall = performance.now();
      if (wall - this.fpsLast >= 1000) {
        this.lastFps = this.fpsFrames;
        this.fpsFrames = 0;
        this.fpsLast = wall;
      }
    });
    window.addEventListener("resize", () => {
      this.engine.resize();
      this.setOrtho(this.camera.radius);
    });
  }

  private async bootKits() {
    try {
      this.kitCache = await preloadBuildingKits(this.scene);
      this.kitsReady = this.kitCache.size > 0;
      if (this.kitsReady && this.lastSettlement) {
        // Rebuild buildings with glTF kit once assets arrive
        for (const [id, node] of this.buildingNodes) {
          node.dispose();
          this.buildingNodes.delete(id);
          this.buildingKits.delete(id);
          this.hitMeshes.delete(id);
        }
        this.sync(this.lastSettlement);
      }
    } catch (e) {
      console.warn("kit preload failed; procedural fallback", e);
    }
  }

  resize() {
    const canvas = this.engine.getRenderingCanvas();
    if (canvas) {
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    }
    this.engine.resize();
    this.setOrtho(this.camera.radius);
  }

  /** Stack-1 money shot framing (day mid-iso). */
  prepareMoneyShot() {
    if (this.boardApprovalMode) {
      this.prepareStandardBoard();
      return;
    }
    this.atmosphere.setPhase("day");
    applyMoneyShotCamera(this.camera);
    this.setOrtho(this.camera.radius);
    this.engine.resize();
  }

  /**
   * 02.9 Step 2 — fixed high-iso full settlement, no zoom, 0–3 tiny workers, min fog.
   */
  prepareStandardBoard() {
    this.boardApprovalMode = true;
    this.atmosphere.setPhase("day");
    this.atmosphere.setBoardApprovalFog(true);
    applyStandardBoardCamera(this.camera);
    this.setOrtho(this.camera.radius);
    // No wheel zoom / orbit / pan for approval frame
    try {
      this.camera.inputs.clear();
    } catch {
      this.camera.detachControl();
    }
    this.engine.resize();
    // Rebuild workers at tiny scale (dispose old large LODs)
    for (const w of this.workers) w.root.dispose();
    this.workers = [];
    if (this.lastSettlement) this.syncWorkers(this.lastSettlement);
  }

  isBoardApprovalMode() {
    return this.boardApprovalMode;
  }

  getFps() {
    return this.lastFps;
  }

  getDayPhase() {
    return this.atmosphere.phaseName();
  }

  setDayPhase(phase: "day" | "dusk" | "night" | null) {
    this.atmosphere.setPhase(phase);
  }

  setSelectHandler(fn: (ev: SelectEvent) => void) {
    this.onSelect = fn;
  }

  getSelectedId() {
    return this.selectedId;
  }

  selectBuilding(buildingId: string | null) {
    this.selectedId = buildingId;
    this.selectedPlotId = null;
    this.updateSelectRing();
    if (!this.suppressNotify) {
      this.onSelect?.(
        buildingId ? { type: "building", buildingId } : { type: "none" }
      );
    }
  }

  selectPad(plotId: string) {
    this.selectedId = null;
    this.selectedPlotId = plotId;
    this.updateSelectRing();
    if (!this.suppressNotify) {
      this.onSelect?.({ type: "pad", plotId });
    }
  }

  selectConstruction(plotId: string) {
    this.selectedId = null;
    this.selectedPlotId = plotId;
    this.updateSelectRing();
    if (!this.suppressNotify) {
      this.onSelect?.({ type: "construction", plotId });
    }
  }

  /** Sync ring without clearing UI selection state. */
  highlightBuilding(buildingId: string | null) {
    this.suppressNotify = true;
    this.selectBuilding(buildingId);
    this.suppressNotify = false;
  }

  highlightPad(plotId: string | null) {
    this.suppressNotify = true;
    if (plotId) this.selectPad(plotId);
    else {
      this.selectedPlotId = null;
      this.selectedId = null;
      this.updateSelectRing();
    }
    this.suppressNotify = false;
  }

  highlightConstruction(plotId: string | null) {
    this.suppressNotify = true;
    if (plotId) this.selectConstruction(plotId);
    else {
      this.selectedPlotId = null;
      this.selectedId = null;
      this.updateSelectRing();
    }
    this.suppressNotify = false;
  }

  clearSelection() {
    this.selectedId = null;
    this.selectedPlotId = null;
    this.updateSelectRing();
    if (!this.suppressNotify) {
      this.onSelect?.({ type: "none" });
    }
  }

  private buildSelectRing() {
    this.selectRing = MeshBuilder.CreateTorus(
      "selectRing",
      { diameter: 2.9, thickness: 0.14, tessellation: 32 },
      this.scene
    );
    this.selectRing.rotation.x = Math.PI / 2;
    this.selectRing.position.y = 0.14;
    this.selectRing.isPickable = false;
    this.selectRing.setEnabled(false);
    const mat = new StandardMaterial("selectRingMat", this.scene);
    mat.diffuseColor = hexToColor3(STYLE.goldSoft);
    mat.emissiveColor = hexToColor3(STYLE.goldSoft).scale(0.55);
    mat.specularColor = Color3.Black();
    this.selectRing.material = mat;
    this.selectRing.parent = this.root;
  }

  private updateSelectRing() {
    if (!this.selectRing) return;
    if (this.selectedId) {
      const node = this.buildingNodes.get(this.selectedId);
      if (!node) {
        this.selectRing.setEnabled(false);
        return;
      }
      this.selectRing.setEnabled(true);
      this.selectRing.position.x = node.position.x;
      this.selectRing.position.z = node.position.z;
      return;
    }
    if (this.selectedPlotId) {
      const w = this.plotWorldArch(this.selectedPlotId);
      this.selectRing.setEnabled(true);
      this.selectRing.position.x = w.x;
      this.selectRing.position.z = w.z;
      return;
    }
    this.selectRing.setEnabled(false);
  }

  private wirePicking(canvas: HTMLCanvasElement) {
    this.scene.onPointerObservable.add((info) => {
      if (info.type === PointerEventTypes.POINTERDOWN) {
        const e = info.event as PointerEvent;
        this.pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
      }
      if (info.type === PointerEventTypes.POINTERUP) {
        const e = info.event as PointerEvent;
        const down = this.pointerDown;
        this.pointerDown = null;
        if (!down) return;
        const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
        if (dist > 12) return;
        if (performance.now() - down.t > 800) return;

        const pick = this.scene.pick(
          this.scene.pointerX,
          this.scene.pointerY,
          (mesh) => {
            if (!mesh.isEnabled() || !mesh.isPickable) return false;
            return !!(
              mesh.metadata?.buildingId ||
              mesh.metadata?.plotId ||
              mesh.metadata?.construction
            );
          }
        );
        if (pick?.hit && pick.pickedMesh?.metadata?.construction) {
          const plotId = pick.pickedMesh.metadata.plotId as string;
          this.selectConstruction(plotId);
        } else if (pick?.hit && pick.pickedMesh?.metadata?.buildingId) {
          this.selectBuilding(pick.pickedMesh.metadata.buildingId as string);
        } else if (pick?.hit && pick.pickedMesh?.metadata?.plotId) {
          const plotId = pick.pickedMesh.metadata.plotId as string;
          if (this.constructionPlotId === plotId) {
            this.selectConstruction(plotId);
          } else if (this.occupied.has(plotId)) {
            return;
          } else {
            this.selectPad(plotId);
          }
        } else {
          this.clearSelection();
        }
      }
    });

    canvas.addEventListener("pointermove", () => {
      const pick = this.scene.pick(
        this.scene.pointerX,
        this.scene.pointerY,
        (mesh) => {
          if (mesh.metadata?.buildingId) return true;
          if (mesh.metadata?.construction) return true;
          if (mesh.metadata?.plotId) {
            const pid = mesh.metadata.plotId as string;
            if (!this.occupied.has(pid) || this.constructionPlotId === pid)
              return true;
          }
          return false;
        }
      );
      canvas.style.cursor = pick?.hit ? "pointer" : "grab";
    });
  }

  private setOrtho(radius: number) {
    const aspect =
      this.engine.getRenderWidth() / Math.max(1, this.engine.getRenderHeight());
    const h = radius * 0.45;
    this.camera.orthoLeft = -h * aspect;
    this.camera.orthoRight = h * aspect;
    this.camera.orthoTop = h;
    this.camera.orthoBottom = -h;
  }

  setQuality(q: Quality) {
    this.quality = q;
    this.engine.setHardwareScalingLevel(q === "low" ? 1.5 : q === "med" ? 1.1 : 1);
    // Rebuild env for subdivision / prop density at new tier
    this.rebuildEnvironment(this.mapArch);
    this.buildFixedPads();
    this.buildRoads(this.roadTier);
    if (this.lastSettlement) this.sync(this.lastSettlement);
    if (this.boardApprovalMode) this.prepareStandardBoard();
  }

  private worldPos(def: { worldX: number; worldZ: number; id?: string }) {
    return transformPlotPos(def.worldX, def.worldZ, this.mapArch.layout);
  }

  private makeSandTexture(baseHex: string) {
    try {
      const size = this.quality === "low" ? 128 : 256;
      const tex = new DynamicTexture("sandTex", size, this.scene, false);
      const ctx = tex.getContext() as CanvasRenderingContext2D;
      const base = baseHex.replace("#", "");
      const br = parseInt(base.slice(0, 2), 16);
      const bg = parseInt(base.slice(2, 4), 16);
      const bb = parseInt(base.slice(4, 6), 16);
      const img = ctx.createImageData(size, size);
      for (let i = 0; i < size * size; i++) {
        const n = (Math.random() - 0.5) * 52;
        const n2 = ((i * 17) % 29) - 14;
        const n3 = ((i * 31) % 11) - 5;
        img.data[i * 4] = Math.max(0, Math.min(255, br + n + n2));
        img.data[i * 4 + 1] = Math.max(0, Math.min(255, bg + n * 0.85 + n2 * 0.5 + n3));
        img.data[i * 4 + 2] = Math.max(0, Math.min(255, bb + n * 0.55 + n3 * 0.4));
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      // Soft mottles + dark silt flecks (materials craft)
      for (let k = 0; k < 55; k++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 6 + Math.random() * 26;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, k % 3 === 0 ? "rgba(90,70,40,0.22)" : "rgba(170,130,75,0.2)");
        g.addColorStop(1, "rgba(160,120,70,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      tex.update(false);
      tex.uScale = 8;
      tex.vScale = 7;
      return tex;
    } catch {
      return null;
    }
  }

  private rebuildEnvironment(arch: MapArchetype) {
    this.envRoot?.dispose();
    this.foamMeshes = [];
    this.dustRoot = null;
    this.bargeNode = null;
    this.bargeNode2 = null;
    this.riverMesh = null;
    this.envRoot = new TransformNode("env", this.scene);
    this.envRoot.parent = this.root;
    this.mapArch = arch;
    const pal = arch.palette;

    // Vast continuous desert — player must never see a hard map edge (02.9)
    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: 160, height: 140, subdivisions: this.quality === "low" ? 12 : 32 },
      this.scene
    );
    ground.position.set(0, 0, 2);
    const mat = new StandardMaterial("groundMat", this.scene);
    mat.diffuseColor = hexToColor3(pal.sand);
    mat.specularColor = hexToColor3("#3A3020").scale(0.08);
    mat.emissiveColor = hexToColor3(pal.sand).scale(0.03);
    const grit = this.makeSandTexture(pal.sand);
    if (grit) {
      mat.diffuseTexture = grit;
      mat.diffuseColor = Color3.White();
      grit.uScale = 18;
      grit.vScale = 16;
    }
    ground.material = mat;
    ground.parent = this.envRoot;
    ground.isPickable = false;
    ground.receiveShadows = true;

    // Outer skirt — same sand, slightly cooler, extends beyond any ortho framing
    const skirt = MeshBuilder.CreateGround(
      "sandSkirt",
      { width: 220, height: 200, subdivisions: 4 },
      this.scene
    );
    skirt.position.set(2, -0.03, 3);
    const skirtMat = new StandardMaterial("sandSkirtMat", this.scene);
    skirtMat.diffuseColor = hexToColor3("#A09070");
    skirtMat.emissiveColor = hexToColor3("#6A6048").scale(0.05);
    skirtMat.specularColor = Color3.Black();
    skirt.material = skirtMat;
    skirt.parent = this.envRoot;
    skirt.isPickable = false;
    skirt.receiveShadows = true;

    // Mid-distance cooler strip (subtle falloff, not an edge)
    const midSand = MeshBuilder.CreateGround(
      "midSand",
      { width: 70, height: 60, subdivisions: 4 },
      this.scene
    );
    midSand.position.set(8, -0.01, 5);
    const midSandMat = new StandardMaterial("midSandMat", this.scene);
    midSandMat.diffuseColor = hexToColor3("#908060");
    midSandMat.emissiveColor = hexToColor3("#5A5040").scale(0.05);
    midSandMat.specularColor = Color3.Black();
    midSand.material = midSandMat;
    midSand.parent = this.envRoot;
    midSand.isPickable = false;
    midSand.receiveShadows = true;

    // Soft far wash (atmospheric, not a wall)
    const farCarpetMat = new StandardMaterial("farCarpetMat", this.scene);
    farCarpetMat.diffuseColor = hexToColor3("#8A8470");
    farCarpetMat.emissiveColor = hexToColor3("#6A6858").scale(0.15);
    farCarpetMat.alpha = 0.18;
    farCarpetMat.disableLighting = true;
    farCarpetMat.backFaceCulling = false;
    const farCarpet = MeshBuilder.CreateGround(
      "farCarpet",
      { width: 90, height: 80 },
      this.scene
    );
    farCarpet.position.set(14, 0.1, 8);
    farCarpet.material = farCarpetMat;
    farCarpet.parent = this.envRoot;
    farCarpet.isPickable = false;

    // Soft far haze (low alpha — continuous desert, no edge wall)
    const farWashMat = new StandardMaterial("farWashMat", this.scene);
    farWashMat.diffuseColor = hexToColor3("#A89878");
    farWashMat.emissiveColor = hexToColor3("#807860").scale(0.12);
    farWashMat.alpha = 0.12;
    farWashMat.disableLighting = true;
    farWashMat.backFaceCulling = false;
    const farWash = MeshBuilder.CreateGround(
      "farWash0",
      { width: 100, height: 90 },
      this.scene
    );
    farWash.position.set(16, 0.25, 8);
    farWash.material = farWashMat;
    farWash.parent = this.envRoot;
    farWash.isPickable = false;

    // Wet silt bank — brown-green wet mud, not dry sand
    const wet = MeshBuilder.CreateGround(
      "wetBank",
      { width: 3.8, height: 30, subdivisions: 6 },
      this.scene
    );
    wet.position.set(-10.2, 0.018, 1.5);
    const wetMat = new StandardMaterial("wetMat", this.scene);
    wetMat.diffuseColor = hexToColor3("#6A5840");
    wetMat.specularColor = hexToColor3("#4A7080").scale(0.35);
    wetMat.specularPower = 32;
    wetMat.emissiveColor = hexToColor3("#3A3020").scale(0.08);
    wet.material = wetMat;
    wet.parent = this.envRoot;
    wet.isPickable = false;
    wet.receiveShadows = true;

    // Dark silt break at waterline (Materials: wet clay grammar)
    const silt = MeshBuilder.CreateBox(
      "siltBreak",
      { width: 1.1, height: 0.06, depth: 32 },
      this.scene
    );
    silt.position.set(-10.85, 0.03, 1.5);
    const siltMat = new StandardMaterial("siltMat", this.scene);
    siltMat.diffuseColor = hexToColor3("#4A3A28");
    siltMat.specularColor = hexToColor3("#3A5A68").scale(0.25);
    siltMat.emissiveColor = hexToColor3("#2A2018").scale(0.06);
    silt.material = siltMat;
    silt.parent = this.envRoot;
    silt.isPickable = false;
    silt.receiveShadows = true;

    // Wet specular shoreline strip (Materials craft — shiny wet line at board distance)
    const wetLine = MeshBuilder.CreateBox(
      "wetSpecular",
      { width: 0.65, height: 0.05, depth: 40 },
      this.scene
    );
    wetLine.position.set(-10.55, 0.06, 1.5);
    const wetLineMat = new StandardMaterial("wetSpecularMat", this.scene);
    wetLineMat.diffuseColor = hexToColor3("#4A6860");
    wetLineMat.specularColor = hexToColor3("#D0E8F0").scale(1.0);
    wetLineMat.specularPower = 128;
    wetLineMat.emissiveColor = hexToColor3("#3A5850").scale(0.18);
    wetLineMat.alpha = 0.92;
    wetLine.material = wetLineMat;
    wetLine.parent = this.envRoot;
    wetLine.isPickable = false;
    // Second wet band for shore readability on full-board camera
    const wetLine2 = MeshBuilder.CreateBox(
      "wetSpecular2",
      { width: 0.35, height: 0.03, depth: 38 },
      this.scene
    );
    wetLine2.position.set(-10.15, 0.055, 1.5);
    const wetLine2Mat = new StandardMaterial("wetSpecular2Mat", this.scene);
    wetLine2Mat.diffuseColor = hexToColor3("#6A8078");
    wetLine2Mat.specularColor = hexToColor3("#E0F0F8").scale(0.7);
    wetLine2Mat.specularPower = 64;
    wetLine2Mat.emissiveColor = hexToColor3("#4A6058").scale(0.1);
    wetLine2Mat.alpha = 0.75;
    wetLine2.material = wetLine2Mat;
    wetLine2.parent = this.envRoot;
    wetLine2.isPickable = false;

    if (this.quality !== "low") {
      const duneMat = new StandardMaterial("duneMat", this.scene);
      duneMat.diffuseColor = hexToColor3(STYLE.sandDeep);
      duneMat.specularColor = Color3.Black();
      for (const [x, z, sx, sz] of [
        [7, -7.5, 2.8, 1.6],
        [11, 3.5, 2.4, 1.4],
        [9, 8.5, 2.6, 1.5],
        [4, -9, 2.0, 1.2],
      ] as const) {
        const d = MeshBuilder.CreateBox(
          `dune-${x}-${z}`,
          { width: sx, height: 0.28, depth: sz },
          this.scene
        );
        d.position.set(x, 0.1, z);
        d.material = duneMat;
        d.parent = this.envRoot;
        d.isPickable = false;
        d.receiveShadows = true;
      }
    }

    // Deep Nile: near-black channel (Materials/Ground — not matte candy teal)
    const river = MeshBuilder.CreateBox(
      "river",
      { width: 10.5, height: 0.32, depth: 75 },
      this.scene
    );
    river.position.set(-15.4, -0.12, 2);
    const rmat = new StandardMaterial("riverMat", this.scene);
    rmat.diffuseColor = hexToColor3("#061820");
    rmat.specularColor = hexToColor3("#5A98B0").scale(0.55);
    rmat.specularPower = 80;
    rmat.alpha = 0.98;
    rmat.emissiveColor = hexToColor3("#041018").scale(0.25);
    river.material = rmat;
    river.parent = this.envRoot;
    river.isPickable = false;
    this.riverMesh = river;

    const mid = MeshBuilder.CreateBox(
      "riverMid",
      { width: 2.8, height: 0.14, depth: 68 },
      this.scene
    );
    mid.position.set(-11.6, 0.0, 2);
    const midMat = new StandardMaterial("riverMidMat", this.scene);
    midMat.diffuseColor = hexToColor3("#0E3048");
    midMat.specularColor = hexToColor3("#78B0C8").scale(0.45);
    midMat.specularPower = 56;
    midMat.alpha = 0.94;
    midMat.emissiveColor = hexToColor3("#0A2030").scale(0.1);
    mid.material = midMat;
    mid.parent = this.envRoot;
    mid.isPickable = false;

    // Shallow = murky silt water, not bright teal lip
    const shallow = MeshBuilder.CreateBox(
      "riverShallow",
      { width: 1.8, height: 0.09, depth: 62 },
      this.scene
    );
    shallow.position.set(-10.35, 0.03, 2);
    const shMat = new StandardMaterial("shallowMat", this.scene);
    shMat.diffuseColor = hexToColor3("#2A4A52");
    shMat.specularColor = hexToColor3("#88B0B8").scale(0.3);
    shMat.specularPower = 28;
    shMat.alpha = 0.88;
    shMat.emissiveColor = hexToColor3("#1A3038").scale(0.08);
    shallow.material = shMat;
    shallow.parent = this.envRoot;
    shallow.isPickable = false;

    // Wet churn foam — silt-grey/cream, lit (not pure-albedo candy chunks)
    const flMat = new StandardMaterial("foamLineMat", this.scene);
    flMat.diffuseColor = hexToColor3("#B8C4C0");
    flMat.emissiveColor = hexToColor3("#8A9890").scale(0.12);
    flMat.specularColor = hexToColor3("#C0D0D0").scale(0.2);
    flMat.alpha = 0.72;
    flMat.zOffset = -1;
    for (let i = 0; i < 36; i++) {
      const blob = MeshBuilder.CreateSphere(
        `foamBlob-${i}`,
        { diameter: 0.22 + (i % 5) * 0.08, segments: 6 },
        this.scene
      );
      const along = -15 + i * 0.95 + (i % 3) * 0.12;
      blob.position.set(-10.05 - (i % 3) * 0.28, 0.1 + (i % 4) * 0.03, along);
      blob.scaling.set(1.4 + (i % 4) * 0.35, 0.22 + (i % 3) * 0.08, 0.7 + (i % 2) * 0.35);
      blob.material = flMat;
      blob.parent = this.envRoot;
      blob.isPickable = false;
    }

    const foamMat = new StandardMaterial("foamMat", this.scene);
    foamMat.diffuseColor = hexToColor3("#A8B8B4");
    foamMat.emissiveColor = hexToColor3("#708080").scale(0.06);
    foamMat.alpha = 0.65;
    foamMat.specularColor = hexToColor3("#B0C0C0").scale(0.15);
    for (let i = 0; i < (this.quality === "low" ? 5 : 10); i++) {
      const foam = MeshBuilder.CreateBox(
        `foam-${i}`,
        { width: 0.55 + (i % 3) * 0.18, height: 0.05, depth: 0.32 },
        this.scene
      );
      foam.position.set(-13.5 - (i % 2) * 0.35, 0.08, -9 + i * 2.5);
      foam.material = foamMat;
      foam.parent = this.envRoot;
      foam.isPickable = false;
      this.foamMeshes.push(foam);
    }

    // Bank strip + reed fringe
    const bank = MeshBuilder.CreateBox(
      "bank",
      { width: 1.5, height: 0.12, depth: 28 },
      this.scene
    );
    bank.position.set(-10.05, 0.05, 1.5);
    const bmat = new StandardMaterial("bankMat", this.scene);
    bmat.diffuseColor = hexToColor3("#7A6848");
    bmat.specularColor = Color3.Black();
    bank.material = bmat;
    bank.parent = this.envRoot;
    bank.isPickable = false;

    // Dense reed BEDS — mass silhouettes + stalks (Ground craft, not sparse sticks)
    const reedMat = new StandardMaterial("envReed", this.scene);
    reedMat.diffuseColor = hexToColor3(STYLE.reedGreen);
    reedMat.specularColor = Color3.Black();
    reedMat.emissiveColor = hexToColor3(STYLE.reedGreen).scale(0.04);
    const reedMatDry = new StandardMaterial("envReedDry", this.scene);
    reedMatDry.diffuseColor = hexToColor3("#6A7040");
    reedMatDry.specularColor = Color3.Black();
    const reedMassMat = new StandardMaterial("reedMassMat", this.scene);
    reedMassMat.diffuseColor = hexToColor3("#3A5A38");
    reedMassMat.emissiveColor = hexToColor3("#2A4028").scale(0.08);
    reedMassMat.specularColor = Color3.Black();
    reedMassMat.alpha = 0.85;
    const bedCount = this.quality === "low" ? 14 : 28;
    let reedI = 0;
    for (let bed = 0; bed < bedCount; bed++) {
      const bz = -12 + bed * (26 / bedCount);
      const bx = -10.25 + (bed % 3) * 0.14;
      // Mass clump silhouette (reads at mid-iso without counting stalks)
      if (bed % 2 === 0) {
        const mass = MeshBuilder.CreateBox(
          `reedMass-${bed}`,
          { width: 0.55 + (bed % 3) * 0.12, height: 0.55 + (bed % 2) * 0.15, depth: 0.4 },
          this.scene
        );
        mass.position.set(bx, 0.32, bz);
        mass.material = reedMassMat;
        mass.parent = this.envRoot;
        mass.isPickable = false;
      }
      const stalks = this.quality === "low" ? 4 : 7;
      for (let s = 0; s < stalks; s++) {
        const r = MeshBuilder.CreateCylinder(
          `envReed-${reedI++}`,
          {
            height: 0.6 + (s % 4) * 0.2,
            diameter: 0.08 + (s % 3) * 0.02,
            tessellation: 5,
          },
          this.scene
        );
        r.position.set(
          bx + (s % 3) * 0.15 - 0.14,
          0.35 + (s % 2) * 0.05,
          bz + (s % 4) * 0.12 - 0.16
        );
        r.material = s % 3 === 0 ? reedMatDry : reedMat;
        r.parent = this.envRoot;
        r.isPickable = false;
        if (this.shadowGen && this.quality === "high" && s === 0) {
          this.shadowGen.addShadowCaster(r, false);
        }
      }
    }
    // Scattered shore stones
    if (this.quality !== "low") {
      const rockMat = new StandardMaterial("rockMat", this.scene);
      rockMat.diffuseColor = hexToColor3(STYLE.stonePale);
      rockMat.specularColor = Color3.Black();
      for (let i = 0; i < 10; i++) {
        const rock = MeshBuilder.CreateBox(
          `rock-${i}`,
          { width: 0.35 + (i % 3) * 0.1, height: 0.18, depth: 0.3 },
          this.scene
        );
        rock.position.set(-9.2 + (i % 2) * 0.4, 0.1, -8 + i * 2.1);
        rock.rotation.y = i * 0.7;
        rock.material = rockMat;
        rock.parent = this.envRoot;
        rock.isPickable = false;
        rock.receiveShadows = true;
      }
    }

    this.buildDustField();
    this.buildHazePlanes();

    // Pier from bank into river toward harbor pad
    const pierLen = arch.layout.pierLength ?? 3.0;
    const pier = MeshBuilder.CreateBox(
      "pier",
      { width: pierLen, height: 0.14, depth: 1.5 },
      this.scene
    );
    pier.position.set(-11.0, 0.1, 6.5);
    const pmat = new StandardMaterial("pierMat", this.scene);
    pmat.diffuseColor = hexToColor3("#8B7355");
    pmat.specularColor = Color3.Black();
    pier.material = pmat;
    pier.parent = this.envRoot;
    pier.isPickable = false;

    // Pier planks lines
    const plankMat = new StandardMaterial("plankMat", this.scene);
    plankMat.diffuseColor = hexToColor3("#6E5A42");
    plankMat.specularColor = Color3.Black();
    for (let i = 0; i < 4; i++) {
      const plank = MeshBuilder.CreateBox(
        `plank-${i}`,
        { width: pierLen * 0.92, height: 0.03, depth: 0.08 },
        this.scene
      );
      plank.position.set(-11.0, 0.18, 6.0 + i * 0.35);
      plank.material = plankMat;
      plank.parent = this.envRoot;
      plank.isPickable = false;
    }

    for (const z of [6.0, 7.0]) {
      for (const x of [-12.2, -11.0, -9.9]) {
        const pile = MeshBuilder.CreateCylinder(
          `pile-${x}-${z}`,
          { height: 0.4, diameter: 0.18, tessellation: 6 },
          this.scene
        );
        pile.position.set(x, 0.05, z);
        pile.material = pmat;
        pile.parent = this.envRoot;
        pile.isPickable = false;
      }
    }

    // Ambient barges on river (visual life; not sim-bound)
    this.buildBarge();
  }

  private bargeNode2: TransformNode | null = null;

  private buildBarge() {
    this.bargeNode?.dispose();
    this.bargeNode2?.dispose();
    // Two first-glance barges on money-shot river (Life craft)
    this.bargeNode = this.makeOneBarge("barge", -13.0, -3.5, 1.15);
    this.bargeNode2 = this.makeOneBarge("barge2", -14.4, 6.2, 1.05);
  }

  private makeOneBarge(name: string, x: number, z: number, scale: number): TransformNode {
    const root = new TransformNode(name, this.scene);
    root.parent = this.envRoot;
    root.position.set(x, 0.12, z);
    root.scaling.setAll(scale);
    const hull = MeshBuilder.CreateBox(
      `${name}Hull`,
      { width: 0.7, height: 0.22, depth: 1.6 },
      this.scene
    );
    hull.position.y = 0.12;
    const hm = new StandardMaterial(`${name}HullMat`, this.scene);
    hm.diffuseColor = hexToColor3(name.endsWith("2") ? "#5A3A28" : "#6B4A32");
    hm.specularColor = Color3.Black();
    hull.material = hm;
    hull.parent = root;
    hull.isPickable = false;
    const cabin = MeshBuilder.CreateBox(
      `${name}Cabin`,
      { width: 0.45, height: 0.28, depth: 0.5 },
      this.scene
    );
    cabin.position.set(0, 0.35, -0.2);
    const cm = new StandardMaterial(`${name}CabinMat`, this.scene);
    cm.diffuseColor = hexToColor3(STYLE.sandDeep);
    cm.specularColor = Color3.Black();
    cabin.material = cm;
    cabin.parent = root;
    cabin.isPickable = false;
    const sail = MeshBuilder.CreateBox(
      `${name}Sail`,
      { width: 0.06, height: 0.7, depth: 0.55 },
      this.scene
    );
    sail.position.set(0, 0.7, 0.15);
    const sm = new StandardMaterial(`${name}SailMat`, this.scene);
    sm.diffuseColor = hexToColor3(STYLE.papyrus);
    sm.emissiveColor = hexToColor3(STYLE.papyrus).scale(0.05);
    sm.specularColor = Color3.Black();
    sail.material = sm;
    sail.parent = root;
    sail.isPickable = false;
    return root;
  }

  private animateRiverLife(now: number) {
    for (let i = 0; i < this.foamMeshes.length; i++) {
      const f = this.foamMeshes[i]!;
      f.position.z = -8 + ((i * 3.2 + now * 0.35) % 24);
      f.visibility = 0.55 + Math.sin(now * 2 + i) * 0.25;
    }
    if (this.bargeNode) {
      const z = -6 + Math.sin(now * 0.12) * 8;
      this.bargeNode.position.z = z;
      this.bargeNode.position.y = 0.12 + Math.sin(now * 1.6) * 0.03;
      this.bargeNode.rotation.y = Math.sin(now * 0.2) * 0.08;
    }
    if (this.bargeNode2) {
      const z2 = 4 + Math.sin(now * 0.09 + 1.2) * 6;
      this.bargeNode2.position.z = z2;
      this.bargeNode2.position.y = 0.12 + Math.sin(now * 1.4 + 0.5) * 0.025;
      this.bargeNode2.rotation.y = Math.PI + Math.sin(now * 0.15) * 0.06;
    }
    // Dust motes (heat atmosphere readable in stills as soft particles)
    if (this.dustRoot) {
      this.dustRoot.rotation.y = now * 0.05;
      for (const c of this.dustRoot.getChildMeshes()) {
        c.visibility = 0.25 + Math.sin(now * 1.2 + c.position.x) * 0.15;
      }
    }
  }

  private buildDustField() {
    this.dustRoot?.dispose();
    if (this.quality === "low") {
      this.dustRoot = null;
      return;
    }
    this.dustRoot = new TransformNode("dust", this.scene);
    this.dustRoot.parent = this.envRoot;
    const dm = new StandardMaterial("dustMat", this.scene);
    dm.diffuseColor = hexToColor3("#E8D4B0");
    dm.emissiveColor = hexToColor3("#D4B896").scale(0.35);
    dm.alpha = 0.28;
    dm.disableLighting = true;
    const n = this.quality === "high" ? 28 : 18;
    for (let i = 0; i < n; i++) {
      const p = MeshBuilder.CreateSphere(
        `dust-${i}`,
        { diameter: 0.1 + (i % 3) * 0.04, segments: 4 },
        this.scene
      );
      p.position.set(
        -10 + Math.random() * 22,
        0.5 + Math.random() * 3.0,
        -10 + Math.random() * 20
      );
      p.material = dm;
      p.parent = this.dustRoot;
      p.isPickable = false;
    }
  }

  /**
   * Soft continuous bank-mist ribbon + distance air.
   * Overlapping volumes must read as ONE haze band at mid-iso — not puff chain.
   */
  private buildHazePlanes() {
    // Soft distance wash: large low-alpha volume far side (depth falloff)
    const hazeMat = new StandardMaterial("hazeMat", this.scene);
    hazeMat.diffuseColor = hexToColor3("#B8B0A0");
    hazeMat.emissiveColor = hexToColor3("#A09888").scale(0.22);
    hazeMat.alpha = 0.18;
    hazeMat.disableLighting = true;
    hazeMat.backFaceCulling = false;
    const farHaze = MeshBuilder.CreateGround(
      "farHaze",
      { width: 42, height: 50 },
      this.scene
    );
    farHaze.position.set(12, 1.1, 4);
    farHaze.material = hazeMat;
    farHaze.parent = this.envRoot;
    farHaze.isPickable = false;

    // Continuous bank-mist ribbon: long soft boxes overlapping into one air mass
    const mm = new StandardMaterial("bankMistMat", this.scene);
    mm.diffuseColor = hexToColor3("#C8D4D8");
    mm.emissiveColor = hexToColor3("#A8BCC4").scale(0.2);
    mm.alpha = 0.26;
    mm.disableLighting = true;
    mm.backFaceCulling = false;
    // Backbone ribbon along full waterline
    for (let i = 0; i < 8; i++) {
      const ribbon = MeshBuilder.CreateBox(
        `bankRibbon-${i}`,
        { width: 3.8, height: 0.55 + (i % 2) * 0.15, depth: 4.2 },
        this.scene
      );
      ribbon.position.set(
        -11.5 + (i % 2) * 0.4,
        0.55 + (i % 3) * 0.12,
        -12 + i * 3.4
      );
      ribbon.material = mm;
      ribbon.parent = this.envRoot;
      ribbon.isPickable = false;
    }
    // Soft fill spheres heavily overlapping the ribbon (kill discrete puff gaps)
    for (let i = 0; i < 18; i++) {
      const mist = MeshBuilder.CreateSphere(
        `bankMist-${i}`,
        { diameter: 2.8 + (i % 4) * 0.5, segments: 8 },
        this.scene
      );
      mist.position.set(
        -11.6 + (i % 3) * 0.45,
        0.65 + (i % 4) * 0.1,
        -13 + i * 1.55
      );
      mist.scaling.set(1.9, 0.32, 1.35);
      mist.material = mm;
      mist.parent = this.envRoot;
      mist.isPickable = false;
    }
    // Upper thin haze veil over bank (reads as soft air volume at mid-iso)
    const veilMat = new StandardMaterial("bankVeilMat", this.scene);
    veilMat.diffuseColor = hexToColor3("#D0D8D8");
    veilMat.emissiveColor = hexToColor3("#B8C8C8").scale(0.15);
    veilMat.alpha = 0.14;
    veilMat.disableLighting = true;
    veilMat.backFaceCulling = false;
    const veil = MeshBuilder.CreateBox(
      "bankVeil",
      { width: 5.5, height: 1.2, depth: 30 },
      this.scene
    );
    veil.position.set(-11.2, 1.1, 1.5);
    veil.material = veilMat;
    veil.parent = this.envRoot;
    veil.isPickable = false;

    // Very light heat wash only (not fog soup volumes over the campus)
    if (this.quality !== "low") {
      const heatMat = new StandardMaterial("heatHazeMat", this.scene);
      heatMat.diffuseColor = hexToColor3("#D8C8A8");
      heatMat.emissiveColor = hexToColor3("#C8B898").scale(0.1);
      heatMat.alpha = 0.06;
      heatMat.disableLighting = true;
      heatMat.backFaceCulling = false;
      const heat = MeshBuilder.CreateGround(
        "heatHazeFar",
        { width: 40, height: 36 },
        this.scene
      );
      heat.position.set(10, 0.5, 6);
      heat.material = heatMat;
      heat.parent = this.envRoot;
      heat.isPickable = false;
    }
  }

  /** Sparse typed pads only — not a free city grid. */
  private buildFixedPads() {
    for (const m of this.padMeshes.values()) m.dispose();
    for (const m of this.padIcons.values()) m.dispose();
    for (const m of this.padGhosts.values()) m.dispose();
    this.padMeshes.clear();
    this.padMats.clear();
    this.padIcons.clear();
    this.padGhosts.clear();

    for (const def of SETTLEMENT_PLOTS) {
      const pos = this.worldPos(def);
      // Near-invisible sand plinths — category readable via icon only (kill candy pads)
      const mat = new StandardMaterial(`padMat-${def.id}`, this.scene);
      const baseSand = hexToColor3(STYLE.sandLight);
      const tint = hexToColor3(def.tint);
      mat.diffuseColor = Color3.Lerp(baseSand, hexToColor3(STYLE.sandDeep), 0.2);
      mat.specularColor = Color3.Black();
      mat.emissiveColor = Color3.Black();
      mat.alpha = 0.35;
      this.padMats.set(def.id, mat);

      const isHarbor = def.id === "special-harbor";
      // Invisible pick volume — visual is thin ink rim only
      const pad = MeshBuilder.CreateBox(
        `pad-${def.id}`,
        {
          width: isHarbor ? 2.6 : 2.35,
          height: 0.06,
          depth: isHarbor ? 2.2 : 2.35,
        },
        this.scene
      );
      pad.position.set(pos.x, isHarbor ? 0.08 : 0.03, pos.z);
      pad.material = mat;
      pad.parent = this.root;
      pad.isPickable = !def.starterKind;
      pad.receiveShadows = true;
      pad.visibility = def.starterKind ? 0 : 0.4;
      pad.metadata = {
        plotId: def.id,
        category: def.category,
        label: def.label,
      };

      // No torus rings — director hard-fail on black rings under pads (02.8/03)
      // Category readable via icon + solid ghost only

      // Category icon + packed-earth ghost foundation for empty buildable pads
      if (!def.starterKind) {
        const iconRoot = new TransformNode(`padIconRoot-${def.id}`, this.scene);
        iconRoot.parent = this.root;
        iconRoot.position.set(pos.x, isHarbor ? 0.14 : 0.1, pos.z);
        const icon = createPadCategoryMarker(
          this.scene,
          iconRoot,
          def.id,
          def.category
        );
        if (icon) this.padIcons.set(def.id, icon);

        // Solid densified mudbrick half-build (not line wireframe only)
        const ghost = MeshBuilder.CreateBox(
          `ghost-${def.id}`,
          { width: 1.55, height: 0.55, depth: 1.35 },
          this.scene
        );
        ghost.position.set(pos.x, 0.3, pos.z);
        const gm = new StandardMaterial(`ghostMat-${def.id}`, this.scene);
        gm.diffuseColor = hexToColor3(STYLE.mudbrick);
        gm.emissiveColor = hexToColor3(STYLE.mudbrick).scale(0.05);
        gm.specularColor = hexToColor3("#3A2A18").scale(0.08);
        gm.alpha = 0.55;
        ghost.material = gm;
        ghost.parent = this.root;
        ghost.isPickable = false;
        ghost.receiveShadows = true;
        // Wireframe outline on top of solid mass for kit readability
        const ghostWire = MeshBuilder.CreateBox(
          `ghostWire-${def.id}`,
          { width: 1.62, height: 0.62, depth: 1.42 },
          this.scene
        );
        ghostWire.position.set(pos.x, 0.32, pos.z);
        const gwm = new StandardMaterial(`ghostWireMat-${def.id}`, this.scene);
        gwm.diffuseColor = hexToColor3("#5A4030");
        gwm.emissiveColor = hexToColor3("#4A3020").scale(0.15);
        gwm.alpha = 0.45;
        gwm.wireframe = true;
        ghostWire.material = gwm;
        ghostWire.parent = this.root;
        ghostWire.isPickable = false;
        this.padGhosts.set(def.id, ghost);
      }

      pad.actionManager = new ActionManager(this.scene);
      pad.actionManager.registerAction(
        new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => {
          if (this.occupied.has(def.id)) return;
          mat.emissiveColor = hexToColor3(STYLE.goldSoft).scale(0.4);
          const icon = this.padIcons.get(def.id);
          if (icon) icon.scaling.setAll(1.15);
        })
      );
      pad.actionManager.registerAction(
        new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => {
          mat.emissiveColor = this.occupied.has(def.id)
            ? Color3.Black()
            : hexToColor3(def.tint).scale(0.12);
          const icon = this.padIcons.get(def.id);
          if (icon) icon.scaling.setAll(1);
        })
      );

      this.padMeshes.set(def.id, pad);
    }
  }

  private plotWorldArch(plotId: string): { x: number; z: number } {
    const def = getPlot(plotId);
    if (!def) return plotWorld(plotId);
    return this.worldPos(def);
  }

  private resolveConstructionPlot(settlement: SettlementState): string | null {
    const job = settlement.construction;
    if (!job) return null;
    if (job.plotId) return job.plotId;
    if (job.buildingId) {
      return (
        settlement.buildings.find((x) => x.id === job.buildingId)?.plotId ?? null
      );
    }
    return null;
  }

  private syncPads(settlement: SettlementState) {
    this.occupied = new Set(
      settlement.buildings.map((b) => b.plotId).filter(Boolean) as string[]
    );
    this.constructionPlotId = this.resolveConstructionPlot(settlement);
    if (this.constructionPlotId) {
      this.occupied.add(this.constructionPlotId);
    }
    for (const [id, pad] of this.padMeshes) {
      const taken = this.occupied.has(id);
      const underConstruction = this.constructionPlotId === id;
      const def = getPlot(id)!;
      // Construction sites stay pickable so players can inspect the job
      pad.isPickable = !taken || underConstruction;
      // Empty: invisible body (icon+rim only). Occupied: gone.
      pad.visibility = taken && !underConstruction ? 0 : underConstruction ? 0.2 : 0.05;
      pad.metadata = {
        plotId: def.id,
        category: def.category,
        label: def.label,
        ...(underConstruction ? { construction: true } : {}),
      };
      const mat = this.padMats.get(id);
      if (mat) {
        if (underConstruction) {
          mat.emissiveColor = hexToColor3(STYLE.goldSoft).scale(0.12);
          mat.alpha = 0.4;
        } else if (!taken) {
          mat.emissiveColor = Color3.Black();
          mat.alpha = 0.2;
        } else {
          mat.emissiveColor = Color3.Black();
          mat.alpha = 0;
        }
      }
      // Soft category icon only on empty plots
      const icon = this.padIcons.get(id);
      if (icon) {
        icon.setEnabled(!taken);
        icon.visibility = taken ? 0 : 0.75;
      }
      // Ghost foundation — packed earth footprint (architecture intent, not candy pad)
      const ghost = this.padGhosts.get(id);
      if (ghost) {
        ghost.setEnabled(!taken && !underConstruction);
      }
    }
    this.syncScaffold(settlement);
  }

  private syncScaffold(settlement: SettlementState) {
    this.scaffoldNode?.dispose();
    this.scaffoldNode = null;
    const plotId = this.constructionPlotId ?? this.resolveConstructionPlot(settlement);
    if (!plotId) return;
    this.scaffoldNode = this.makeScaffold(plotId);
  }

  private makeScaffold(plotId: string): TransformNode {
    const root = new TransformNode(`scaffold-${plotId}`, this.scene);
    root.parent = this.root;
    const w = this.plotWorldArch(plotId);
    root.position.set(w.x, 0, w.z);

    // Visible wireframe frame
    const frame = MeshBuilder.CreateBox(
      "scaffold",
      { width: 1.5, height: 1.2, depth: 1.5 },
      this.scene
    );
    frame.position.y = 0.75;
    const mat = new StandardMaterial("scaffoldMat", this.scene);
    mat.diffuseColor = hexToColor3("#A89070");
    mat.alpha = 0.7;
    mat.wireframe = true;
    mat.specularColor = Color3.Black();
    frame.material = mat;
    frame.parent = root;
    frame.isPickable = true;
    frame.metadata = { construction: true, plotId };

    // Larger invisible hit volume so the site is easy to click
    const hit = MeshBuilder.CreateBox(
      "scaffoldHit",
      { width: 2.4, height: 2.0, depth: 2.4 },
      this.scene
    );
    hit.position.y = 1.0;
    hit.visibility = 0;
    hit.isPickable = true;
    hit.metadata = { construction: true, plotId };
    hit.parent = root;

    return root;
  }

  sync(settlement: SettlementState) {
    this.lastSettlement = settlement;
    const archId = settlement.mapArchetypeId ?? "delta_mouth";
    if (archId !== this.mapArch.id) {
      this.rebuildEnvironment(getMapArchetype(archId));
      this.buildFixedPads();
      this.buildRoads(this.roadTier);
    }
    this.syncPads(settlement);
    this.syncRoads(settlement.greatHouseLevel);
    const seen = new Set<string>();
    for (const b of settlement.buildings) {
      seen.add(b.id);
      let node = this.buildingNodes.get(b.id);
      if (!node) {
        node = this.createBuilding(b);
        this.buildingNodes.set(b.id, node);
      } else {
        this.refreshBuildingMeta(b);
      }
      this.placeBuilding(node, b);
    }
    for (const [id, node] of this.buildingNodes) {
      if (!seen.has(id)) {
        node.dispose();
        this.buildingNodes.delete(id);
        this.buildingKits.delete(id);
        this.hitMeshes.delete(id);
        if (this.selectedId === id) this.clearSelection();
      }
    }
    this.syncWorkers(settlement);
    this.syncNightWindows(settlement);
    this.updateSelectRing();
  }

  private nightWindows: Mesh[] = [];

  /** Explicit facade lamps — do not rely on glTF name matching for night craft. */
  private syncNightWindows(settlement: SettlementState) {
    for (const m of this.nightWindows) m.dispose();
    this.nightWindows = [];
    const st = settlement;
    const winMat = new StandardMaterial("winMat", this.scene);
    winMat.diffuseColor = hexToColor3("#FFD080");
    winMat.emissiveColor = hexToColor3("#FFB040").scale(0.95);
    winMat.specularColor = Color3.Black();
    winMat.disableLighting = true;

    const placeWindows = (plotId: string, count: number, y: number) => {
      const def = getPlot(plotId);
      if (!def) return;
      const w = this.worldPos(def);
      for (let i = 0; i < count; i++) {
        const box = MeshBuilder.CreateBox(
          `win-${plotId}-${i}`,
          { width: 0.28, height: 0.35, depth: 0.08 },
          this.scene
        );
        box.position.set(w.x + (i - (count - 1) / 2) * 0.45, y, w.z - 0.95);
        box.material = winMat;
        box.parent = this.root;
        box.isPickable = false;
        this.nightWindows.push(box);
      }
    };

    // Always place on civic plots if those buildings exist
    if (st.buildings.some((b) => b.kind === "great_house")) {
      placeWindows("civic-gh", 4, 1.35);
      placeWindows("civic-gh", 3, 1.95);
    }
    if (st.buildings.some((b) => b.kind === "market")) {
      placeWindows("civic-market", 3, 1.15);
    }
  }

  private refreshBuildingMeta(b: BuildingState) {
    const hit = this.hitMeshes.get(b.id);
    if (hit) hit.metadata = { buildingId: b.id, kind: b.kind, plotId: b.plotId };
  }

  private createBuilding(b: BuildingState): TransformNode {
    const kit = instantiateBuildingFromKit(
      this.scene,
      this.kitCache,
      b,
      this.shadowGen
    );
    kit.root.parent = this.root;
    this.buildingKits.set(b.id, kit);
    this.hitMeshes.set(b.id, kit.hit);

    kit.hit.actionManager = new ActionManager(this.scene);
    kit.hit.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => {
        for (const e of kit.emissives) {
          const m = e.material as StandardMaterial | null;
          if (m) m.emissiveColor = hexToColor3(STYLE.goldSoft).scale(0.35);
        }
      })
    );
    kit.hit.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => {
        // Atmosphere loop re-applies night emissives next frame
      })
    );

    return kit.root;
  }

  private placeBuilding(node: TransformNode, b: BuildingState) {
    const w = b.plotId ? this.plotWorldArch(b.plotId) : { x: 0, z: 0 };
    // Harbor building sits on pier deck
    const y = b.plotId === "special-harbor" ? 0.08 : 0;
    node.position.set(w.x, y, w.z);
  }

  /** Dirt → packed → stone as Great House levels. */
  private buildRoads(tier: RoadTier) {
    this.roadRoot?.dispose();
    this.roadMeshes = [];
    this.roadRoot = new TransformNode("roads", this.scene);
    this.roadRoot.parent = this.root;
    this.roadTier = tier;

    const colors = ROAD_COLORS[tier];
    const fill = new StandardMaterial(`roadFill-${tier}`, this.scene);
    fill.diffuseColor = hexToColor3(colors.fill);
    fill.specularColor = Color3.Black();
    fill.emissiveColor = hexToColor3(colors.fill).scale(tier === "stone" ? 0.08 : 0.03);

    const edge = new StandardMaterial(`roadEdge-${tier}`, this.scene);
    edge.diffuseColor = hexToColor3(colors.edge);
    edge.specularColor = Color3.Black();

    const width = tier === "stone" ? 1.15 : tier === "packed" ? 1.0 : 0.88;
    const height = tier === "stone" ? 0.07 : 0.055;

    const layout = this.mapArch.layout;
    for (const [aId, bId] of PATH_EDGES) {
      const a0 = getPathNode(aId);
      const b0 = getPathNode(bId);
      if (!a0 || !b0) continue;
      const a = transformPlotPos(a0.x, a0.z, layout);
      const b = transformPlotPos(b0.x, b0.z, layout);
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      const midX = (a.x + b.x) / 2;
      const midZ = (a.z + b.z) / 2;
      const seg = MeshBuilder.CreateBox(
        `road-${aId}-${bId}`,
        { width: len, height, depth: width },
        this.scene
      );
      seg.position.set(midX, height / 2 + 0.01, midZ);
      seg.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
      seg.material = fill;
      seg.parent = this.roadRoot;
      seg.isPickable = false;
      this.roadMeshes.push(seg);

      // Soft edge strip under for dirt definition
      if (tier !== "stone") {
        const rim = MeshBuilder.CreateBox(
          `roadRim-${aId}-${bId}`,
          { width: len + 0.08, height: height * 0.6, depth: width + 0.22 },
          this.scene
        );
        rim.position.set(midX, height * 0.25, midZ);
        rim.rotation.y = seg.rotation.y;
        rim.material = edge;
        rim.parent = this.roadRoot;
        rim.isPickable = false;
        this.roadMeshes.push(rim);
      }
    }

    // Hub discs at intersections
    for (const n0 of PATH_NODES.filter((p) => p.id.startsWith("hub-"))) {
      const n = transformPlotPos(n0.x, n0.z, layout);
      const disc = MeshBuilder.CreateCylinder(
        `hub-${n0.id}`,
        { diameter: width * 1.35, height: height + 0.01, tessellation: 12 },
        this.scene
      );
      disc.position.set(n.x, height / 2 + 0.012, n.z);
      disc.material = fill;
      disc.parent = this.roadRoot;
      disc.isPickable = false;
      this.roadMeshes.push(disc);
    }
  }

  private syncRoads(ghLevel: number) {
    const tier = roadTierForGhLevel(ghLevel);
    if (tier !== this.roadTier) this.buildRoads(tier);
  }

  private syncWorkers(settlement: SettlementState) {
    this.activePlotIds = settlement.buildings
      .map((b) => b.plotId)
      .filter(Boolean) as string[];
    // Always include civic hubs for idle paths
    if (!this.activePlotIds.includes("civic-gh")) {
      this.activePlotIds.push("civic-gh");
    }
    if (!this.activePlotIds.includes("civic-market")) {
      this.activePlotIds.push("civic-market");
    }

    // Sim-driven count only — never invent 14–26 for stills (02.8/02.9)
    const assigned = settlement.buildings.reduce(
      (n, b) => n + (typeof (b as { workers?: number }).workers === "number"
        ? (b as { workers: number }).workers
        : 0),
      0
    );
    const pool = Math.max(settlement.workers ?? 0, assigned);
    let show: number;
    if (this.boardApprovalMode) {
      show = Math.min(2, Math.max(1, pool > 0 ? 2 : 1));
    } else {
      // Soft cap 8 on high; 0 assigned → 0–1 idle near GH
      const softMax = this.quality === "low" ? 4 : this.quality === "med" ? 6 : 8;
      show = pool <= 0 ? 1 : Math.min(softMax, Math.max(1, pool));
    }

    while (this.workers.length < show) {
      this.workers.push(this.spawnWorker(this.workers.length));
    }
    while (this.workers.length > show) {
      const w = this.workers.pop();
      w?.root.dispose();
    }
    for (const w of this.workers) {
      this.assignRoute(w);
    }
  }

  /** Fixed promenade so agents are always on-camera mid-iso. */
  private promenadePoly(): { x: number; z: number }[] {
    return [
      { x: -7.5, z: -3.5 },
      { x: -4.0, z: -2.0 },
      { x: -1.0, z: 0.2 },
      { x: 2.5, z: 1.5 },
      { x: 5.5, z: 3.5 },
      { x: 4.0, z: 6.0 },
      { x: 0.5, z: 5.5 },
      { x: -3.5, z: 4.0 },
      { x: -6.5, z: 1.5 },
      { x: -7.5, z: -3.5 },
    ];
  }

  private spawnWorker(i: number): WorkerAgent {
    const root = new TransformNode(`worker-${i}`, this.scene);
    root.parent = this.root;
    // Tiny people vs buildings (door-relative) — never dominate board
    root.scaling.setAll(0.42);
    // Thin human silhouette: torso + head + arms + legs (not barrel/silo)
    const linen = hexToColor3("#FFF8EC");
    const skin = hexToColor3("#C9956C");
    const accent = hexToColor3(i % 2 === 0 ? STYLE.sealAccent : STYLE.riverDeep);

    const torso = MeshBuilder.CreateBox(
      `wtorso-${i}`,
      { width: 0.38, height: 0.55, depth: 0.22 },
      this.scene
    );
    torso.position.y = 0.95;
    const tm = new StandardMaterial(`wtm-${i}`, this.scene);
    tm.diffuseColor = linen;
    tm.emissiveColor = linen.scale(0.4);
    tm.specularColor = Color3.Black();
    torso.material = tm;
    torso.parent = root;
    torso.isPickable = false;

    const legs = MeshBuilder.CreateBox(
      `wlegs-${i}`,
      { width: 0.32, height: 0.55, depth: 0.18 },
      this.scene
    );
    legs.position.y = 0.4;
    const lm = new StandardMaterial(`wlm-${i}`, this.scene);
    lm.diffuseColor = hexToColor3("#2A2118");
    lm.emissiveColor = hexToColor3("#2A2118").scale(0.15);
    lm.specularColor = Color3.Black();
    legs.material = lm;
    legs.parent = root;
    legs.isPickable = false;

    const head = MeshBuilder.CreateSphere(
      `whead-${i}`,
      { diameter: 0.28, segments: 6 },
      this.scene
    );
    head.position.y = 1.4;
    const hm = new StandardMaterial(`whm-${i}`, this.scene);
    hm.diffuseColor = skin;
    hm.emissiveColor = skin.scale(0.2);
    hm.specularColor = Color3.Black();
    head.material = hm;
    head.parent = root;
    head.isPickable = false;

    // Arms out slightly — human read
    for (const side of [-1, 1]) {
      const arm = MeshBuilder.CreateBox(
        `warm-${i}-${side}`,
        { width: 0.1, height: 0.45, depth: 0.1 },
        this.scene
      );
      arm.position.set(side * 0.28, 0.95, 0);
      arm.rotation.z = side * 0.25;
      const am = new StandardMaterial(`wam-${i}-${side}`, this.scene);
      am.diffuseColor = linen;
      am.emissiveColor = linen.scale(0.35);
      am.specularColor = Color3.Black();
      arm.material = am;
      arm.parent = root;
      arm.isPickable = false;
    }

    const sash = MeshBuilder.CreateBox(
      `wsash-${i}`,
      { width: 0.42, height: 0.1, depth: 0.26 },
      this.scene
    );
    sash.position.y = 0.78;
    const sashMat = new StandardMaterial(`wsm-${i}`, this.scene);
    sashMat.diffuseColor = accent;
    sashMat.emissiveColor = accent.scale(0.4);
    sashMat.specularColor = Color3.Black();
    sash.material = sashMat;
    sash.parent = root;
    sash.isPickable = false;

    if (this.shadowGen) this.shadowGen.addShadowCaster(torso, false);
    // No fake foot shadow boxes (02.8 hard fail)

    const agent: WorkerAgent = {
      root,
      body: torso,
      poly: [],
      seg: 0,
      t: 0,
      speed: 0.9 + Math.random() * 0.35,
      bobPhase: Math.random() * Math.PI * 2,
    };
    const spots = this.promenadePoly();
    const s = spots[i % spots.length]!;
    agent.poly = [
      s,
      spots[(i + 1) % spots.length]!,
      spots[(i + 2) % spots.length]!,
      spots[(i + 3) % spots.length]!,
      s,
    ];
    agent.seg = 0;
    agent.t = (i * 0.09) % 1;
    agent.root.position.set(
      s.x + ((i % 3) - 1) * 0.55,
      0.05,
      s.z + ((i % 2) - 0.5) * 0.55
    );
    return agent;
  }

  private entranceNodeForPlot(plotId: string): string | null {
    const n = plotEntranceNodes().find((p) => p.plotId === plotId);
    return n?.id ?? null;
  }

  private mapPoly(ids: string[]): { x: number; z: number }[] {
    return polylineFromNodeIds(ids).map((p) =>
      transformPlotPos(p.x, p.z, this.mapArch.layout)
    );
  }

  private assignRoute(w: WorkerAgent) {
    // Road / pad-entrance graph ONLY — no free promenade through building mass (02.8/03)
    const entrances = this.activePlotIds
      .map((pid) => this.entranceNodeForPlot(pid))
      .filter((id): id is string => !!id);
    const hubs = PATH_NODES.filter((n) => n.id.startsWith("hub-")).map((n) => n.id);
    const pool = entrances.length > 0 ? entrances : hubs.length > 0 ? hubs : ["hub-civic"];
    const from = pool[Math.floor(Math.random() * pool.length)] ?? "hub-civic";
    let to = from;
    let guard = 0;
    while (to === from && guard++ < 10 && pool.length > 1) {
      to = pool[Math.floor(Math.random() * pool.length)]!;
    }
    const ids = pathBetween(from, to);
    w.poly = this.mapPoly(ids);
    // Fallback: hub ring only (still road nodes), never free-space promenade
    if (w.poly.length < 2) {
      const hubIds = hubs.length >= 2 ? hubs : pool;
      w.poly = this.mapPoly(hubIds.length >= 2 ? [hubIds[0]!, hubIds[1]!, hubIds[0]!] : [from, to]);
    }
    if (w.poly.length < 2) {
      // Last resort: two PATH_NODES world points
      const a = PATH_NODES[0];
      const b = PATH_NODES[1] ?? PATH_NODES[0];
      if (a && b) {
        const la = transformPlotPos(a.x, a.z, this.mapArch.layout);
        const lb = transformPlotPos(b.x, b.z, this.mapArch.layout);
        w.poly = [la, lb, la];
      }
    }
    w.seg = 0;
    w.t = Math.random() * 0.3;
    if (w.poly[0]) w.root.position.set(w.poly[0].x, 0.28, w.poly[0].z);
  }

  private animateWorkers() {
    const now = performance.now() * 0.001;
    const dt = Math.min(0.05, now - this.lastAnimT);
    this.lastAnimT = now;

    for (const w of this.workers) {
      if (w.poly.length < 2) {
        this.assignRoute(w);
        continue;
      }
      // Advance along current segment
      while (w.seg < w.poly.length - 1) {
        const a = w.poly[w.seg]!;
        const b = w.poly[w.seg + 1]!;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz) || 0.001;
        const step = (w.speed * dt) / len;
        w.t += step;
        if (w.t < 1) {
          const x = a.x + dx * w.t;
          const z = a.z + dz * w.t;
          const bob = Math.sin(now * 8 + w.bobPhase) * 0.02;
          w.root.position.set(x, 0.28 + bob, z);
          // Face travel direction
          w.root.rotation.y = Math.atan2(dx, dz);
          break;
        }
        w.t -= 1;
        w.seg += 1;
        if (w.seg >= w.poly.length - 1) {
          this.assignRoute(w);
          break;
        }
      }
    }
    if (this.selectRing?.isEnabled()) {
      const s = 1 + Math.sin(now * 4) * 0.06;
      this.selectRing.scaling.set(s, s, s);
    }
  }

  captureDataUrl(): string {
    return this.engine.getRenderingCanvas()?.toDataURL("image/jpeg", 0.7) ?? "";
  }

  dispose() {
    this.engine.dispose();
  }
}

/** Path-following worker (walks road graph only). */
interface WorkerAgent {
  root: TransformNode;
  body: Mesh;
  /** World polyline to follow */
  poly: { x: number; z: number }[];
  /** Current segment index into poly */
  seg: number;
  /** 0–1 progress along current segment */
  t: number;
  speed: number;
  bobPhase: number;
}
