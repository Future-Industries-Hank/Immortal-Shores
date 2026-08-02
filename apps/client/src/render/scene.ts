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
import { applyMoneyShotCamera } from "./moneyShot.js";
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

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: true,
    });
    this.engine.resize();
    this.scene = new Scene(this.engine);
    this.scene.clearColor = Color4.FromColor3(hexToColor3("#87A8B8"), 1);
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

    // Soft contact shadows (Surviving Mars / Aven readability)
    this.shadowGen = new ShadowGenerator(2048, this.sun);
    this.shadowGen.useBlurExponentialShadowMap = true;
    this.shadowGen.blurKernel = 32;
    this.shadowGen.darkness = 0.55;
    this.shadowGen.bias = 0.0004;
    this.shadowGen.normalBias = 0.015;
    this.shadowGen.contactHardeningLightSizeUVRatio = 0.05;

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
    this.atmosphere.setPhase("day");
    applyMoneyShotCamera(this.camera);
    this.setOrtho(this.camera.radius);
    this.engine.resize();
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
        const n = (Math.random() - 0.5) * 36;
        const n2 = ((i * 17) % 23) - 11;
        img.data[i * 4] = Math.max(0, Math.min(255, br + n + n2));
        img.data[i * 4 + 1] = Math.max(0, Math.min(255, bg + n * 0.9 + n2 * 0.5));
        img.data[i * 4 + 2] = Math.max(0, Math.min(255, bb + n * 0.7));
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      // Soft mottles
      for (let k = 0; k < 40; k++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 8 + Math.random() * 22;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(160,120,70,0.18)");
        g.addColorStop(1, "rgba(160,120,70,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      tex.update(false);
      tex.uScale = 6;
      tex.vScale = 5;
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
    this.riverMesh = null;
    this.envRoot = new TransformNode("env", this.scene);
    this.envRoot.parent = this.root;
    this.mapArch = arch;
    const pal = arch.palette;

    // Near sand plate
    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: 48, height: 42, subdivisions: this.quality === "low" ? 16 : 56 },
      this.scene
    );
    ground.position.set(-2, 0, 1.5);
    const mat = new StandardMaterial("groundMat", this.scene);
    mat.diffuseColor = hexToColor3(pal.sand);
    mat.specularColor = hexToColor3("#3A3020").scale(0.08);
    mat.emissiveColor = hexToColor3(pal.sand).scale(0.03);
    const grit = this.makeSandTexture(pal.sand);
    if (grit) {
      mat.diffuseTexture = grit;
      mat.diffuseColor = Color3.White();
    }
    ground.material = mat;
    ground.parent = this.envRoot;
    ground.isPickable = false;
    ground.receiveShadows = true;

    // Far sand ring — darker/cooler for distance falloff (depth category)
    const far = MeshBuilder.CreateGround(
      "farSand",
      { width: 70, height: 60, subdivisions: 8 },
      this.scene
    );
    far.position.set(4, -0.02, 4);
    const farMat = new StandardMaterial("farSandMat", this.scene);
    farMat.diffuseColor = hexToColor3("#B8A078");
    farMat.emissiveColor = hexToColor3("#8A7858").scale(0.08);
    farMat.specularColor = Color3.Black();
    far.material = farMat;
    far.parent = this.envRoot;
    far.isPickable = false;
    far.receiveShadows = true;

    const wet = MeshBuilder.CreateGround(
      "wetBank",
      { width: 3.2, height: 28, subdivisions: 4 },
      this.scene
    );
    wet.position.set(-10.4, 0.015, 1.5);
    const wetMat = new StandardMaterial("wetMat", this.scene);
    wetMat.diffuseColor = hexToColor3("#A89068");
    wetMat.specularColor = hexToColor3(STYLE.riverLight).scale(0.2);
    wetMat.emissiveColor = hexToColor3("#6A5840").scale(0.05);
    wet.material = wetMat;
    wet.parent = this.envRoot;
    wet.isPickable = false;
    wet.receiveShadows = true;

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

    // Deep Nile: dark channel + specular mid + bright wet lip + foam edge
    const river = MeshBuilder.CreateBox(
      "river",
      { width: 9.5, height: 0.28, depth: 70 },
      this.scene
    );
    river.position.set(-15.0, -0.1, 2);
    const rmat = new StandardMaterial("riverMat", this.scene);
    rmat.diffuseColor = hexToColor3("#0F2A3C");
    rmat.specularColor = hexToColor3("#8EC4E0").scale(0.7);
    rmat.specularPower = 64;
    rmat.alpha = 0.96;
    rmat.emissiveColor = hexToColor3("#0A1828").scale(0.2);
    river.material = rmat;
    river.parent = this.envRoot;
    river.isPickable = false;
    this.riverMesh = river;

    const mid = MeshBuilder.CreateBox(
      "riverMid",
      { width: 2.6, height: 0.12, depth: 65 },
      this.scene
    );
    mid.position.set(-11.8, 0.01, 2);
    const midMat = new StandardMaterial("riverMidMat", this.scene);
    midMat.diffuseColor = hexToColor3("#1A4560");
    midMat.specularColor = hexToColor3("#A0D0E8").scale(0.55);
    midMat.specularPower = 48;
    midMat.alpha = 0.92;
    mid.material = midMat;
    mid.parent = this.envRoot;
    mid.isPickable = false;

    const shallow = MeshBuilder.CreateBox(
      "riverShallow",
      { width: 1.6, height: 0.08, depth: 60 },
      this.scene
    );
    shallow.position.set(-10.4, 0.04, 2);
    const shMat = new StandardMaterial("shallowMat", this.scene);
    shMat.diffuseColor = hexToColor3("#3A6A7A");
    shMat.specularColor = hexToColor3("#C0E0F0").scale(0.4);
    shMat.alpha = 0.82;
    shallow.material = shMat;
    shallow.parent = this.envRoot;
    shallow.isPickable = false;

    // Broken organic foam — irregular clusters, not a solid white curb
    const flMat = new StandardMaterial("foamLineMat", this.scene);
    flMat.diffuseColor = hexToColor3("#E8F0F4");
    flMat.emissiveColor = hexToColor3("#D8E8F0").scale(0.5);
    flMat.alpha = 0.9;
    flMat.disableLighting = true;
    flMat.zOffset = -2;
    for (let i = 0; i < 28; i++) {
      const blob = MeshBuilder.CreateSphere(
        `foamBlob-${i}`,
        { diameter: 0.28 + (i % 4) * 0.1, segments: 6 },
        this.scene
      );
      const along = -14 + i * 1.05 + (i % 3) * 0.15;
      blob.position.set(-9.75 - (i % 2) * 0.35, 0.14, along);
      blob.scaling.set(1.2 + (i % 3) * 0.3, 0.3, 0.8 + (i % 2) * 0.3);
      blob.material = flMat;
      blob.parent = this.envRoot;
      blob.isPickable = false;
      blob.renderingGroupId = 1;
    }

    const foamMat = new StandardMaterial("foamMat", this.scene);
    foamMat.diffuseColor = hexToColor3("#D8E8F0");
    foamMat.emissiveColor = hexToColor3("#D8E8F0").scale(0.08);
    foamMat.alpha = 0.75;
    foamMat.specularColor = Color3.Black();
    for (let i = 0; i < (this.quality === "low" ? 4 : 8); i++) {
      const foam = MeshBuilder.CreateBox(
        `foam-${i}`,
        { width: 0.5 + (i % 3) * 0.15, height: 0.04, depth: 0.28 },
        this.scene
      );
      foam.position.set(-13.8 - (i % 2) * 0.3, 0.1, -8 + i * 2.8);
      foam.material = foamMat;
      foam.parent = this.envRoot;
      foam.isPickable = false;
      this.foamMeshes.push(foam);
    }

    // Bank strip + reed fringe
    const bank = MeshBuilder.CreateBox(
      "bank",
      { width: 1.35, height: 0.1, depth: 26 },
      this.scene
    );
    bank.position.set(-10.15, 0.04, 1.5);
    const bmat = new StandardMaterial("bankMat", this.scene);
    bmat.diffuseColor = hexToColor3(pal.bank);
    bmat.specularColor = Color3.Black();
    bank.material = bmat;
    bank.parent = this.envRoot;
    bank.isPickable = false;

    // Dense reed fringe along full bank (Aven/SM environmental coherence)
    const reedMat = new StandardMaterial("envReed", this.scene);
    reedMat.diffuseColor = hexToColor3(STYLE.reedGreen);
    reedMat.specularColor = Color3.Black();
    reedMat.emissiveColor = hexToColor3(STYLE.reedGreen).scale(0.05);
    const reedCount = this.quality === "low" ? 28 : 70;
    for (let i = 0; i < reedCount; i++) {
      const r = MeshBuilder.CreateCylinder(
        `envReed-${i}`,
        {
          height: 0.5 + (i % 4) * 0.14,
          diameter: 0.06 + (i % 3) * 0.015,
          tessellation: 5,
        },
        this.scene
      );
      r.position.set(
        -10.15 + (i % 3) * 0.18 + (i % 5) * 0.02,
        0.3,
        -10 + i * (22 / reedCount)
      );
      r.material = reedMat;
      r.parent = this.envRoot;
      r.isPickable = false;
      if (this.shadowGen && this.quality === "high") {
        this.shadowGen.addShadowCaster(r, false);
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

    // Ambient barge on river (visual life; not sim-bound)
    this.buildBarge();
  }

  private buildBarge() {
    this.bargeNode?.dispose();
    const root = new TransformNode("barge", this.scene);
    root.parent = this.envRoot;
    root.position.set(-13.0, 0.12, -2);
    const hull = MeshBuilder.CreateBox(
      "bargeHull",
      { width: 0.7, height: 0.22, depth: 1.6 },
      this.scene
    );
    hull.position.y = 0.12;
    const hm = new StandardMaterial("bargeHullMat", this.scene);
    hm.diffuseColor = hexToColor3("#6B4A32");
    hm.specularColor = Color3.Black();
    hull.material = hm;
    hull.parent = root;
    hull.isPickable = false;
    const cabin = MeshBuilder.CreateBox(
      "bargeCabin",
      { width: 0.45, height: 0.28, depth: 0.5 },
      this.scene
    );
    cabin.position.set(0, 0.35, -0.2);
    const cm = new StandardMaterial("bargeCabinMat", this.scene);
    cm.diffuseColor = hexToColor3(STYLE.sandDeep);
    cm.specularColor = Color3.Black();
    cabin.material = cm;
    cabin.parent = root;
    cabin.isPickable = false;
    // Sail cloth
    const sail = MeshBuilder.CreateBox(
      "bargeSail",
      { width: 0.06, height: 0.7, depth: 0.55 },
      this.scene
    );
    sail.position.set(0, 0.7, 0.15);
    const sm = new StandardMaterial("sailMat", this.scene);
    sm.diffuseColor = hexToColor3(STYLE.papyrus);
    sm.emissiveColor = hexToColor3(STYLE.papyrus).scale(0.05);
    sm.specularColor = Color3.Black();
    sail.material = sm;
    sail.parent = root;
    sail.isPickable = false;
    this.bargeNode = root;
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

  /** Soft volume — heat haze + bank mist puffs (reads as air, not hard plane). */
  private buildHazePlanes() {
    // Soft distance wash: large low-alpha plane far side only
    const hazeMat = new StandardMaterial("hazeMat", this.scene);
    hazeMat.diffuseColor = hexToColor3("#D4C4A0");
    hazeMat.emissiveColor = hexToColor3("#C8B890").scale(0.2);
    hazeMat.alpha = 0.14;
    hazeMat.disableLighting = true;
    hazeMat.backFaceCulling = false;
    const farHaze = MeshBuilder.CreateGround(
      "farHaze",
      { width: 30, height: 40 },
      this.scene
    );
    farHaze.position.set(8, 1.4, 2);
    farHaze.material = hazeMat;
    farHaze.parent = this.envRoot;
    farHaze.isPickable = false;

    // Bank mist: soft elongated clouds (not perfect spheres / not hard box)
    const mm = new StandardMaterial("bankMistMat", this.scene);
    mm.diffuseColor = hexToColor3("#D8E4E8");
    mm.emissiveColor = hexToColor3("#C0D4DC").scale(0.25);
    mm.alpha = 0.22;
    mm.disableLighting = true;
    mm.backFaceCulling = false;
    for (let i = 0; i < 12; i++) {
      const mist = MeshBuilder.CreateSphere(
        `bankMist-${i}`,
        { diameter: 2.2 + (i % 4) * 0.4, segments: 10 },
        this.scene
      );
      mist.position.set(-11.8 + (i % 2) * 0.55, 0.7 + (i % 3) * 0.15, -11 + i * 2.1);
      mist.scaling.set(1.6, 0.35, 1.1);
      mist.material = mm;
      mist.parent = this.envRoot;
      mist.isPickable = false;
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

      const border = MeshBuilder.CreateTorus(
        `border-${def.id}`,
        {
          diameter: isHarbor ? 2.5 : 2.3,
          thickness: 0.05,
          tessellation: 24,
        },
        this.scene
      );
      border.rotation.x = Math.PI / 2;
      border.position.set(pos.x, isHarbor ? 0.06 : 0.04, pos.z);
      const bm = new StandardMaterial(`borderMat-${def.id}`, this.scene);
      bm.diffuseColor = Color3.Lerp(hexToColor3(STYLE.sandDeep), tint, 0.4);
      bm.specularColor = Color3.Black();
      bm.emissiveColor = tint.scale(0.05);
      bm.alpha = 0.65;
      border.material = bm;
      border.parent = this.root;
      border.isPickable = false;
      border.receiveShadows = true;
      if (def.starterKind) border.setEnabled(false);

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

        const ghost = MeshBuilder.CreateBox(
          `ghost-${def.id}`,
          { width: 1.6, height: 0.35, depth: 1.4 },
          this.scene
        );
        ghost.position.set(pos.x, 0.22, pos.z);
        const gm = new StandardMaterial(`ghostMat-${def.id}`, this.scene);
        gm.diffuseColor = hexToColor3(STYLE.mudbrick);
        gm.emissiveColor = hexToColor3(STYLE.mudbrick).scale(0.08);
        gm.alpha = 0.35;
        gm.wireframe = true;
        ghost.material = gm;
        ghost.parent = this.root;
        ghost.isPickable = false;
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

    // Force a readable crowd in stills (02.6 life category)
    const cap = this.quality === "low" ? 12 : this.quality === "med" ? 18 : 22;
    const show = settlement.workers > 0 ? cap : Math.max(12, cap);

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

    const shadow = MeshBuilder.CreateBox(
      `wsh-${i}`,
      { width: 0.5, height: 0.04, depth: 0.4 },
      this.scene
    );
    shadow.position.y = 0.02;
    const sm = new StandardMaterial(`wshm-${i}`, this.scene);
    sm.diffuseColor = Color3.Black();
    sm.alpha = 0.4;
    sm.disableLighting = true;
    shadow.material = sm;
    shadow.parent = root;
    shadow.isPickable = false;

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
    // Prefer fixed promenade (always on money-shot frame), mix with path graph
    if (Math.random() < 0.65 || this.activePlotIds.length < 2) {
      w.poly = this.promenadePoly().map((p) => ({ ...p }));
      // Phase-stagger along route
      w.seg = Math.floor(Math.random() * Math.max(1, w.poly.length - 1));
      w.t = Math.random();
      const a = w.poly[w.seg]!;
      w.root.position.set(a.x, 0.32, a.z);
      return;
    }
    const entrances = this.activePlotIds
      .map((pid) => this.entranceNodeForPlot(pid))
      .filter((id): id is string => !!id);
    const from =
      entrances[Math.floor(Math.random() * entrances.length)] ?? "hub-civic";
    let to = from;
    let guard = 0;
    while (to === from && guard++ < 8 && entrances.length > 1) {
      to = entrances[Math.floor(Math.random() * entrances.length)]!;
    }
    const ids = pathBetween(from, to);
    w.poly = this.mapPoly(ids);
    if (w.poly.length < 2) w.poly = this.promenadePoly();
    w.seg = 0;
    w.t = Math.random() * 0.3;
    if (w.poly[0]) w.root.position.set(w.poly[0].x, 0.32, w.poly[0].z);
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
          const bob = Math.sin(now * 8 + w.bobPhase) * 0.04;
          w.root.position.set(x, 0.32 + bob, z);
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
