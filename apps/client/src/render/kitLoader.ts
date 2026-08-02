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
      if (
        name.includes("gold") ||
        name.includes("glow") ||
        name.includes("roof") ||
        name.includes("crest") ||
        name.includes("canopy") ||
        name.includes("kiln")
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

    // Contact shadow
    const sh = MeshBuilder.CreateBox(
      `sh-${b.id}`,
      { width: 2.5, height: 0.04, depth: 2.2 },
      scene
    );
    sh.position.y = 0.02;
    const sm = new StandardMaterial(`shm-${b.id}`, scene);
    sm.diffuseColor = Color3.Black();
    sm.alpha = 0.3;
    sm.disableLighting = true;
    sh.material = sm;
    sh.isPickable = false;
    sh.parent = root;

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

    return { root, hit, emissives, anim };
  }

  return createBuildingKit(scene, b);
}
