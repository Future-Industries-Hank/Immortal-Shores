import { Color3 } from "@babylonjs/core";
import { STYLE } from "@immortal/shared";

export function hexToColor3(hex: string): Color3 {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return new Color3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Kind → primary massing color (must stay distinct in grayscale). */
export const KIND_COLOR: Record<string, string> = {
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

/** Empty-pad category colors (shape + color for a11y). */
export const PAD_CATEGORY = {
  shop: { fill: "#C4A574", icon: "hex", label: "Shop" },
  special: { fill: "#8B3A4A", icon: "diamond", label: "Special" },
  training: { fill: "#5A6B7A", icon: "triangle", label: "Training" },
  starter: { fill: STYLE.sandDeep, icon: "none", label: "Starter" },
} as const;
