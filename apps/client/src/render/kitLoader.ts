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
        // Bump when Blender re-exports solid kits (dev/prod cache bust)
        const KIT_VER = "overhaul-r15";
        const result = await SceneLoader.ImportMeshAsync(
          null,
          "/models/buildings/",
          `${file}.glb?v=${KIT_VER}`,
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
        // Park the template far underground AND disabled: some render
        // paths (reflection RTTs, shadow passes) have historically drawn
        // template pieces hovering at the origin ("gold in the sky").
        root.position = new Vector3(0, -60, 0);
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
      // COLOR_0 (baked AO) is RGBA — Babylon then flags hasVertexAlpha and
      // renders the mesh in the transparent pass, so terrain ghosts through.
      c.hasVertexAlpha = false;
      c.metadata = { buildingId: b.id, kind: b.kind, plotId: b.plotId };
      if (shadow) shadow.addShadowCaster(c, true);
      // Force SOLID materials — never transparent/wire stand-ins
      const mat = c.material as StandardMaterial | null;
      if (mat) {
        mat.wireframe = false;
        mat.alpha = 1;
        mat.transparencyMode = StandardMaterial.MATERIAL_OPAQUE;
        const n = c.name.toLowerCase();
        if (mat.diffuseColor) {
          if (n.includes("stone") || n.includes("gh_") || n.includes("obelisk") || n.includes("shrine") || n.includes("pale")) {
            mat.specularColor = new Color3(0.28, 0.26, 0.22);
            mat.specularPower = 36;
            mat.diffuseColor = Color3.Lerp(mat.diffuseColor, new Color3(0.82, 0.78, 0.7), 0.35);
          } else if (n.includes("mud") || n.includes("body") || n.includes("stall") || n.includes("brick") || n.includes("pile") || n.includes("yard")) {
            mat.specularColor = new Color3(0.04, 0.03, 0.02);
            mat.specularPower = 8;
            mat.diffuseColor = Color3.Lerp(mat.diffuseColor, new Color3(0.6, 0.44, 0.3), 0.3);
          } else if (n.includes("wood") || n.includes("deck") || n.includes("pier") || n.includes("post") || n.includes("crate")) {
            mat.specularColor = new Color3(0.1, 0.07, 0.04);
            mat.diffuseColor = Color3.Lerp(mat.diffuseColor, new Color3(0.42, 0.3, 0.18), 0.25);
          } else if (n.includes("crop") || n.includes("reed") || n.includes("field") || n.includes("plant") || n.includes("soil")) {
            mat.emissiveColor = new Color3(0.05, 0.07, 0.02);
            mat.diffuseColor = Color3.Lerp(mat.diffuseColor, new Color3(0.38, 0.52, 0.22), 0.3);
          } else if (n.includes("gold") || n.includes("lintel") || n.includes("win") || n.includes("glow")) {
            mat.emissiveColor = new Color3(0.2, 0.12, 0.04);
            mat.diffuseColor = Color3.Lerp(mat.diffuseColor, new Color3(0.85, 0.68, 0.28), 0.4);
          } else if (n.includes("roof") || n.includes("thatch") || n.includes("plank")) {
            // Roofs darker than walls: at board zoom the settlement was
            // merging into one brown mass with no structure separation.
            mat.diffuseColor = Color3.Lerp(mat.diffuseColor, new Color3(0.34, 0.25, 0.16), 0.3);
          } else if (n.includes("canopy") || n.includes("cloth") || n.includes("awn")) {
            mat.diffuseColor = Color3.Lerp(mat.diffuseColor, new Color3(0.55, 0.4, 0.25), 0.25);
          }
        }
      }
      // PBR/glTF materials: force opaque
      const anyMat = c.material as { alpha?: number; transparencyMode?: number; wireframe?: boolean } | null;
      if (anyMat) {
        if (typeof anyMat.alpha === "number") anyMat.alpha = 1;
        if ("wireframe" in anyMat) anyMat.wireframe = false;
      }
      const name = c.name.toLowerCase();
      // Plot trays: force ONE shared ground tone + flatten, so kits stop
      // reading as differently-beige tiles pasted onto the sand (cohesion).
      if (
        name.includes("apron") ||
        name.includes("earth_pack") ||
        name.includes("dirt_")
      ) {
        const am = c.material as StandardMaterial | null;
        if (am && am.diffuseColor) {
          // Match the desert almost exactly — a tray that reads as its own
          // rectangle is a "sticker" deduction every round.
          am.diffuseColor = new Color3(0.79, 0.71, 0.55);
          am.specularColor = Color3.Black();
        }
        c.scaling.y = 0.22;
      }
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

    // REAL solid glTF only — densify overlays are NOT finished art (GOAL-GRAPHICS-READY)
    // If kit is still boxy, re-author the .glb in Blender; do not stack grey slabs here.

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
  shadow?: ShadowGenerator | null,
  gltfAlreadyDense = false
) {
  // Light touch when Blender kit already carries multi-part mass
  const light = gltfAlreadyDense;
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
    // Artboard 01: gold lintel + windows always; full mass only if glTF thin
    if (!light) {
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
      for (const x of [-0.95, 0, 0.95]) {
        const pil = MeshBuilder.CreateBox(`dens-pil-${id}-${x}`, { width: 0.2, height: 1.6, depth: 0.2 }, scene);
        pil.position.set(x, 0.85, -1.0);
        add(pil, stone);
      }
      const roof = MeshBuilder.CreateBox(`dens-roofcap-${id}`, { width: 1.9, height: 0.22, depth: 1.65 }, scene);
      roof.position.y = 2.35;
      add(roof, darkRoof);
    }
    const lintel = MeshBuilder.CreateBox(`dens-lintel-${id}`, { width: 1.6, height: 0.1, depth: 0.14 }, scene);
    lintel.position.set(0, 1.15, -1.08);
    add(lintel, gold);
    for (let i = 0; i < 4; i++) {
      const win = MeshBuilder.CreateBox(`dens-win-${id}-${i}`, { width: 0.22, height: 0.32, depth: 0.06 }, scene);
      win.position.set(-0.6 + i * 0.4, 1.35, -1.08);
      add(win, gold);
    }
  } else if (kind === "market") {
    if (light) return; // glTF market already multi-part
    for (const x of [-0.55, 0.55]) {
      const stall = MeshBuilder.CreateBox(`dens-stall-${id}-${x}`, { width: 0.9, height: 0.7, depth: 0.6 }, scene);
      stall.position.set(x, 0.38, 0.2);
      add(stall, mud);
    }
    const awn = MeshBuilder.CreateBox(`dens-awn-${id}`, { width: 2.25, height: 0.1, depth: 1.75 }, scene);
    awn.position.y = 1.28;
    const awnMat = new StandardMaterial(`dens-awnm-${id}`, scene);
    awnMat.diffuseColor = new Color3(0.72, 0.5, 0.28);
    awnMat.specularColor = Color3.Black();
    add(awn, awnMat);
  } else if (kind === "harbor" || kind === "pier") {
    if (light) return;
    const deck = MeshBuilder.CreateBox(`dens-deck-${id}`, { width: 2.6, height: 0.14, depth: 1.8 }, scene);
    deck.position.y = 0.18;
    add(deck, wood);
  } else if (kind === "emmer_field" || kind === "marsh_reed_bed") {
    if (light) return;
    for (let i = 0; i < 6; i++) {
      const row = MeshBuilder.CreateBox(
        `dens-crop-${id}-${i}`,
        { width: 0.5, height: 0.32 + (i % 3) * 0.08, depth: 0.32 },
        scene
      );
      row.position.set(-0.7 + (i % 3) * 0.55, 0.22, -0.55 + Math.floor(i / 3) * 0.5);
      const cm = new StandardMaterial(`dens-cropm-${id}-${i}`, scene);
      cm.diffuseColor = new Color3(0.42, 0.52, 0.2);
      cm.specularColor = Color3.Black();
      add(row, cm);
    }
  } else if (kind === "mudbrick_yard" || kind === "river_clay_pit") {
    if (light) return;
    const pile = MeshBuilder.CreateBox(`dens-pile-${id}`, { width: 1.3, height: 0.65, depth: 1.0 }, scene);
    pile.position.set(-0.35, 0.38, 0.1);
    add(pile, mud);
  } else if (kind === "shrine") {
    if (light) return;
    const body = MeshBuilder.CreateBox(`dens-shbody-${id}`, { width: 1.2, height: 1.5, depth: 1.15 }, scene);
    body.position.y = 0.95;
    add(body, pale);
  } else if (kind === "training_grounds") {
    // Keep light training marks only
    for (const x of [-0.7, 0.7]) {
      const post = MeshBuilder.CreateCylinder(`dens-tpost-${id}-${x}`, { height: 0.9, diameter: 0.1, tessellation: 6 }, scene);
      post.position.set(x, 0.45, -0.5);
      add(post, wood);
    }
  } else if (kind.includes("shop") || kind === "ration_house" || kind === "luxury_material" || kind === "luxury_workshop" || kind === "warehouse") {
    if (light && (kind === "ration_house")) return;
    const body = MeshBuilder.CreateBox(`dens-shop-${id}`, { width: 1.75, height: 1.15, depth: 1.45 }, scene);
    body.position.y = 0.58;
    add(body, mud);
    const roof = MeshBuilder.CreateBox(`dens-shoproof-${id}`, { width: 1.95, height: 0.16, depth: 1.6 }, scene);
    roof.position.y = 1.25;
    add(roof, darkRoof);
  }
}
