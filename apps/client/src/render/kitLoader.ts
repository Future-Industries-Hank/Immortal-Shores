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
      // Boost material separation for grayscale readability
      const mat = c.material as StandardMaterial | null;
      if (mat && mat.diffuseColor) {
        const n = c.name.toLowerCase();
        if (n.includes("stone") || n.includes("gh_") || n.includes("obelisk")) {
          mat.specularColor = new Color3(0.25, 0.24, 0.22);
          mat.specularPower = 32;
        } else if (n.includes("mud") || n.includes("body") || n.includes("stall")) {
          mat.specularColor = new Color3(0.04, 0.03, 0.02);
          mat.specularPower = 8;
        } else if (n.includes("wood") || n.includes("deck") || n.includes("pier") || n.includes("post")) {
          mat.specularColor = new Color3(0.08, 0.06, 0.04);
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

    // Contact shadow + elongated rake bar (Lighting craft on open sand)
    const sh = MeshBuilder.CreateBox(
      `sh-${b.id}`,
      { width: 2.5, height: 0.04, depth: 2.2 },
      scene
    );
    sh.position.y = 0.02;
    const sm = new StandardMaterial(`shm-${b.id}`, scene);
    sm.diffuseColor = Color3.Black();
    sm.alpha = 0.38;
    sm.disableLighting = true;
    sh.material = sm;
    sh.isPickable = false;
    sh.parent = root;
    // Long directional shadow tongue (sun from +X/−Z)
    const rake = MeshBuilder.CreateBox(
      `rake-${b.id}`,
      { width: 1.4, height: 0.03, depth: 3.4 },
      scene
    );
    rake.position.set(0.9, 0.015, 1.1);
    rake.rotation.y = 0.45;
    const rm = new StandardMaterial(`rakem-${b.id}`, scene);
    rm.diffuseColor = Color3.Black();
    rm.alpha = 0.28;
    rm.disableLighting = true;
    rake.material = rm;
    rake.isPickable = false;
    rake.parent = root;

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

  if (kind === "great_house") {
    // Cornice band
    const cornice = MeshBuilder.CreateBox(`dens-cornice-${id}`, { width: 2.5, height: 0.14, depth: 2.15 }, scene);
    cornice.position.y = 2.05;
    add(cornice, stone);
    // Buttress pillars front
    for (const x of [-0.95, 0.95]) {
      const pil = MeshBuilder.CreateBox(`dens-pil-${id}-${x}`, { width: 0.22, height: 1.7, depth: 0.22 }, scene);
      pil.position.set(x, 0.9, -0.95);
      add(pil, stone);
    }
    // Stepped plinth mass
    const plinth = MeshBuilder.CreateBox(`dens-plinth-${id}`, { width: 2.6, height: 0.22, depth: 2.3 }, scene);
    plinth.position.y = 0.11;
    add(plinth, mud);
    // Dark roof cap (never emissive)
    const roof = MeshBuilder.CreateBox(`dens-roofcap-${id}`, { width: 2.35, height: 0.28, depth: 2.0 }, scene);
    roof.position.y = 2.35;
    add(roof, darkRoof);
  } else if (kind === "market") {
    // Mudbrick stall mass under canopy
    for (const x of [-0.5, 0.5]) {
      const stall = MeshBuilder.CreateBox(`dens-stall-${id}-${x}`, { width: 0.85, height: 0.65, depth: 0.55 }, scene);
      stall.position.set(x, 0.35, 0.15);
      add(stall, mud);
    }
    // Cloth canopy non-emissive
    const awn = MeshBuilder.CreateBox(`dens-awn-${id}`, { width: 2.15, height: 0.1, depth: 1.7 }, scene);
    awn.position.y = 1.25;
    const awnMat = new StandardMaterial(`dens-awnm-${id}`, scene);
    awnMat.diffuseColor = new Color3(0.75, 0.55, 0.32);
    awnMat.specularColor = Color3.Black();
    add(awn, awnMat);
    // Posts
    for (const [x, z] of [
      [-0.85, -0.6],
      [0.85, -0.6],
      [-0.85, 0.6],
      [0.85, 0.6],
    ] as const) {
      const p = MeshBuilder.CreateCylinder(`dens-post-${id}-${x}${z}`, { height: 1.2, diameter: 0.14, tessellation: 6 }, scene);
      p.position.set(x, 0.6, z);
      add(p, wood);
    }
  } else if (kind === "harbor" || kind === "pier") {
    const deck = MeshBuilder.CreateBox(`dens-deck-${id}`, { width: 2.4, height: 0.12, depth: 1.6 }, scene);
    deck.position.y = 0.2;
    add(deck, wood);
  } else if (kind === "emmer_field" || kind === "marsh_reed_bed") {
    // Crop/reed bed mass so fields read as volume not flat disks
    for (let i = 0; i < 6; i++) {
      const row = MeshBuilder.CreateBox(
        `dens-crop-${id}-${i}`,
        { width: 0.55, height: 0.35 + (i % 2) * 0.1, depth: 0.35 },
        scene
      );
      row.position.set(-0.7 + (i % 3) * 0.55, 0.2, -0.4 + Math.floor(i / 3) * 0.55);
      const cm = new StandardMaterial(`dens-cropm-${id}-${i}`, scene);
      cm.diffuseColor = new Color3(0.35 + (i % 2) * 0.08, 0.5, 0.22);
      cm.emissiveColor = new Color3(0.05, 0.08, 0.02);
      cm.specularColor = Color3.Black();
      add(row, cm);
    }
  } else if (kind === "mudbrick_yard" || kind === "river_clay_pit") {
    const pile = MeshBuilder.CreateBox(`dens-pile-${id}`, { width: 1.4, height: 0.55, depth: 1.1 }, scene);
    pile.position.y = 0.3;
    add(pile, mud);
    const kiln = MeshBuilder.CreateCylinder(`dens-kiln-${id}`, { height: 0.7, diameter: 0.55, tessellation: 8 }, scene);
    kiln.position.set(0.5, 0.4, -0.3);
    add(kiln, mud);
  } else if (kind.includes("shop") || kind === "ration_house" || kind === "luxury_material") {
    const body = MeshBuilder.CreateBox(`dens-shop-${id}`, { width: 1.7, height: 1.1, depth: 1.4 }, scene);
    body.position.y = 0.55;
    add(body, mud);
    const roof = MeshBuilder.CreateBox(`dens-shoproof-${id}`, { width: 1.9, height: 0.18, depth: 1.55 }, scene);
    roof.position.y = 1.2;
    add(roof, darkRoof);
  }
}
