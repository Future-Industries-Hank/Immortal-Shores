/**
 * Empty-plot category markers — DIEGETIC site dressing, not UI glyphs.
 *
 * The previous version put an inked token on a plinth at the centre of every
 * plot; the training tint (#5A6B7A) was the only blue on the board and it
 * photographed as a HUD icon dropped into the village. Category is now carried
 * by SILHOUETTE, which is also what makes it readable without relying on hue:
 *   shop     — a delivery of mudbricks   (low, blocky, rectangular)
 *   special  — a coil of surveyor's rope (flat ring, nothing standing)
 *   training — three lashed timber poles (tall, thin, open triangle)
 * Every material stays inside the sand / mudbrick / timber / rope palette.
 */
import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
} from "@babylonjs/core";
import type { PlotCategory } from "@immortal/shared";
import { hexToColor3 } from "./colors.js";

/** Deterministic 0..1 hash so a quality rebuild reproduces the same dressing. */
function rnd(seed: number): number {
  const s = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Shared by name — buildFixedPads disposes the meshes, never the materials. */
function siteMat(scene: Scene, name: string, hex: string): StandardMaterial {
  const found = scene.getMaterialByName(name);
  if (found) return found as StandardMaterial;
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = hexToColor3(hex);
  m.specularColor = Color3.Black();
  return m;
}

/**
 * @param seed per-plot integer — no two plots may carry the same arrangement.
 * Returns the tallest piece (the caller tracks one mesh per plot); everything
 * is parented to `parent`, which the caller disposes/enables as a unit.
 */
export function createPadCategoryMarker(
  scene: Scene,
  parent: TransformNode,
  plotId: string,
  category: PlotCategory,
  seed = 0
): Mesh | null {
  if (category === "starter") return null;
  const parts: Mesh[] = [];
  const add = (m: Mesh, mat: StandardMaterial) => {
    m.material = mat;
    m.parent = parent;
    m.isPickable = false;
    m.receiveShadows = true;
    parts.push(m);
    return m;
  };
  const brick = siteMat(scene, "padMarkBrick", "#9C7A58");
  const brickDk = siteMat(scene, "padMarkBrickDk", "#87684A");
  const rope = siteMat(scene, "padMarkRope", "#C0A878");
  const timber = siteMat(scene, "padMarkTimber", "#6E5232");

  if (category === "shop") {
    // Mudbrick delivery: two courses laid square, a broken third on top.
    const layout: Array<[number, number, number, number]> = [
      // x, z, rotY, course
      [-0.17, 0, 0, 0],
      [0.0, 0.01, 0, 0],
      [0.17, -0.01, 0, 0],
      [0.0, -0.11, Math.PI / 2, 1],
      [0.0, 0.09, Math.PI / 2, 1],
      [-0.06, -0.02, 0.5, 2],
    ];
    layout.forEach(([bx, bz, ry, course], i) => {
      const b = MeshBuilder.CreateBox(
        `padMark-${plotId}-brick${i}`,
        { width: 0.19, height: 0.082, depth: 0.12 },
        scene
      );
      b.position.set(bx, 0.041 + course * 0.082, bz);
      b.rotation.y = ry + (rnd(seed * 7 + i) - 0.5) * 0.24;
      add(b, course === 1 ? brickDk : brick);
    });
    // a couple that slid off the stack
    for (let i = 0; i < 2; i++) {
      const b = MeshBuilder.CreateBox(
        `padMark-${plotId}-loose${i}`,
        { width: 0.185, height: 0.08, depth: 0.115 },
        scene
      );
      const a = rnd(seed * 5 + i * 3) * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.36, 0.03, Math.sin(a) * 0.3);
      b.rotation.y = a;
      b.rotation.z = (rnd(seed + i) - 0.5) * 0.3;
      add(b, brick);
    }
  } else if (category === "special") {
    // Coil of rope: two flat loops and a loose tail. Nothing stands up, so
    // the silhouette is a ring — unmistakable against a block or a tripod.
    for (const [dia, thick, y] of [
      [0.58, 0.09, 0.045],
      [0.38, 0.078, 0.043],
      [0.5, 0.072, 0.122],
    ] as const) {
      const t = MeshBuilder.CreateTorus(
        `padMark-${plotId}-coil${dia}`,
        { diameter: dia, thickness: thick, tessellation: 14 },
        scene
      );
      t.position.set(0, y, 0);
      t.rotation.y = rnd(seed + dia) * Math.PI;
      add(t, rope);
    }
    // tail running out of the coil toward the kerb
    const tail = MeshBuilder.CreateBox(
      `padMark-${plotId}-tail`,
      { width: 0.5, height: 0.042, depth: 0.055 },
      scene
    );
    const ta = rnd(seed * 3 + 1) * Math.PI * 2;
    tail.position.set(Math.cos(ta) * 0.38, 0.021, Math.sin(ta) * 0.38);
    tail.rotation.y = -ta;
    add(tail, rope);
  } else {
    // Training: three poles leaned into a tripod and lashed near the top.
    const H = 0.72;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + rnd(seed) * 1.2;
      const pole = MeshBuilder.CreateCylinder(
        `padMark-${plotId}-pole${i}`,
        { height: H, diameterBottom: 0.05, diameterTop: 0.036, tessellation: 6 },
        scene
      );
      const lean = 0.3 + rnd(seed * 11 + i) * 0.06;
      pole.rotation.z = Math.cos(a) * lean;
      pole.rotation.x = -Math.sin(a) * lean;
      pole.position.set(
        Math.cos(a) * (H / 2) * Math.sin(lean),
        H / 2 - 0.02,
        Math.sin(a) * (H / 2) * Math.sin(lean)
      );
      add(pole, timber);
    }
    const lash = MeshBuilder.CreateTorus(
      `padMark-${plotId}-lash`,
      { diameter: 0.12, thickness: 0.032, tessellation: 10 },
      scene
    );
    lash.position.set(0, H * 0.82, 0);
    add(lash, rope);
  }

  // Tallest piece is the handle the caller keeps; category rides on metadata
  // for any future a11y/tooltip read, never on a tint.
  let tallest = parts[0] ?? null;
  for (const m of parts) {
    if (m.position.y > (tallest?.position.y ?? -1)) tallest = m;
  }
  if (tallest) tallest.metadata = { padIcon: true, category };
  return tallest;
}
