/**
 * Empty-plot category markers — carved-stone tokens (shape + color, a11y).
 * Shop = hex tablet, Special = diamond cartouche, Training = triangle stele.
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

  // Sandstone plinth under an inked glyph — a carved token, not a candy gem
  const baseMat = new StandardMaterial(`padTokenBase-${plotId}`, scene);
  baseMat.diffuseColor = hexToColor3("#A89275");
  baseMat.specularColor = Color3.Black();
  const base = MeshBuilder.CreateCylinder(
    `padTokenBase-${plotId}`,
    { diameter: 0.62, height: 0.07, tessellation: 8 },
    scene
  );
  base.position = new Vector3(0, 0.21, 0);
  base.material = baseMat;
  base.parent = parent;
  base.isPickable = false;

  const mat = new StandardMaterial(`padIconMat-${plotId}`, scene);
  // Soft ink glyph — reads by shape first, tint second
  mat.diffuseColor = hexToColor3(cfg.fill).scale(0.5);
  mat.emissiveColor = hexToColor3(cfg.fill).scale(0.05);
  mat.specularColor = Color3.Black();

  let mesh: Mesh;
  if (cfg.icon === "hex") {
    mesh = MeshBuilder.CreateCylinder(
      `padIcon-${plotId}`,
      { diameter: 0.46, height: 0.06, tessellation: 6 },
      scene
    );
  } else if (cfg.icon === "diamond") {
    mesh = MeshBuilder.CreateBox(
      `padIcon-${plotId}`,
      { width: 0.34, height: 0.06, depth: 0.34 },
      scene
    );
    mesh.rotation.y = Math.PI / 4;
  } else {
    // Training: true triangle stele (3-sided cylinder reads as a wedge)
    mesh = MeshBuilder.CreateCylinder(
      `padIcon-${plotId}`,
      { diameter: 0.44, height: 0.06, tessellation: 3 },
      scene
    );
  }
  mesh.position = new Vector3(0, 0.27, 0);
  mesh.material = mat;
  mesh.parent = parent;
  mesh.isPickable = false;
  mesh.metadata = { padIcon: true, category };
  return mesh;
}
