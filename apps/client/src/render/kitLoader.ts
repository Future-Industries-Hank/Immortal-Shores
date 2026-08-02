/**
 * Blender-exported building kit (glTF). Preload once, clone per building.
 */
import {
  AbstractMesh,
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  SceneLoader,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import type { BuildingState } from "@immortal/shared";
import { createBuildingKit, type BuildingMeshes } from "./buildings.js";

const KIND_TO_FILE: Record<string, string> = {
  great_house: "great_house",
  market: "market",
  emmer_field: "emmer_field",
  river_clay_pit: "river_clay_pit",
  marsh_reed_bed: "marsh_reed_bed",
  ration_house: "ration_house",
  mudbrick_yard: "mudbrick_yard",
  vessel_shop: "vessel_shop",
  reed_basket_shop: "reed_basket_shop",
  luxury_material: "luxury_material",
  luxury_workshop: "luxury_workshop",
  harbor: "harbor",
  warehouse: "warehouse",
  shrine: "shrine",
  training_grounds: "training_grounds",
};

export type KitCache = Map<string, { root: TransformNode; meshes: AbstractMesh[] }>;

export async function preloadBuildingKits(scene: Scene): Promise<KitCache> {
  const cache: KitCache = new Map();
  const kinds = [...new Set(Object.values(KIND_TO_FILE))];
  await Promise.all(
    kinds.map(async (file) => {
      try {
        const result = await SceneLoader.ImportMeshAsync(
          null,
          "/models/buildings/",
          `${file}.glb`,
          scene
        );
        const root = new TransformNode(`kitTpl_${file}`, scene);
        const meshes: AbstractMesh[] = [];
        for (const m of result.meshes) {
          if (m.name === "__root__") {
            m.setEnabled(false);
            continue;
          }
          m.setParent(root);
          m.isPickable = false;
          m.receiveShadows = true;
          if (m.getTotalVertices() > 0) meshes.push(m);
        }
        // Center kit on origin (Blender layout spaced kits across the scene)
        if (meshes.length) {
          let minX = Infinity,
            minY = Infinity,
            minZ = Infinity;
          let maxX = -Infinity,
            maxY = -Infinity,
            maxZ = -Infinity;
          for (const m of meshes) {
            m.computeWorldMatrix(true);
            const bi = m.getBoundingInfo().boundingBox;
            const mn = bi.minimumWorld;
            const mx = bi.maximumWorld;
            minX = Math.min(minX, mn.x);
            minY = Math.min(minY, mn.y);
            minZ = Math.min(minZ, mn.z);
            maxX = Math.max(maxX, mx.x);
            maxY = Math.max(maxY, mx.y);
            maxZ = Math.max(maxZ, mx.z);
          }
          const cx = (minX + maxX) / 2;
          const cz = (minZ + maxZ) / 2;
          const cy = minY; // sit on ground
          for (const m of meshes) {
            m.position.x -= cx;
            m.position.y -= cy;
            m.position.z -= cz;
          }
        }
        root.position = Vector3.Zero();
        root.setEnabled(false);
        cache.set(file, { root, meshes });
      } catch (e) {
        console.warn(`kit load failed ${file}`, e);
      }
    })
  );
  return cache;
}

export function instantiateBuildingFromKit(
  scene: Scene,
  cache: KitCache,
  b: BuildingState,
  shadow?: ShadowGenerator | null
): BuildingMeshes {
  const file = KIND_TO_FILE[b.kind];
  const tpl = file ? cache.get(file) : undefined;
  if (tpl && tpl.meshes.length > 0) {
    const root = new TransformNode(`b-${b.id}`, scene);
    const emissives: Mesh[] = [];
    const anim: BuildingMeshes["anim"] = [];

    for (const src of tpl.meshes) {
      const c = src.clone(`${src.name}_${b.id}`, root) as Mesh | null;
      if (!c) continue;
      c.setEnabled(true);
      c.isPickable = false;
      c.receiveShadows = true;
      c.metadata = { buildingId: b.id, kind: b.kind, plotId: b.plotId };
      if (shadow) shadow.addShadowCaster(c, true);
      // Material separation for board readability (mud vs stone vs wood vs crop)
      const mat = c.material as StandardMaterial | null;
      if (mat) {
        const n = c.name.toLowerCase();
        if (mat.diffuseColor) {
          if (n.includes("stone") || n.includes("gh_") || n.includes("obelisk") || n.includes("shrine")) {
            mat.specularColor = new Color3(0.28, 0.26, 0.22);
            mat.specularPower = 36;
            mat.diffuseColor = Color3.Lerp(mat.diffuseColor, new Color3(0.78, 0.74, 0.66), 0.25);
          } else if (n.includes("mud") || n.includes("body") || n.includes("stall") || n.includes("brick")) {
            mat.specularColor = new Color3(0.04, 0.03, 0.02);
            mat.specularPower = 8;
            mat.diffuseColor = Color3.Lerp(mat.diffuseColor, new Color3(0.58, 0.42, 0.28), 0.2);
          } else if (n.includes("wood") || n.includes("deck") || n.includes("pier") || n.includes("post")) {
            mat.specularColor = new Color3(0.1, 0.07, 0.04);
            mat.diffuseColor = Color3.Lerp(mat.diffuseColor, new Color3(0.4, 0.28, 0.16), 0.15);
          } else if (n.includes("crop") || n.includes("reed") || n.includes("field") || n.includes("plant")) {
            mat.emissiveColor = new Color3(0.04, 0.06, 0.02);
            mat.diffuseColor = Color3.Lerp(mat.diffuseColor, new Color3(0.35, 0.5, 0.22), 0.2);
          }
        }
      }
      const name = c.name.toLowerCase();
      // Night craft = windows/hearth/glow only — never flat roof planes
      if (
        name.includes("gold") ||
        name.includes("glow") ||
        name.includes("window") ||
        name.includes("lamp") ||
        name.includes("hearth") ||
        name.includes("crest") ||
        name.includes("kiln") ||
        (name.includes("canopy") && name.includes("gold"))
      ) {
        emissives.push(c);
      }
      if (name.includes("reed") && !name.includes("basket")) {
        anim.push({ mesh: c, kind: "bob" });
      }
      if (name.includes("glow")) {
        anim.push({ mesh: c, kind: "pulse" });
      }
    }

    // Real ShadowGenerator only — no fake black discs / rake stamp boxes (02.8/02.9)

    const hit = MeshBuilder.CreateBox(
      `hit-${b.id}`,
      { width: 2.8, height: 2.5, depth: 2.8 },
      scene
    );
    hit.position.y = 1.25;
    hit.visibility = 0;
    hit.isPickable = true;
    hit.metadata = { buildingId: b.id, kind: b.kind, plotId: b.plotId };
    hit.parent = root;

    // Structure densify overlays (wall relief / cornice / stalls) — mid-iso mass
    densifyKitOverlay(scene, root, b.kind, b.id, shadow);

    return { root, hit, emissives, anim };
  }

  return createBuildingKit(scene, b);
}

/** Extra silhouette mass so heroes do not read as single prims at mid-iso. */
function densifyKitOverlay(
  scene: Scene,
  root: TransformNode,
  kind: string,
  id: string,
  shadow?: ShadowGenerator | null
) {
  const mud = new StandardMaterial(`dens-mud-${id}`, scene);
  mud.diffuseColor = new Color3(0.55, 0.42, 0.3);
  mud.specularColor = new Color3(0.04, 0.03, 0.02);
  const stone = new StandardMaterial(`dens-stone-${id}`, scene);
  stone.diffuseColor = new Color3(0.72, 0.68, 0.6);
  stone.specularColor = new Color3(0.2, 0.19, 0.17);
  stone.specularPower = 28;
  const wood = new StandardMaterial(`dens-wood-${id}`, scene);
  wood.diffuseColor = new Color3(0.38, 0.28, 0.18);
  wood.specularColor = Color3.Black();
  const darkRoof = new StandardMaterial(`dens-roof-${id}`, scene);
  darkRoof.diffuseColor = new Color3(0.32, 0.26, 0.2);
  darkRoof.specularColor = Color3.Black();

  const add = (mesh: Mesh, mat: StandardMaterial) => {
    mesh.material = mat;
    mesh.parent = root;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    if (shadow) shadow.addShadowCaster(mesh, true);
  };

  // Gold lintel / accent (artboard prestige — never full roof flood)
  const gold = new StandardMaterial(`dens-gold-${id}`, scene);
  gold.diffuseColor = new Color3(0.78, 0.62, 0.28);
  gold.emissiveColor = new Color3(0.12, 0.08, 0.02);
  gold.specularColor = new Color3(0.3, 0.25, 0.1);
  gold.specularPower = 40;
  const reed = new StandardMaterial(`dens-reed-${id}`, scene);
  reed.diffuseColor = new Color3(0.28, 0.42, 0.22);
  reed.specularColor = Color3.Black();
  const pale = new StandardMaterial(`dens-pale-${id}`, scene);
  pale.diffuseColor = new Color3(0.82, 0.76, 0.64);
  pale.specularColor = new Color3(0.15, 0.14, 0.12);

  if (kind === "great_house") {
    // Artboard 01: multi-tier pale stone mass + gold lintel + gallery
    const base = MeshBuilder.CreateBox(`dens-gh-base-${id}`, { width: 2.8, height: 0.28, depth: 2.5 }, scene);
    base.position.y = 0.14;
    add(base, mud);
    const mid = MeshBuilder.CreateBox(`dens-gh-mid-${id}`, { width: 2.4, height: 1.15, depth: 2.1 }, scene);
    mid.position.y = 0.85;
    add(mid, stone);
    const upper = MeshBuilder.CreateBox(`dens-gh-up-${id}`, { width: 1.7, height: 0.75, depth: 1.5 }, scene);
    upper.position.y = 1.75;
    add(upper, pale);
    const cornice = MeshBuilder.CreateBox(`dens-cornice-${id}`, { width: 2.55, height: 0.12, depth: 2.2 }, scene);
    cornice.position.y = 2.15;
    add(cornice, stone);
    const lintel = MeshBuilder.CreateBox(`dens-lintel-${id}`, { width: 1.6, height: 0.1, depth: 0.14 }, scene);
    lintel.position.set(0, 1.15, -1.08);
    add(lintel, gold);
    for (const x of [-0.95, 0, 0.95]) {
      const pil = MeshBuilder.CreateBox(`dens-pil-${id}-${x}`, { width: 0.2, height: 1.6, depth: 0.2 }, scene);
      pil.position.set(x, 0.85, -1.0);
      add(pil, stone);
    }
    const roof = MeshBuilder.CreateBox(`dens-roofcap-${id}`, { width: 1.9, height: 0.22, depth: 1.65 }, scene);
    roof.position.y = 2.35;
    add(roof, darkRoof);
    // Gallery windows (day-readable facade)
    for (let i = 0; i < 4; i++) {
      const win = MeshBuilder.CreateBox(`dens-win-${id}-${i}`, { width: 0.22, height: 0.32, depth: 0.06 }, scene);
      win.position.set(-0.6 + i * 0.4, 1.35, -1.08);
      add(win, gold);
    }
  } else if (kind === "market") {
    // Artboard 02: open colonnade + stall mass + cloth awning
    for (const x of [-0.55, 0.55]) {
      const stall = MeshBuilder.CreateBox(`dens-stall-${id}-${x}`, { width: 0.9, height: 0.7, depth: 0.6 }, scene);
      stall.position.set(x, 0.38, 0.2);
      add(stall, mud);
    }
    const back = MeshBuilder.CreateBox(`dens-mkt-back-${id}`, { width: 2.0, height: 0.95, depth: 0.22 }, scene);
    back.position.set(0, 0.5, 0.75);
    add(back, mud);
    const awn = MeshBuilder.CreateBox(`dens-awn-${id}`, { width: 2.25, height: 0.1, depth: 1.75 }, scene);
    awn.position.y = 1.28;
    const awnMat = new StandardMaterial(`dens-awnm-${id}`, scene);
    awnMat.diffuseColor = new Color3(0.72, 0.5, 0.28);
    awnMat.specularColor = Color3.Black();
    add(awn, awnMat);
    for (const [x, z] of [
      [-0.9, -0.65],
      [0.9, -0.65],
      [-0.9, 0.65],
      [0.9, 0.65],
    ] as const) {
      const p = MeshBuilder.CreateCylinder(`dens-post-${id}-${x}${z}`, { height: 1.25, diameter: 0.13, tessellation: 6 }, scene);
      p.position.set(x, 0.62, z);
      add(p, wood);
    }
    const crate = MeshBuilder.CreateBox(`dens-crate-${id}`, { width: 0.4, height: 0.3, depth: 0.35 }, scene);
    crate.position.set(0, 0.2, -0.55);
    add(crate, wood);
  } else if (kind === "harbor" || kind === "pier") {
    // Artboard 04: pier deck + posts + warehouse shed
    const deck = MeshBuilder.CreateBox(`dens-deck-${id}`, { width: 2.6, height: 0.14, depth: 1.8 }, scene);
    deck.position.y = 0.18;
    add(deck, wood);
    for (const x of [-1.0, 0, 1.0]) {
      const pile = MeshBuilder.CreateCylinder(`dens-pile-${id}-${x}`, { height: 0.55, diameter: 0.16, tessellation: 6 }, scene);
      pile.position.set(x, 0.05, -0.7);
      add(pile, wood);
    }
    const shed = MeshBuilder.CreateBox(`dens-shed-${id}`, { width: 1.4, height: 0.9, depth: 1.1 }, scene);
    shed.position.set(0.3, 0.55, 0.35);
    add(shed, mud);
    const shedRoof = MeshBuilder.CreateBox(`dens-shedroof-${id}`, { width: 1.55, height: 0.12, depth: 1.2 }, scene);
    shedRoof.position.set(0.3, 1.05, 0.35);
    add(shedRoof, darkRoof);
  } else if (kind === "emmer_field" || kind === "marsh_reed_bed") {
    // Artboard 08: soil bed + crop rows + tiny shed
    const soil = MeshBuilder.CreateBox(`dens-soil-${id}`, { width: 2.2, height: 0.12, depth: 2.0 }, scene);
    soil.position.y = 0.06;
    const soilM = new StandardMaterial(`dens-soilm-${id}`, scene);
    soilM.diffuseColor = new Color3(0.45, 0.35, 0.2);
    soilM.specularColor = Color3.Black();
    add(soil, soilM);
    for (let i = 0; i < 9; i++) {
      const row = MeshBuilder.CreateBox(
        `dens-crop-${id}-${i}`,
        { width: 0.5, height: 0.32 + (i % 3) * 0.08, depth: 0.32 },
        scene
      );
      row.position.set(-0.7 + (i % 3) * 0.55, 0.22, -0.55 + Math.floor(i / 3) * 0.5);
      const cm = new StandardMaterial(`dens-cropm-${id}-${i}`, scene);
      cm.diffuseColor =
        kind === "marsh_reed_bed"
          ? new Color3(0.28, 0.45, 0.28)
          : new Color3(0.42 + (i % 2) * 0.08, 0.52, 0.2);
      cm.emissiveColor = new Color3(0.04, 0.06, 0.015);
      cm.specularColor = Color3.Black();
      add(row, cm);
    }
    const shed = MeshBuilder.CreateBox(`dens-fshed-${id}`, { width: 0.55, height: 0.45, depth: 0.5 }, scene);
    shed.position.set(0.85, 0.28, 0.7);
    add(shed, mud);
  } else if (kind === "mudbrick_yard" || kind === "river_clay_pit") {
    // Artboard 03: clay piles + kiln mass
    const yard = MeshBuilder.CreateBox(`dens-yard-${id}`, { width: 2.1, height: 0.1, depth: 1.9 }, scene);
    yard.position.y = 0.05;
    add(yard, mud);
    const pile = MeshBuilder.CreateBox(`dens-pile-${id}`, { width: 1.3, height: 0.65, depth: 1.0 }, scene);
    pile.position.set(-0.35, 0.38, 0.1);
    add(pile, mud);
    const kiln = MeshBuilder.CreateCylinder(`dens-kiln-${id}`, { height: 0.85, diameter: 0.65, tessellation: 8 }, scene);
    kiln.position.set(0.65, 0.48, -0.25);
    add(kiln, mud);
    const glow = MeshBuilder.CreateBox(`dens-kilnglow-${id}`, { width: 0.2, height: 0.15, depth: 0.12 }, scene);
    glow.position.set(0.65, 0.35, -0.55);
    const gm = new StandardMaterial(`dens-kilngm-${id}`, scene);
    gm.diffuseColor = new Color3(0.9, 0.45, 0.15);
    gm.emissiveColor = new Color3(0.35, 0.12, 0.02);
    add(glow, gm);
  } else if (kind === "shrine") {
    // Artboard 06: pale vertical sacred mass
    const plinth = MeshBuilder.CreateBox(`dens-shplinth-${id}`, { width: 1.6, height: 0.2, depth: 1.5 }, scene);
    plinth.position.y = 0.1;
    add(plinth, pale);
    const body = MeshBuilder.CreateBox(`dens-shbody-${id}`, { width: 1.2, height: 1.5, depth: 1.15 }, scene);
    body.position.y = 0.95;
    add(body, pale);
    const cap = MeshBuilder.CreateBox(`dens-shcap-${id}`, { width: 1.35, height: 0.18, depth: 1.25 }, scene);
    cap.position.y = 1.8;
    add(cap, stone);
    const tip = MeshBuilder.CreateBox(`dens-shtip-${id}`, { width: 0.35, height: 0.45, depth: 0.35 }, scene);
    tip.position.y = 2.15;
    add(tip, gold);
  } else if (kind === "training_grounds") {
    // Artboard 05: packed earth + racks
    const earth = MeshBuilder.CreateBox(`dens-earth-${id}`, { width: 2.3, height: 0.08, depth: 2.1 }, scene);
    earth.position.y = 0.04;
    const em = new StandardMaterial(`dens-earthm-${id}`, scene);
    em.diffuseColor = new Color3(0.55, 0.42, 0.28);
    em.specularColor = Color3.Black();
    add(earth, em);
    for (const x of [-0.7, 0.7]) {
      const post = MeshBuilder.CreateCylinder(`dens-tpost-${id}-${x}`, { height: 1.0, diameter: 0.12, tessellation: 6 }, scene);
      post.position.set(x, 0.5, -0.5);
      add(post, wood);
    }
    const rack = MeshBuilder.CreateBox(`dens-rack-${id}`, { width: 1.4, height: 0.12, depth: 0.15 }, scene);
    rack.position.set(0, 0.75, -0.5);
    add(rack, wood);
    const shed = MeshBuilder.CreateBox(`dens-tshed-${id}`, { width: 0.9, height: 0.7, depth: 0.8 }, scene);
    shed.position.set(0.6, 0.4, 0.6);
    add(shed, mud);
  } else if (kind.includes("shop") || kind === "ration_house" || kind === "luxury_material" || kind === "luxury_workshop" || kind === "warehouse") {
    // Artboard 07/09: mudbrick body + dark roof + door lintel
    const body = MeshBuilder.CreateBox(`dens-shop-${id}`, { width: 1.75, height: 1.15, depth: 1.45 }, scene);
    body.position.y = 0.58;
    add(body, mud);
    const roof = MeshBuilder.CreateBox(`dens-shoproof-${id}`, { width: 1.95, height: 0.16, depth: 1.6 }, scene);
    roof.position.y = 1.25;
    add(roof, darkRoof);
    const door = MeshBuilder.CreateBox(`dens-door-${id}`, { width: 0.4, height: 0.65, depth: 0.08 }, scene);
    door.position.set(0, 0.4, -0.75);
    add(door, wood);
    const lintel = MeshBuilder.CreateBox(`dens-shoplintel-${id}`, { width: 0.55, height: 0.08, depth: 0.1 }, scene);
    lintel.position.set(0, 0.78, -0.76);
    add(lintel, kind.includes("luxury") ? gold : stone);
  }
}
