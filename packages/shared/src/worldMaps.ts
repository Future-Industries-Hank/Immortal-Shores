/**
 * Multiplayer world readiness: map archetypes + balanced founding assignment.
 * Every new player/settlement gets a distinct mix of province + luxury + map look.
 */
import type { LuxuryMaterial, ResourceId } from "./types.js";
import { LUXURY_MATERIALS, PROVINCES } from "./rates.js";

export type MapArchetypeId =
  | "delta_mouth"
  | "reed_bend"
  | "clay_banks"
  | "midstream"
  | "gold_reach"
  | "upper_cataract";

export interface MapArchetype {
  id: MapArchetypeId;
  name: string;
  /** Preferred province id (matches PROVINCES) */
  provinceId: string;
  /** Flavor — shown in UI */
  blurb: string;
  /** Ground / river presentation */
  palette: {
    sand: string;
    sandDeep: string;
    river: string;
    riverLight: string;
    bank: string;
  };
  /** Layout transforms applied to base SETTLEMENT_PLOTS */
  layout: {
    /** Mirror plot Z around civic center */
    mirrorZ?: boolean;
    /** Shift all plots (world) */
    offsetX?: number;
    offsetZ?: number;
    /** Harbor pier length into river (visual) */
    pierLength?: number;
  };
  /** Luxuries that "belong" to this biome for balanced seeding (not exclusive) */
  nativeLuxuries: LuxuryMaterial[];
}

/** One archetype per province — ready for multiplayer launch. */
export const MAP_ARCHETYPES: MapArchetype[] = [
  {
    id: "delta_mouth",
    name: "Delta Mouth",
    provinceId: "delta",
    blurb: "Wide muddy mouths and fertile fans. Hides and ochre caravans start here.",
    palette: {
      sand: "#E8D4B0",
      sandDeep: "#C4A574",
      river: "#1E4D6B",
      riverLight: "#3A7CA5",
      bank: "#B8956A",
    },
    layout: { pierLength: 3.2 },
    nativeLuxuries: ["hides", "red_ochre"],
  },
  {
    id: "reed_bend",
    name: "Reed Bend",
    provinceId: "reed_bend",
    blurb: "Deep reed marshes and mirror water. Eye Paint and Sacred Oil traders throng the Wall.",
    palette: {
      sand: "#D8CFA8",
      sandDeep: "#A8B070",
      river: "#1A5A5A",
      riverLight: "#3A9A8A",
      bank: "#6B8F5A",
    },
    layout: { mirrorZ: true, pierLength: 2.8 },
    nativeLuxuries: ["eye_paint", "sacred_oil"],
  },
  {
    id: "clay_banks",
    name: "Clay Banks",
    provinceId: "clay_banks",
    blurb: "Red clay cliffs above the current. Bronze and stone-idol traffic.",
    palette: {
      sand: "#E0B898",
      sandDeep: "#B87850",
      river: "#1E4060",
      riverLight: "#4A7A9A",
      bank: "#C07050",
    },
    layout: { offsetZ: 0.8, pierLength: 3.0 },
    nativeLuxuries: ["bronze", "green_stones"],
  },
  {
    id: "midstream",
    name: "Midstream",
    provinceId: "midstream",
    blurb: "Broad working river. Cedarwood barges and perfume for the capital road.",
    palette: {
      sand: "#E8D8B8",
      sandDeep: "#C0A878",
      river: "#1A4870",
      riverLight: "#3A80B0",
      bank: "#A89070",
    },
    layout: { offsetX: 0.4, pierLength: 3.5 },
    nativeLuxuries: ["cedarwood", "sacred_oil"],
  },
  {
    id: "gold_reach",
    name: "Gold Reach",
    provinceId: "gold_reach",
    blurb: "Pale dunes and gold dust on the wind. Royal Gold and amulet markets.",
    palette: {
      sand: "#F0E0B8",
      sandDeep: "#D4B878",
      river: "#245070",
      riverLight: "#5A9ABC",
      bank: "#D4C090",
    },
    layout: { mirrorZ: true, offsetX: -0.3, pierLength: 2.6 },
    nativeLuxuries: ["royal_gold", "green_stones"],
  },
  {
    id: "upper_cataract",
    name: "Upper Cataract",
    provinceId: "upper_cataract",
    blurb: "Rocky cataracts and sparse scrub. Hard bargains in bronze and hides.",
    palette: {
      sand: "#D8C8A8",
      sandDeep: "#A09070",
      river: "#163850",
      riverLight: "#2A6080",
      bank: "#807060",
    },
    layout: { offsetZ: -0.6, pierLength: 2.4 },
    nativeLuxuries: ["bronze", "hides"],
  },
];

export function getMapArchetype(id: string): MapArchetype {
  return MAP_ARCHETYPES.find((m) => m.id === id) ?? MAP_ARCHETYPES[0]!;
}

export function archetypeForProvince(provinceId: string): MapArchetype {
  return (
    MAP_ARCHETYPES.find((m) => m.provinceId === provinceId) ?? MAP_ARCHETYPES[0]!
  );
}

/** Count how many settlements already use each luxury. */
export function countLuxuries(
  settlements: { uniqueLuxury: LuxuryMaterial }[]
): Record<LuxuryMaterial, number> {
  const counts = Object.fromEntries(
    LUXURY_MATERIALS.map((l) => [l, 0])
  ) as Record<LuxuryMaterial, number>;
  for (const s of settlements) {
    counts[s.uniqueLuxury] = (counts[s.uniqueLuxury] ?? 0) + 1;
  }
  return counts;
}

export function countProvinces(
  settlements: { provinceId: string }[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of PROVINCES) counts[p.id] = 0;
  for (const s of settlements) {
    counts[s.provinceId] = (counts[s.provinceId] ?? 0) + 1;
  }
  return counts;
}

/**
 * Pick province + map archetype + unique luxury for a new settlement.
 * Prefers least-populated provinces and least-used luxuries so multiplayer
 * trade is viable from day one (not eight players all on Hides).
 */
export function assignFoundingSlot(input: {
  existingSettlements: { provinceId: string; uniqueLuxury: LuxuryMaterial }[];
  /** Optional: force province (e.g. founding site claim) */
  preferredProvinceId?: string;
  rng?: () => number;
}): {
  provinceId: string;
  mapArchetypeId: MapArchetypeId;
  uniqueLuxury: LuxuryMaterial;
  mapX: number;
  mapY: number;
} {
  const rng = input.rng ?? Math.random;
  const provCounts = countProvinces(input.existingSettlements);
  const luxCounts = countLuxuries(input.existingSettlements);

  let provinceId = input.preferredProvinceId;
  if (!provinceId || !PROVINCES.some((p) => p.id === provinceId)) {
    // Least populated provinces; break ties randomly
    const min = Math.min(...Object.values(provCounts));
    const candidates = PROVINCES.filter((p) => provCounts[p.id] === min);
    provinceId = candidates[Math.floor(rng() * candidates.length)]!.id;
  }

  const arch = archetypeForProvince(provinceId);

  // Prefer underrepresented luxuries; slight bias to native set
  const scored = LUXURY_MATERIALS.map((lux) => {
    const used = luxCounts[lux] ?? 0;
    const native = arch.nativeLuxuries.includes(lux) ? -0.35 : 0;
    return { lux, score: used + native + rng() * 0.1 };
  }).sort((a, b) => a.score - b.score);

  const uniqueLuxury = scored[0]!.lux;
  const riverIndex =
    PROVINCES.find((p) => p.id === provinceId)?.riverIndex ?? 0;
  // Scatter founding positions within province band
  const mapX = riverIndex * 120 + 20 + Math.floor(rng() * 50);
  const mapY = 30 + Math.floor(rng() * 60);

  return {
    provinceId,
    mapArchetypeId: arch.id,
    uniqueLuxury,
    mapX,
    mapY,
  };
}

/** Province catalog for UI (includes archetype id). */
export function provinceCatalog(): {
  id: string;
  name: string;
  riverIndex: number;
  patronGood: ResourceId;
  mapArchetypeId: MapArchetypeId;
  blurb: string;
}[] {
  return PROVINCES.map((p) => {
    const a = archetypeForProvince(p.id);
    return {
      id: p.id,
      name: p.name,
      riverIndex: p.riverIndex,
      patronGood: p.patronGood,
      mapArchetypeId: a.id,
      blurb: a.blurb,
    };
  });
}
