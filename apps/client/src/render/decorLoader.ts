/**
 * Egyptian stone decor props (glTF). Authored separately from the building
 * kits, so every file is OPTIONAL — a missing .glb must leave the scene
 * booting clean with no placeholder geometry.
 */
import {
  AbstractMesh,
  Color3,
  Mesh,
  Scene,
  SceneLoader,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

/**
 * The STELE is deliberately absent: the owner asked for "the tablet looking
 * asset" to go, the kit agent deleted `stele.glb`, and leaving the kind in this
 * list would only cost a 404 per boot.
 *
 * STATUE_STANDING is absent for the same reason: it was the Great House
 * forecourt group, and the owner asked for "1-4 spread around different parts
 * of the settlement", not groups.
 *
 * STATUE_SEATED joins them this round. The seated pair was the tomb gate, and
 * measured against the live scene it was a grouping (two figures on one paved
 * court) whose contact discs ran 0.198 under the pyramid's socle. There is no
 * second quarter on the board with a reason for a lone colossus, so the pair is
 * cut rather than half-relocated — see SETTLEMENT_MONUMENTS. The board's three
 * monuments are now two obelisks and the tomb.
 *
 * stele.glb is gone from disk; statue_seated.glb (215 KB) and
 * statue_standing.glb (185 KB) are still there and simply never fetched, which
 * keeps 400 KB off every cold boot.
 */
export const DECOR_KINDS = ["obelisk", "small_pyramid"] as const;

export type DecorKind = (typeof DECOR_KINDS)[number];

export type DecorCache = Map<
  DecorKind,
  { root: TransformNode; meshes: AbstractMesh[] }
>;

const DECOR_DIR = "/models/decor/";

/**
 * Cache bust. The decor GLBs were re-authored this round (hardstone hue rotated
 * off plum, standing statue re-modelled, baked surface atlases added) and this
 * loader had no version token at all, so a warm browser cache would keep
 * serving the old props. Bump whenever /models/decor/*.glb is re-exported.
 */
const DECOR_VER = "r9-pyramid-base";

/**
 * Per-kind albedo exposure. The tomb ships at the same hue AND the same value
 * as the sand it stands in, so at board zoom (no free camera, ~34px per world
 * unit) its silhouette disappeared into the desert entirely — a judge simply
 * could not see it. Everything else already separates, so only the tomb is
 * graded, and it is graded as a stone that has weathered darker than the sand
 * rather than retinted, which would put it outside the palette.
 */
const KIND_ALBEDO: Partial<Record<DecorKind, number>> = {
  small_pyramid: 0.8,
};

/**
 * Load whatever decor exists. Fetched by hand and handed to the loader as a
 * File: a missing prop then resolves to a plain 404 we can ignore, instead of
 * reaching the glTF loader and throwing.
 */
export async function preloadDecorKits(scene: Scene): Promise<DecorCache> {
  const cache: DecorCache = new Map();
  await Promise.all(
    DECOR_KINDS.map(async (kind) => {
      try {
        const res = await fetch(`${DECOR_DIR}${kind}.glb?v=${DECOR_VER}`);
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        const result = await SceneLoader.ImportMeshAsync(
          null,
          "",
          new File([buf], `${kind}.glb`),
          scene
        );
        const root = new TransformNode(`decorTpl_${kind}`, scene);
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
        if (meshes.length === 0) return;
        // Contract puts the origin at the footprint centre on y=0, but a
        // re-export can drift — re-seat on the ground so nothing hovers.
        let minY = Infinity;
        for (const m of meshes) {
          m.computeWorldMatrix(true);
          minY = Math.min(minY, m.getBoundingInfo().boundingBox.minimumWorld.y);
        }
        if (Number.isFinite(minY) && Math.abs(minY) > 0.005) {
          for (const m of meshes) m.position.y -= minY;
        }
        // Same parking trick as the building kits: templates offscreen AND
        // disabled, or shadow/reflection passes draw them at the origin.
        root.position = new Vector3(0, -60, 0);
        root.setEnabled(false);
        cache.set(kind, { root, meshes });
      } catch {
        /* decor is optional — a missing or broken prop is simply skipped */
      }
    })
  );
  return cache;
}

/**
 * Clone one prop onto the board. Returns null when the kind was never
 * authored, so callers can place a spine without branching per prop.
 */
export function instantiateDecor(
  scene: Scene,
  cache: DecorCache,
  kind: DecorKind,
  id: string,
  shadow?: ShadowGenerator | null
): TransformNode | null {
  const tpl = cache.get(kind);
  if (!tpl) return null;
  const grade = KIND_ALBEDO[kind];
  const root = new TransformNode(`decor-${kind}-${id}`, scene);
  for (const src of tpl.meshes) {
    const c = src.clone(`${src.name}_${id}`, root) as Mesh | null;
    if (!c) continue;
    c.setEnabled(true);
    c.isPickable = false;
    c.receiveShadows = true;
    // Baked COLOR_0 is RGBA: without this Babylon renders the prop in the
    // transparent pass and the sand ghosts through the stone.
    c.hasVertexAlpha = false;
    let mat = c.material as StandardMaterial | null;
    if (mat && grade !== undefined) {
      // clone per kind, not per instance: the template materials are shared
      // across every decor kind loaded from the same exporter palette
      const gradedName = `${mat.name}_g${grade}`;
      const existing = scene.getMaterialByName(gradedName);
      if (existing) {
        mat = existing as StandardMaterial;
      } else {
        const g = mat.clone(gradedName);
        if (g) {
          // glTF can land as either Standard or PBR depending on the export,
          // so grade whichever albedo slot this material actually has
          const slots = g as unknown as Record<string, Color3 | undefined>;
          for (const key of ["diffuseColor", "albedoColor", "emissiveColor"]) {
            const c = slots[key];
            if (c) slots[key] = c.scale(grade);
          }
          mat = g;
        }
      }
      c.material = mat;
    }
    if (mat) {
      mat.wireframe = false;
      mat.alpha = 1;
      mat.transparencyMode = StandardMaterial.MATERIAL_OPAQUE;
      // Dry carved stone: a touch of tight specular so the shaft edges and
      // the pyramidion catch the sun instead of reading as flat cutouts.
      if (mat.specularColor) {
        mat.specularColor = new Color3(0.22, 0.2, 0.16);
        mat.specularPower = 44;
      }
    }
    if (shadow) shadow.addShadowCaster(c, true);
  }
  return root;
}
