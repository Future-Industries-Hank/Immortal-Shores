/**
 * High-contrast isometric building kit.
 * Distinct silhouettes per kind; mudbrick / stone / crop materials stay
 * separable in grayscale. No economy data — pure presentation.
 */
import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  type AbstractMesh,
} from "@babylonjs/core";
import { STYLE, type BuildingState } from "@immortal/shared";
import { hexToColor3, KIND_COLOR } from "./colors.js";

export type BuildingMeshes = {
  root: TransformNode;
  /** Primary pick target mesh */
  hit: Mesh;
  /** Soft emissive parts (night / kiln) */
  emissives: Mesh[];
  /** Workshop motion (smoke, wheel) */
  anim: { mesh: Mesh; kind: "spin" | "bob" | "pulse" }[];
};

function mat(
  scene: Scene,
  name: string,
  hex: string,
  opts: { specular?: number; emissive?: number; alpha?: number } = {}
): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = hexToColor3(hex);
  const s = opts.specular ?? 0.05;
  m.specularColor = new Color3(s, s, s * 0.9);
  if (opts.emissive) {
    m.emissiveColor = hexToColor3(hex).scale(opts.emissive);
  }
  if (opts.alpha != null) m.alpha = opts.alpha;
  return m;
}

function shadowBlob(
  scene: Scene,
  parent: TransformNode,
  name: string,
  diameter: number
): Mesh {
  // Thin box (not disc) — discs can silhouette badly in ortho iso
  const shadow = MeshBuilder.CreateBox(
    name,
    { width: diameter, height: 0.04, depth: diameter * 0.85 },
    scene
  );
  shadow.position.y = 0.025;
  const sm = new StandardMaterial(`${name}-mat`, scene);
  sm.diffuseColor = Color3.Black();
  sm.specularColor = Color3.Black();
  sm.emissiveColor = Color3.Black();
  sm.alpha = 0.22;
  sm.disableLighting = true;
  shadow.material = sm;
  shadow.parent = parent;
  shadow.isPickable = false;
  return shadow;
}

function box(
  scene: Scene,
  name: string,
  w: number,
  h: number,
  d: number,
  parent: TransformNode,
  material: StandardMaterial,
  y = 0
): Mesh {
  const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
  m.position.y = y + h / 2;
  m.material = material;
  m.parent = parent;
  m.isPickable = false;
  return m;
}

function cyl(
  scene: Scene,
  name: string,
  diameter: number,
  height: number,
  parent: TransformNode,
  material: StandardMaterial,
  y = 0,
  tess = 10
): Mesh {
  const m = MeshBuilder.CreateCylinder(
    name,
    { diameter, height, tessellation: tess },
    scene
  );
  m.position.y = y + height / 2;
  m.material = material;
  m.parent = parent;
  m.isPickable = false;
  return m;
}

function makeHit(
  scene: Scene,
  id: string,
  parent: TransformNode,
  b: BuildingState,
  h: number,
  size = 2.6
): Mesh {
  const hit = MeshBuilder.CreateBox(
    `hit-${id}`,
    { width: size, height: Math.max(h + 0.8, 1.8), depth: size },
    scene
  );
  hit.position.y = Math.max(h + 0.8, 1.8) / 2;
  hit.visibility = 0;
  hit.isPickable = true;
  hit.metadata = { buildingId: b.id, kind: b.kind, plotId: b.plotId };
  hit.parent = parent;
  return hit;
}

function baseMass(
  scene: Scene,
  parent: TransformNode,
  b: BuildingState,
  h: number,
  w: number,
  color: string
): { mass: Mesh; mat: StandardMaterial } {
  const m = mat(scene, `mass-${b.id}`, color, {
    specular: color === STYLE.stonePale ? 0.18 : 0.06,
  });
  const mass = box(scene, `mesh-${b.id}`, w, h, w * 0.88, parent, m, 0.06);
  mass.isPickable = true;
  mass.metadata = { buildingId: b.id, kind: b.kind, plotId: b.plotId };
  return { mass, mat: m };
}

export function createBuildingKit(scene: Scene, b: BuildingState): BuildingMeshes {
  const root = new TransformNode(`b-${b.id}`, scene);
  const color = KIND_COLOR[b.kind] ?? STYLE.mudbrick;
  const emissives: Mesh[] = [];
  const anim: BuildingMeshes["anim"] = [];
  const level = Math.max(1, b.level);

  shadowBlob(scene, root, `sh-${b.id}`, b.kind === "great_house" ? 3.2 : 2.4);

  switch (b.kind) {
    case "great_house": {
      const h = 2.2 + level * 0.12;
      const { mass } = baseMass(scene, root, b, h, 2.1, STYLE.stonePale);
      // Stepped upper tier
      const upper = box(
        scene,
        `gh-u-${b.id}`,
        1.55,
        0.7 + level * 0.04,
        1.4,
        root,
        mat(scene, `gh-um-${b.id}`, STYLE.stonePale, { specular: 0.2 }),
        h + 0.06
      );
      const roof = box(
        scene,
        `roof-${b.id}`,
        2.35,
        0.32,
        2.0,
        root,
        mat(scene, `roofm-${b.id}`, STYLE.goldSoft, { emissive: 0.12, specular: 0.25 }),
        h + 0.7
      );
      emissives.push(roof);
      // Columns
      const colMat = mat(scene, `col-${b.id}`, STYLE.stonePale, { specular: 0.22 });
      for (const [x, z] of [
        [-0.85, -0.7],
        [0.85, -0.7],
        [-0.85, 0.7],
        [0.85, 0.7],
      ] as const) {
        const c = cyl(scene, `col-${b.id}-${x}`, 0.16, h * 0.55, root, colMat, 0.08, 8);
        c.position.x = x;
        c.position.z = z;
      }
      // Entry plinth
      box(
        scene,
        `plinth-${b.id}`,
        1.0,
        0.18,
        0.55,
        root,
        mat(scene, `pl-${b.id}`, STYLE.sandDeep),
        0.06
      ).position.z = -1.05;
      const hit = makeHit(scene, b.id, root, b, h + 1.2, 3.0);
      mass.metadata = hit.metadata;
      return { root, hit, emissives, anim };
    }

    case "market": {
      // Open canopy on posts
      const post = mat(scene, `mp-${b.id}`, STYLE.sandDeep);
      for (const [x, z] of [
        [-0.7, -0.55],
        [0.7, -0.55],
        [-0.7, 0.55],
        [0.7, 0.55],
      ] as const) {
        const p = cyl(scene, `post-${b.id}-${x}${z}`, 0.12, 1.15, root, post, 0.05, 6);
        p.position.x = x;
        p.position.z = z;
      }
      const canopy = box(
        scene,
        `canopy-${b.id}`,
        2.0,
        0.12,
        1.6,
        root,
        mat(scene, `can-${b.id}`, STYLE.goldSoft, { emissive: 0.08 }),
        1.2
      );
      emissives.push(canopy);
      // Stalls
      const stall = mat(scene, `st-${b.id}`, STYLE.mudbrick);
      box(scene, `stall1-${b.id}`, 0.7, 0.55, 0.45, root, stall, 0.05).position.x = -0.45;
      box(scene, `stall2-${b.id}`, 0.7, 0.55, 0.45, root, stall, 0.05).position.x = 0.45;
      const hit = makeHit(scene, b.id, root, b, 1.6, 2.5);
      return { root, hit, emissives, anim };
    }

    case "emmer_field": {
      const soil = mat(scene, `soil-${b.id}`, "#8B7340");
      box(scene, `soilb-${b.id}`, 2.2, 0.12, 2.0, root, soil, 0.02);
      const crop = mat(scene, `crop-${b.id}`, STYLE.fieldGreen, { emissive: 0.04 });
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 3; j++) {
          const row = box(
            scene,
            `crop-${b.id}-${i}${j}`,
            0.35,
            0.35 + (i % 2) * 0.08,
            0.28,
            root,
            crop,
            0.12
          );
          row.position.x = -0.75 + i * 0.5;
          row.position.z = -0.55 + j * 0.5;
        }
      }
      const hit = makeHit(scene, b.id, root, b, 0.7, 2.5);
      return { root, hit, emissives, anim };
    }

    case "marsh_reed_bed": {
      const water = mat(scene, `mw-${b.id}`, STYLE.riverLight, { alpha: 0.65, specular: 0.3 });
      box(scene, `marsh-${b.id}`, 2.1, 0.1, 1.9, root, water, 0.02);
      const reed = mat(scene, `reed-${b.id}`, STYLE.reedGreen);
      for (let i = 0; i < 12; i++) {
        const r = cyl(
          scene,
          `reed-${b.id}-${i}`,
          0.06,
          0.7 + (i % 3) * 0.15,
          root,
          reed,
          0.08,
          5
        );
        r.position.x = ((i % 4) - 1.5) * 0.4;
        r.position.z = (Math.floor(i / 4) - 1) * 0.45;
        anim.push({ mesh: r, kind: "bob" });
      }
      const hit = makeHit(scene, b.id, root, b, 1.0, 2.5);
      return { root, hit, emissives, anim };
    }

    case "river_clay_pit": {
      const pit = mat(scene, `pit-${b.id}`, "#8A5A3A");
      const bowl = MeshBuilder.CreateCylinder(
        `pitb-${b.id}`,
        { diameterTop: 1.9, diameterBottom: 1.2, height: 0.45, tessellation: 12 },
        scene
      );
      bowl.position.y = 0.18;
      bowl.material = pit;
      bowl.parent = root;
      bowl.isPickable = false;
      const mound = mat(scene, `mound-${b.id}`, STYLE.mudbrick);
      box(scene, `m1-${b.id}`, 0.55, 0.35, 0.45, root, mound, 0.05).position.set(0.75, 0, 0.5);
      box(scene, `m2-${b.id}`, 0.45, 0.28, 0.4, root, mound, 0.05).position.set(-0.7, 0, -0.4);
      const hit = makeHit(scene, b.id, root, b, 0.8, 2.5);
      return { root, hit, emissives, anim };
    }

    case "mudbrick_yard": {
      const { mass } = baseMass(scene, root, b, 1.1, 1.5, STYLE.mudbrick);
      // Kiln chimney
      const kiln = cyl(
        scene,
        `kiln-${b.id}`,
        0.45,
        1.4,
        root,
        mat(scene, `kilnm-${b.id}`, "#7A4A32", { emissive: 0.15 }),
        0.08,
        8
      );
      kiln.position.x = 0.55;
      emissives.push(kiln);
      const glow = cyl(
        scene,
        `kiln-glow-${b.id}`,
        0.28,
        0.2,
        root,
        mat(scene, `kg-${b.id}`, "#E07030", { emissive: 0.55 }),
        1.25,
        6
      );
      glow.position.x = 0.55;
      emissives.push(glow);
      anim.push({ mesh: glow, kind: "pulse" });
      // Brick stacks
      const brick = mat(scene, `br-${b.id}`, STYLE.mudbrick);
      box(scene, `br1-${b.id}`, 0.5, 0.4, 0.35, root, brick, 0.05).position.set(-0.55, 0, 0.4);
      box(scene, `br2-${b.id}`, 0.45, 0.3, 0.35, root, brick, 0.05).position.set(-0.55, 0, -0.35);
      // Smoke puff
      const smoke = MeshBuilder.CreateSphere(`smoke-${b.id}`, { diameter: 0.35 }, scene);
      smoke.position.set(0.55, 1.7, 0);
      const sm = mat(scene, `sm-${b.id}`, "#C8C0B0", { alpha: 0.35 });
      smoke.material = sm;
      smoke.parent = root;
      smoke.isPickable = false;
      anim.push({ mesh: smoke, kind: "bob" });
      mass.isPickable = true;
      mass.metadata = { buildingId: b.id, kind: b.kind, plotId: b.plotId };
      const hit = makeHit(scene, b.id, root, b, 1.8, 2.5);
      return { root, hit, emissives, anim };
    }

    case "ration_house": {
      const { mass } = baseMass(scene, root, b, 1.35, 1.7, STYLE.sandDeep);
      const roof = box(
        scene,
        `rh-roof-${b.id}`,
        1.9,
        0.22,
        1.55,
        root,
        mat(scene, `rhr-${b.id}`, STYLE.mudbrick),
        1.4
      );
      // Grain sacks
      const sack = mat(scene, `sack-${b.id}`, STYLE.papyrus);
      for (let i = 0; i < 3; i++) {
        const s = cyl(scene, `sack-${b.id}-${i}`, 0.28, 0.35, root, sack, 0.06, 8);
        s.position.set(-0.5 + i * 0.45, 0, 0.75);
      }
      void roof;
      mass.isPickable = true;
      mass.metadata = { buildingId: b.id, kind: b.kind, plotId: b.plotId };
      const hit = makeHit(scene, b.id, root, b, 1.8, 2.5);
      return { root, hit, emissives, anim };
    }

    case "vessel_shop": {
      const base = mat(scene, `vs-${b.id}`, STYLE.riverLight, { specular: 0.15 });
      box(scene, `vsb-${b.id}`, 1.5, 1.0, 1.35, root, base, 0.06);
      // Pottery
      for (let i = 0; i < 4; i++) {
        const pot = cyl(
          scene,
          `pot-${b.id}-${i}`,
          0.22 + (i % 2) * 0.06,
          0.4,
          root,
          mat(scene, `potm-${b.id}-${i}`, i % 2 ? STYLE.mudbrick : STYLE.stonePale, {
            specular: 0.2,
          }),
          1.05,
          8
        );
        pot.position.x = -0.45 + i * 0.3;
        pot.position.z = 0.35;
      }
      const wheel = cyl(
        scene,
        `wheel-${b.id}`,
        0.5,
        0.08,
        root,
        mat(scene, `wh-${b.id}`, STYLE.sandDeep),
        0.55,
        12
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(0.55, 0, -0.35);
      anim.push({ mesh: wheel, kind: "spin" });
      const hit = makeHit(scene, b.id, root, b, 1.6, 2.5);
      return { root, hit, emissives, anim };
    }

    case "reed_basket_shop": {
      const base = mat(scene, `rb-${b.id}`, STYLE.reedGreen);
      box(scene, `rbb-${b.id}`, 1.45, 1.05, 1.3, root, base, 0.06);
      for (let i = 0; i < 3; i++) {
        const basket = MeshBuilder.CreateTorus(
          `basket-${b.id}-${i}`,
          { diameter: 0.4, thickness: 0.1, tessellation: 10 },
          scene
        );
        basket.position.set(-0.4 + i * 0.4, 1.2, 0.3);
        basket.material = mat(scene, `bm-${b.id}-${i}`, "#A89050");
        basket.parent = root;
        basket.isPickable = false;
      }
      const hit = makeHit(scene, b.id, root, b, 1.5, 2.5);
      return { root, hit, emissives, anim };
    }

    case "harbor": {
      const deck = mat(scene, `hd-${b.id}`, "#8B7355");
      box(scene, `hdeck-${b.id}`, 2.2, 0.18, 1.8, root, deck, 0.02);
      const shed = box(
        scene,
        `hshed-${b.id}`,
        1.3,
        1.1,
        1.1,
        root,
        mat(scene, `hsm-${b.id}`, STYLE.riverDeep, { emissive: 0.05 }),
        0.2
      );
      emissives.push(shed);
      // Crane post
      const post = cyl(
        scene,
        `crane-${b.id}`,
        0.14,
        1.6,
        root,
        mat(scene, `crm-${b.id}`, STYLE.sandDeep),
        0.15,
        6
      );
      post.position.set(0.7, 0, -0.4);
      const arm = box(
        scene,
        `arm-${b.id}`,
        1.1,
        0.1,
        0.12,
        root,
        mat(scene, `armm-${b.id}`, STYLE.sandDeep),
        1.55
      );
      arm.position.set(0.3, 0, -0.4);
      anim.push({ mesh: arm, kind: "bob" });
      const hit = makeHit(scene, b.id, root, b, 1.9, 2.8);
      return { root, hit, emissives, anim };
    }

    case "warehouse": {
      const long = box(
        scene,
        `wh-${b.id}`,
        2.2,
        1.2,
        1.4,
        root,
        mat(scene, `whm-${b.id}`, STYLE.sandDeep),
        0.06
      );
      box(
        scene,
        `whr-${b.id}`,
        2.35,
        0.2,
        1.55,
        root,
        mat(scene, `whrm-${b.id}`, STYLE.mudbrick),
        1.25
      );
      void long;
      const hit = makeHit(scene, b.id, root, b, 1.6, 2.7);
      return { root, hit, emissives, anim };
    }

    case "shrine": {
      // Stepped base + obelisk
      box(
        scene,
        `sh-base-${b.id}`,
        1.6,
        0.35,
        1.6,
        root,
        mat(scene, `shb-${b.id}`, STYLE.stonePale, { specular: 0.25 }),
        0.05
      );
      box(
        scene,
        `sh-mid-${b.id}`,
        1.1,
        0.3,
        1.1,
        root,
        mat(scene, `shm-${b.id}`, STYLE.stonePale, { specular: 0.25 }),
        0.4
      );
      const tip = cyl(
        scene,
        `obelisk-${b.id}`,
        0.35,
        1.5,
        root,
        mat(scene, `ob-${b.id}`, STYLE.stonePale, { specular: 0.3, emissive: 0.08 }),
        0.7,
        4
      );
      tip.scaling.y = 1.2;
      emissives.push(tip);
      const gold = box(
        scene,
        `sh-gold-${b.id}`,
        0.25,
        0.25,
        0.25,
        root,
        mat(scene, `sg-${b.id}`, STYLE.goldSoft, { emissive: 0.25 }),
        2.15
      );
      emissives.push(gold);
      const hit = makeHit(scene, b.id, root, b, 2.4, 2.4);
      return { root, hit, emissives, anim };
    }

    case "training_grounds": {
      const sand = mat(scene, `ts-${b.id}`, "#C4A882");
      const ring = MeshBuilder.CreateTorus(
        `tring-${b.id}`,
        { diameter: 2.0, thickness: 0.12, tessellation: 20 },
        scene
      );
      ring.position.y = 0.08;
      ring.rotation.x = Math.PI / 2;
      ring.material = sand;
      ring.parent = root;
      ring.isPickable = false;
      const postMat = mat(scene, `tp-${b.id}`, STYLE.sandDeep);
      for (const a of [0, 1, 2, 3]) {
        const p = cyl(scene, `tpost-${b.id}-${a}`, 0.1, 1.1, root, postMat, 0.05, 6);
        p.position.x = Math.cos((a * Math.PI) / 2) * 0.75;
        p.position.z = Math.sin((a * Math.PI) / 2) * 0.75;
      }
      // Dummy
      const dummy = cyl(
        scene,
        `dummy-${b.id}`,
        0.22,
        0.9,
        root,
        mat(scene, `dm-${b.id}`, "#A07050"),
        0.05,
        6
      );
      anim.push({ mesh: dummy, kind: "bob" });
      const hit = makeHit(scene, b.id, root, b, 1.3, 2.6);
      return { root, hit, emissives, anim };
    }

    case "luxury_material":
    case "luxury_workshop": {
      const body = box(
        scene,
        `lux-${b.id}`,
        1.55,
        1.35,
        1.4,
        root,
        mat(scene, `luxm-${b.id}`, color, { specular: 0.22, emissive: 0.06 }),
        0.06
      );
      emissives.push(body);
      const crest = box(
        scene,
        `luxc-${b.id}`,
        1.0,
        0.35,
        0.9,
        root,
        mat(scene, `luxcm-${b.id}`, STYLE.goldSoft, { emissive: 0.15 }),
        1.4
      );
      emissives.push(crest);
      const hit = makeHit(scene, b.id, root, b, 1.9, 2.5);
      return { root, hit, emissives, anim };
    }

    default: {
      const h = 1.2 + level * 0.08;
      const { mass } = baseMass(scene, root, b, h, 1.55, color);
      mass.isPickable = true;
      mass.metadata = { buildingId: b.id, kind: b.kind, plotId: b.plotId };
      const hit = makeHit(scene, b.id, root, b, h + 0.5, 2.5);
      return { root, hit, emissives, anim };
    }
  }
}

export function animateBuildingKit(
  kits: Map<string, BuildingMeshes>,
  t: number,
  nightFactor: number
) {
  for (const kit of kits.values()) {
    for (const e of kit.emissives) {
      if (!e || e.isDisposed()) continue;
      const m = e.material as StandardMaterial & {
        albedoColor?: Color3;
        emissiveColor?: Color3;
      } | null;
      if (!m) continue;
      // StandardMaterial uses diffuseColor; PBR/glTF often uses albedoColor
      const d = m.diffuseColor ?? m.albedoColor;
      if (!d || typeof d.scale !== "function") continue;
      const boost = 0.2 + nightFactor * 0.85;
      try {
        m.emissiveColor = d.scale(Math.min(1.0, boost));
      } catch {
        /* material variant without emissive */
      }
    }
    for (const a of kit.anim) {
      if (!a.mesh || a.mesh.isDisposed()) continue;
      if (a.kind === "spin") {
        a.mesh.rotation.z = t * 2.2;
      } else if (a.kind === "bob") {
        if (a.mesh.metadata?.baseY == null) {
          a.mesh.metadata = { ...(a.mesh.metadata ?? {}), baseY: a.mesh.position.y };
        }
        const by = a.mesh.metadata.baseY as number;
        a.mesh.position.y = by + Math.sin(t * 1.8 + by * 3) * 0.04;
      } else if (a.kind === "pulse") {
        const s = 1 + Math.sin(t * 3) * 0.12;
        a.mesh.scaling.set(s, s, s);
      }
    }
  }
}
