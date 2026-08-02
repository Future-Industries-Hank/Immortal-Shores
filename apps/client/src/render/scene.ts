import {
  ActionManager,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  ExecuteCodeAction,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointerEventTypes,
  Scene,
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
  createBuildingKit,
  type BuildingMeshes,
} from "./buildings.js";
import { hexToColor3 } from "./colors.js";
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
  private scaffoldNode: TransformNode | null = null;
  private roadRoot: TransformNode | null = null;
  private roadMeshes: Mesh[] = [];
  private roadTier: RoadTier = "dirt";
  private envRoot: TransformNode | null = null;
  private riverMesh: Mesh | null = null;
  private bargeNode: TransformNode | null = null;
  private foamMeshes: Mesh[] = [];
  private atmosphere: Atmosphere;
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
    this.scene = new Scene(this.engine);
    this.scene.clearColor = Color4.FromColor3(hexToColor3("#87A8B8"), 1);

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

    const sun = new DirectionalLight("sun", new Vector3(-0.55, -1, 0.3), this.scene);
    sun.intensity = 1.05;
    sun.diffuse = hexToColor3("#FFD9A0");
    const hemi = new HemisphericLight("hemi", new Vector3(0.15, 1, 0.1), this.scene);
    hemi.intensity = 0.45;
    hemi.groundColor = hexToColor3(STYLE.sandDeep);
    this.atmosphere = new Atmosphere(this.scene, sun, hemi);

    this.root = new TransformNode("settlement", this.scene);
    this.rebuildEnvironment(this.mapArch);
    this.buildRoads("dirt");
    this.buildFixedPads();
    this.buildSelectRing();
    this.wirePicking(canvas);

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

  private rebuildEnvironment(arch: MapArchetype) {
    this.envRoot?.dispose();
    this.foamMeshes = [];
    this.bargeNode = null;
    this.riverMesh = null;
    this.envRoot = new TransformNode("env", this.scene);
    this.envRoot.parent = this.root;
    this.mapArch = arch;
    const pal = arch.palette;

    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: 38, height: 30, subdivisions: this.quality === "low" ? 4 : 12 },
      this.scene
    );
    ground.position.set(0, 0, 1);
    const mat = new StandardMaterial("groundMat", this.scene);
    mat.diffuseColor = hexToColor3(pal.sand);
    mat.specularColor = Color3.Black();
    mat.emissiveColor = hexToColor3(pal.sand).scale(0.04);
    ground.material = mat;
    ground.parent = this.envRoot;
    ground.isPickable = false;

    // Soft dune accents (spatial depth without clutter) — keep low so ortho never clips a giant ellipsoid
    if (this.quality !== "low") {
      const duneMat = new StandardMaterial("duneMat", this.scene);
      duneMat.diffuseColor = hexToColor3(STYLE.sandDeep);
      duneMat.specularColor = Color3.Black();
      for (const [x, z, sx, sz] of [
        [7, -7.5, 2.4, 1.4],
        [11, 3.5, 2.0, 1.2],
        [9, 8.5, 2.2, 1.3],
      ] as const) {
        const d = MeshBuilder.CreateBox(
          `dune-${x}-${z}`,
          { width: sx, height: 0.22, depth: sz },
          this.scene
        );
        d.position.set(x, 0.08, z);
        d.material = duneMat;
        d.parent = this.envRoot;
        d.isPickable = false;
      }
    }

    // River along the LEFT — harbor sits on this waterline
    const river = MeshBuilder.CreateBox(
      "river",
      { width: 5.8, height: 0.14, depth: 28 },
      this.scene
    );
    river.position.set(-13.2, 0.02, 1.5);
    const rmat = new StandardMaterial("riverMat", this.scene);
    rmat.diffuseColor = hexToColor3(pal.river);
    rmat.specularColor = hexToColor3(pal.riverLight);
    rmat.alpha = 0.9;
    river.material = rmat;
    river.parent = this.envRoot;
    river.isPickable = false;
    this.riverMesh = river;

    // River foam patches (small, fully opaque-ish so ortho never washes)
    const foamMat = new StandardMaterial("foamMat", this.scene);
    foamMat.diffuseColor = hexToColor3("#C5D8E0");
    foamMat.emissiveColor = hexToColor3("#C5D8E0").scale(0.05);
    foamMat.alpha = 0.7;
    foamMat.specularColor = Color3.Black();
    for (let i = 0; i < (this.quality === "low" ? 3 : 6); i++) {
      const foam = MeshBuilder.CreateBox(
        `foam-${i}`,
        { width: 0.45 + (i % 3) * 0.12, height: 0.03, depth: 0.22 },
        this.scene
      );
      foam.position.set(-13.6 - (i % 2) * 0.25, 0.1, -7 + i * 3.0);
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

    if (this.quality !== "low") {
      const reedMat = new StandardMaterial("envReed", this.scene);
      reedMat.diffuseColor = hexToColor3(STYLE.reedGreen);
      reedMat.specularColor = Color3.Black();
      for (let i = 0; i < 14; i++) {
        const r = MeshBuilder.CreateCylinder(
          `envReed-${i}`,
          { height: 0.55 + (i % 3) * 0.12, diameter: 0.07, tessellation: 5 },
          this.scene
        );
        r.position.set(-10.0 + (i % 2) * 0.25, 0.28, -7 + i * 1.35);
        r.material = reedMat;
        r.parent = this.envRoot;
        r.isPickable = false;
      }
    }

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
  }

  /** Sparse typed pads only — not a free city grid. */
  private buildFixedPads() {
    for (const m of this.padMeshes.values()) m.dispose();
    for (const m of this.padIcons.values()) m.dispose();
    this.padMeshes.clear();
    this.padMats.clear();
    this.padIcons.clear();

    for (const def of SETTLEMENT_PLOTS) {
      const pos = this.worldPos(def);
      const mat = new StandardMaterial(`padMat-${def.id}`, this.scene);
      mat.diffuseColor = hexToColor3(def.tint);
      mat.specularColor = Color3.Black();
      mat.emissiveColor = hexToColor3(def.tint).scale(0.12);
      this.padMats.set(def.id, mat);

      const isHarbor = def.id === "special-harbor";
      const pad = MeshBuilder.CreateBox(
        `pad-${def.id}`,
        {
          width: isHarbor ? 2.8 : 2.6,
          height: isHarbor ? 0.16 : 0.2,
          depth: isHarbor ? 2.4 : 2.6,
        },
        this.scene
      );
      pad.position.set(pos.x, isHarbor ? 0.14 : 0.1, pos.z);
      pad.material = mat;
      pad.parent = this.root;
      pad.isPickable = !def.starterKind;
      pad.metadata = {
        plotId: def.id,
        category: def.category,
        label: def.label,
      };

      const border = MeshBuilder.CreateBox(
        `border-${def.id}`,
        {
          width: isHarbor ? 3.0 : 2.85,
          height: 0.06,
          depth: isHarbor ? 2.6 : 2.85,
        },
        this.scene
      );
      border.position.set(pos.x, isHarbor ? 0.06 : 0.03, pos.z);
      const bm = new StandardMaterial(`borderMat-${def.id}`, this.scene);
      bm.diffuseColor = hexToColor3(def.tint).scale(0.55);
      bm.specularColor = Color3.Black();
      border.material = bm;
      border.parent = this.root;
      border.isPickable = false;

      // Category icon (shape+color) for empty buildable pads
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
      pad.visibility = taken && !underConstruction ? 0.22 : underConstruction ? 0.55 : 1;
      pad.metadata = {
        plotId: def.id,
        category: def.category,
        label: def.label,
        ...(underConstruction ? { construction: true } : {}),
      };
      const mat = this.padMats.get(id);
      if (mat) {
        if (underConstruction) {
          mat.emissiveColor = hexToColor3(STYLE.goldSoft).scale(0.2);
        } else if (!taken) {
          mat.emissiveColor = hexToColor3(def.tint).scale(0.12);
        } else {
          mat.emissiveColor = Color3.Black();
        }
      }
      // Hide category icons on occupied pads
      const icon = this.padIcons.get(id);
      if (icon) {
        icon.setEnabled(!taken || underConstruction);
        icon.visibility = underConstruction ? 0.35 : 1;
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
    this.updateSelectRing();
  }

  private refreshBuildingMeta(b: BuildingState) {
    const hit = this.hitMeshes.get(b.id);
    if (hit) hit.metadata = { buildingId: b.id, kind: b.kind, plotId: b.plotId };
  }

  private createBuilding(b: BuildingState): TransformNode {
    const kit = createBuildingKit(this.scene, b);
    kit.root.parent = this.root;
    this.buildingKits.set(b.id, kit);
    this.hitMeshes.set(b.id, kit.hit);

    kit.hit.actionManager = new ActionManager(this.scene);
    kit.hit.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => {
        for (const e of kit.emissives) {
          const m = e.material as StandardMaterial | null;
          if (m) m.emissiveColor = hexToColor3(STYLE.goldSoft).scale(0.3);
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

    const cap = this.quality === "low" ? 6 : this.quality === "med" ? 12 : 18;
    // Assigned workers on roads; a few idle walkers when population exists
    const assigned = Math.min(cap, settlement.workersAssigned);
    const idle =
      settlement.workers > 0
        ? Math.min(4, Math.max(1, Math.ceil(settlement.workers / 6)))
        : 0;
    const show = Math.min(cap, Math.max(assigned, idle));

    while (this.workers.length < show) {
      this.workers.push(this.spawnWorker(this.workers.length));
    }
    while (this.workers.length > show) {
      const w = this.workers.pop();
      w?.root.dispose();
    }
    // Rebind destinations when buildings change
    for (const w of this.workers) {
      if (!w.poly.length) this.assignRoute(w);
    }
  }

  private spawnWorker(i: number): WorkerAgent {
    const root = new TransformNode(`worker-${i}`, this.scene);
    root.parent = this.root;
    // High-contrast robes (ink / seal / reed) so workers read on sand at mid iso
    const robe =
      i % 3 === 0 ? "#3A2A20" : i % 3 === 1 ? "#6B3A3A" : "#3F5A38";
    const body = MeshBuilder.CreateCapsule(
      `workerBody-${i}`,
      { height: 0.78, radius: 0.16 },
      this.scene
    );
    body.position.y = 0.4;
    const mat = new StandardMaterial(`wm-${i}`, this.scene);
    mat.diffuseColor = hexToColor3(robe);
    mat.emissiveColor = hexToColor3(robe).scale(0.08);
    mat.specularColor = Color3.Black();
    body.material = mat;
    body.isPickable = false;
    body.parent = root;
    // Pale head + linen sash for silhouette pop
    const head = MeshBuilder.CreateSphere(
      `workerHead-${i}`,
      { diameter: 0.26, segments: 6 },
      this.scene
    );
    head.position.y = 0.88;
    const hm = new StandardMaterial(`wh-${i}`, this.scene);
    hm.diffuseColor = hexToColor3("#E8D4B0");
    hm.emissiveColor = hexToColor3("#E8D4B0").scale(0.12);
    hm.specularColor = Color3.Black();
    head.material = hm;
    head.isPickable = false;
    head.parent = root;
    const sash = MeshBuilder.CreateBox(
      `wsash-${i}`,
      { width: 0.38, height: 0.1, depth: 0.2 },
      this.scene
    );
    sash.position.y = 0.42;
    const sashMat = new StandardMaterial(`wsm-${i}`, this.scene);
    sashMat.diffuseColor = hexToColor3(STYLE.goldSoft);
    sashMat.emissiveColor = hexToColor3(STYLE.goldSoft).scale(0.15);
    sashMat.specularColor = Color3.Black();
    sash.material = sashMat;
    sash.isPickable = false;
    sash.parent = root;
    // Contact shadow
    const shadow = MeshBuilder.CreateBox(
      `wsh-${i}`,
      { width: 0.32, height: 0.03, depth: 0.28 },
      this.scene
    );
    shadow.position.y = 0.02;
    const sm = new StandardMaterial(`wshm-${i}`, this.scene);
    sm.diffuseColor = Color3.Black();
    sm.alpha = 0.22;
    sm.specularColor = Color3.Black();
    sm.disableLighting = true;
    shadow.material = sm;
    shadow.isPickable = false;
    shadow.parent = root;

    const agent: WorkerAgent = {
      root,
      body,
      poly: [],
      seg: 0,
      t: 0,
      speed: 1.1 + Math.random() * 0.55,
      bobPhase: Math.random() * Math.PI * 2,
    };
    this.assignRoute(agent);
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
    const entrances = this.activePlotIds
      .map((pid) => this.entranceNodeForPlot(pid))
      .filter((id): id is string => !!id);
    if (entrances.length < 1) {
      const route = pathBetween("hub-res", "hub-train");
      w.poly = this.mapPoly(route);
      w.seg = 0;
      w.t = 0;
      if (w.poly[0]) w.root.position.set(w.poly[0].x, 0.22, w.poly[0].z);
      return;
    }
    const from =
      entrances[Math.floor(Math.random() * entrances.length)] ?? "hub-civic";
    let to = from;
    if (entrances.length > 1) {
      let guard = 0;
      while (to === from && guard++ < 8) {
        to = entrances[Math.floor(Math.random() * entrances.length)]!;
      }
    } else {
      to = "hub-civic";
    }
    const ids = pathBetween(from, to);
    w.poly = this.mapPoly(ids);
    w.seg = 0;
    w.t = Math.random() * 0.2;
    if (w.poly[0]) {
      w.root.position.set(w.poly[0].x, 0.22, w.poly[0].z);
    }
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
          const bob = Math.sin(now * 8 + w.bobPhase) * 0.03;
          w.root.position.set(x, 0.22 + bob, z);
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
