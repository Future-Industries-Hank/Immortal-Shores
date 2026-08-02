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
  getPathNode,
  getPlot,
  pathBetween,
  plotEntranceNodes,
  plotWorld,
  polylineFromNodeIds,
  roadTierForGhLevel,
  type BuildingState,
  type RoadTier,
  type SettlementState,
} from "@immortal/shared";

export type Quality = "low" | "med" | "high";

export type SelectEvent =
  | { type: "building"; buildingId: string }
  | { type: "pad"; plotId: string }
  | { type: "none" };

const KIND_COLOR: Record<string, string> = {
  great_house: STYLE.stonePale,
  market: STYLE.goldSoft,
  emmer_field: STYLE.fieldGreen,
  river_clay_pit: STYLE.mudbrick,
  marsh_reed_bed: STYLE.reedGreen,
  ration_house: STYLE.sandDeep,
  mudbrick_yard: STYLE.mudbrick,
  vessel_shop: STYLE.riverLight,
  reed_basket_shop: STYLE.reedGreen,
  luxury_material: STYLE.sealAccent,
  luxury_workshop: STYLE.goldSoft,
  harbor: STYLE.riverDeep,
  warehouse: STYLE.sandDeep,
  training_grounds: "#A89070",
  shrine: STYLE.stonePale,
};

function hexToColor3(hex: string): Color3 {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return new Color3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export class SettlementView {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  root: TransformNode;
  private buildingNodes = new Map<string, TransformNode>();
  private hitMeshes = new Map<string, Mesh>();
  private padMeshes = new Map<string, Mesh>();
  private padMats = new Map<string, StandardMaterial>();
  private scaffoldNode: TransformNode | null = null;
  private roadRoot: TransformNode | null = null;
  private roadMeshes: Mesh[] = [];
  private roadTier: RoadTier = "dirt";
  private workers: WorkerAgent[] = [];
  private quality: Quality = "med";
  private selectedId: string | null = null;
  private selectedPlotId: string | null = null;
  private selectRing: Mesh | null = null;
  private onSelect: ((ev: SelectEvent) => void) | null = null;
  private pointerDown: { x: number; y: number; t: number } | null = null;
  private occupied = new Set<string>();
  /** Active plot ids that workers may path between */
  private activePlotIds: string[] = [];
  private lastAnimT = performance.now() * 0.001;
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

    this.root = new TransformNode("settlement", this.scene);
    this.buildGroundAndRiver();
    this.buildRoads("dirt");
    this.buildFixedPads();
    this.buildSelectRing();
    this.wirePicking(canvas);

    this.engine.runRenderLoop(() => {
      this.animateWorkers();
      this.scene.render();
    });
    window.addEventListener("resize", () => {
      this.engine.resize();
      this.setOrtho(this.camera.radius);
    });
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
      const w = plotWorld(this.selectedPlotId);
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
            return !!(mesh.metadata?.buildingId || mesh.metadata?.plotId);
          }
        );
        if (pick?.hit && pick.pickedMesh?.metadata?.buildingId) {
          this.selectBuilding(pick.pickedMesh.metadata.buildingId as string);
        } else if (pick?.hit && pick.pickedMesh?.metadata?.plotId) {
          const plotId = pick.pickedMesh.metadata.plotId as string;
          if (this.occupied.has(plotId)) return;
          this.selectPad(plotId);
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
          if (mesh.metadata?.plotId && !this.occupied.has(mesh.metadata.plotId))
            return true;
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
  }

  private buildGroundAndRiver() {
    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: 36, height: 28, subdivisions: 8 },
      this.scene
    );
    ground.position.set(0, 0, 1);
    const mat = new StandardMaterial("groundMat", this.scene);
    mat.diffuseColor = hexToColor3(STYLE.sandLight);
    mat.specularColor = Color3.Black();
    ground.material = mat;
    ground.parent = this.root;
    ground.isPickable = false;

    // River along the LEFT side of the shore
    const river = MeshBuilder.CreateBox(
      "river",
      { width: 5.5, height: 0.12, depth: 26 },
      this.scene
    );
    river.position.set(-13.2, 0.02, 1.5);
    const rmat = new StandardMaterial("riverMat", this.scene);
    rmat.diffuseColor = hexToColor3(STYLE.riverDeep);
    rmat.specularColor = hexToColor3(STYLE.riverLight);
    rmat.alpha = 0.9;
    river.material = rmat;
    river.parent = this.root;
    river.isPickable = false;

    // Bank strip
    const bank = MeshBuilder.CreateBox(
      "bank",
      { width: 1.2, height: 0.08, depth: 24 },
      this.scene
    );
    bank.position.set(-10.2, 0.03, 1.5);
    const bmat = new StandardMaterial("bankMat", this.scene);
    bmat.diffuseColor = hexToColor3("#C4A574");
    bmat.specularColor = Color3.Black();
    bank.material = bmat;
    bank.parent = this.root;
    bank.isPickable = false;
  }

  /** Sparse typed pads only — not a free city grid. */
  private buildFixedPads() {
    for (const def of SETTLEMENT_PLOTS) {
      const mat = new StandardMaterial(`padMat-${def.id}`, this.scene);
      mat.diffuseColor = hexToColor3(def.tint);
      mat.specularColor = Color3.Black();
      mat.emissiveColor = hexToColor3(def.tint).scale(0.12);
      this.padMats.set(def.id, mat);

      const pad = MeshBuilder.CreateBox(
        `pad-${def.id}`,
        { width: 2.6, height: 0.2, depth: 2.6 },
        this.scene
      );
      pad.position.set(def.worldX, 0.1, def.worldZ);
      pad.material = mat;
      pad.parent = this.root;
      pad.isPickable = !def.starterKind;
      pad.metadata = {
        plotId: def.id,
        category: def.category,
        label: def.label,
      };

      // Category border ring (slightly larger, darker)
      const border = MeshBuilder.CreateBox(
        `border-${def.id}`,
        { width: 2.85, height: 0.06, depth: 2.85 },
        this.scene
      );
      border.position.set(def.worldX, 0.03, def.worldZ);
      const bm = new StandardMaterial(`borderMat-${def.id}`, this.scene);
      bm.diffuseColor = hexToColor3(def.tint).scale(0.55);
      bm.specularColor = Color3.Black();
      border.material = bm;
      border.parent = this.root;
      border.isPickable = false;

      pad.actionManager = new ActionManager(this.scene);
      pad.actionManager.registerAction(
        new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => {
          if (this.occupied.has(def.id)) return;
          mat.emissiveColor = hexToColor3(STYLE.goldSoft).scale(0.35);
        })
      );
      pad.actionManager.registerAction(
        new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => {
          mat.emissiveColor = this.occupied.has(def.id)
            ? Color3.Black()
            : hexToColor3(def.tint).scale(0.12);
        })
      );

      this.padMeshes.set(def.id, pad);
    }
  }

  private syncPads(settlement: SettlementState) {
    this.occupied = new Set(
      settlement.buildings.map((b) => b.plotId).filter(Boolean)
    );
    if (settlement.construction?.plotId) {
      this.occupied.add(settlement.construction.plotId);
    }
    for (const [id, pad] of this.padMeshes) {
      const taken = this.occupied.has(id);
      const def = getPlot(id)!;
      pad.isPickable = !taken;
      pad.visibility = taken ? 0.22 : 1;
      const mat = this.padMats.get(id);
      if (mat && !taken) {
        mat.emissiveColor = hexToColor3(def.tint).scale(0.12);
      }
    }
    this.syncScaffold(settlement);
  }

  private syncScaffold(settlement: SettlementState) {
    this.scaffoldNode?.dispose();
    this.scaffoldNode = null;
    const job = settlement.construction;
    if (!job?.plotId) {
      if (job?.buildingId) {
        const b = settlement.buildings.find((x) => x.id === job.buildingId);
        if (b?.plotId) this.scaffoldNode = this.makeScaffold(b.plotId);
      }
      return;
    }
    this.scaffoldNode = this.makeScaffold(job.plotId);
  }

  private makeScaffold(plotId: string): TransformNode {
    const root = new TransformNode(`scaffold-${plotId}`, this.scene);
    root.parent = this.root;
    const w = plotWorld(plotId);
    root.position.set(w.x, 0, w.z);
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
    frame.isPickable = false;
    return root;
  }

  sync(settlement: SettlementState) {
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
    const root = new TransformNode(`b-${b.id}`, this.scene);
    root.parent = this.root;
    const isPlot =
      b.kind.includes("field") || b.kind.includes("bed") || b.kind.includes("pit");
    const h =
      b.kind === "great_house"
        ? 2.6 + b.level * 0.15
        : isPlot
          ? 0.55
          : 1.25 + b.level * 0.1;
    const w = b.kind === "great_house" ? 2.3 : 1.65;
    const box = MeshBuilder.CreateBox(
      `mesh-${b.id}`,
      { width: w, height: h, depth: w * 0.9 },
      this.scene
    );
    box.position.y = h / 2 + 0.2;
    const mat = new StandardMaterial(`mat-${b.id}`, this.scene);
    mat.diffuseColor = hexToColor3(KIND_COLOR[b.kind] ?? STYLE.mudbrick);
    mat.specularColor = Color3.Black();
    box.material = mat;
    box.parent = root;
    box.isPickable = true;
    box.metadata = { buildingId: b.id, kind: b.kind, plotId: b.plotId };

    const hit = MeshBuilder.CreateBox(
      `hit-${b.id}`,
      { width: 2.7, height: Math.max(h + 0.9, 2), depth: 2.7 },
      this.scene
    );
    hit.position.y = Math.max(h + 0.9, 2) / 2;
    hit.visibility = 0;
    hit.isPickable = true;
    hit.metadata = { buildingId: b.id, kind: b.kind, plotId: b.plotId };
    hit.parent = root;
    this.hitMeshes.set(b.id, hit);

    hit.actionManager = new ActionManager(this.scene);
    hit.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => {
        mat.emissiveColor = hexToColor3(STYLE.goldSoft).scale(0.25);
      })
    );
    hit.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => {
        mat.emissiveColor = Color3.Black();
      })
    );

    if (b.kind === "great_house") {
      const roof = MeshBuilder.CreateBox(
        `roof-${b.id}`,
        { width: w * 1.12, height: 0.38, depth: w },
        this.scene
      );
      roof.position.y = h + 0.4;
      const rm = new StandardMaterial(`roofm-${b.id}`, this.scene);
      rm.diffuseColor = hexToColor3(STYLE.goldSoft);
      rm.specularColor = Color3.Black();
      roof.material = rm;
      roof.parent = root;
      roof.isPickable = true;
      roof.metadata = { buildingId: b.id, kind: b.kind, plotId: b.plotId };
    }

    return root;
  }

  private placeBuilding(node: TransformNode, b: BuildingState) {
    const w = b.plotId ? plotWorld(b.plotId) : { x: 0, z: 0 };
    node.position.set(w.x, 0, w.z);
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

    for (const [aId, bId] of PATH_EDGES) {
      const a = getPathNode(aId);
      const b = getPathNode(bId);
      if (!a || !b) continue;
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
    for (const n of PATH_NODES.filter((p) => p.id.startsWith("hub-"))) {
      const disc = MeshBuilder.CreateCylinder(
        `hub-${n.id}`,
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
    const body = MeshBuilder.CreateCapsule(
      `workerBody-${i}`,
      { height: 0.72, radius: 0.13 },
      this.scene
    );
    body.position.y = 0.36;
    const mat = new StandardMaterial(`wm-${i}`, this.scene);
    mat.diffuseColor = hexToColor3(
      i % 3 === 0 ? "#D4B896" : i % 3 === 1 ? "#C4A882" : "#E0C4A0"
    );
    mat.specularColor = Color3.Black();
    body.material = mat;
    body.isPickable = false;
    body.parent = root;

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

  private assignRoute(w: WorkerAgent) {
    const entrances = this.activePlotIds
      .map((pid) => this.entranceNodeForPlot(pid))
      .filter((id): id is string => !!id);
    if (entrances.length < 1) {
      // Fallback: walk spine
      const route = pathBetween("hub-res", "hub-train");
      w.poly = polylineFromNodeIds(route);
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
      // Single plot: loop plot ↔ nearest hub
      to = "hub-civic";
    }
    const ids = pathBetween(from, to);
    w.poly = polylineFromNodeIds(ids);
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
