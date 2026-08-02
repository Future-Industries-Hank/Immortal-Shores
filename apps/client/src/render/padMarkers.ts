/**
 * Empty-plot category markers — shape + color (not color-only) for a11y.
 * Shop = hex, Special = diamond, Training = triangle.
 */
import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import type { PlotCategory } from "@immortal/shared";
import { hexToColor3, PAD_CATEGORY } from "./colors.js";

export function createPadCategoryMarker(
  scene: Scene,
  parent: TransformNode,
  plotId: string,
  category: PlotCategory
): Mesh | null {
  if (category === "starter") return null;
  const cfg = PAD_CATEGORY[category as keyof typeof PAD_CATEGORY];
  if (!cfg || cfg.icon === "none") return null;

  const mat = new StandardMaterial(`padIconMat-${plotId}`, scene);
  // Soft ink markers — not neon candy gems
  mat.diffuseColor = hexToColor3(cfg.fill).scale(0.55);
  mat.emissiveColor = hexToColor3(cfg.fill).scale(0.06);
  mat.specularColor = Color3.Black();
  mat.alpha = 0.85;

  let mesh: Mesh;
  if (cfg.icon === "hex") {
    mesh = MeshBuilder.CreateCylinder(
      `padIcon-${plotId}`,
      { diameter: 0.55, height: 0.08, tessellation: 6 },
      scene
    );
  } else if (cfg.icon === "diamond") {
    mesh = MeshBuilder.CreateBox(
      `padIcon-${plotId}`,
      { width: 0.42, height: 0.08, depth: 0.42 },
      scene
    );
    mesh.rotation.y = Math.PI / 4;
  } else {
    // Training: small wedge (box diamond-ish), avoid degenerate cone artifacts
    mesh = MeshBuilder.CreateBox(
      `padIcon-${plotId}`,
      { width: 0.5, height: 0.08, depth: 0.35 },
      scene
    );
    mesh.rotation.y = Math.PI / 6;
  }
  mesh.position = new Vector3(0, 0.28, 0);
  mesh.material = mat;
  mesh.parent = parent;
  mesh.isPickable = false;
  mesh.metadata = { padIcon: true, category };
  return mesh;
}
