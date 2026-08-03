"""
GOAL-GRAPHICS-READY: author hero building kits as SOLID artboard-adjacent glTF.
Blender 4.x headless. Axes: front facade = -Y (lands on Babylon -Z).
Run: blender -b -P author_kits.py -- [kind ...]
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

REPO = "/home/eric/apps/mmo-city-builder"
MODELS = os.path.join(REPO, "apps/client/public/models/buildings")
OUT = "/tmp/claude-1000/-home-eric/f840123e-860a-4c45-add6-0b16a98ff524/scratchpad/kit-previews"
os.makedirs(OUT, exist_ok=True)

ALL = ["great_house", "market", "emmer_field", "mudbrick_yard", "harbor",
       "river_clay_pit", "marsh_reed_bed"]
KINDS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ALL

# ---------------------------------------------------------------- materials


def srgb(hexstr):
    h = hexstr.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [pow(v, 2.2) for v in c] + [1.0]


_mats = {}


def M(name, hexcol, rough=0.92, metal=0.0, emit=None, emit_str=1.0):
    """Get-or-make a flat principled material."""
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = srgb(hexcol)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit:
        bsdf.inputs["Emission Color"].default_value = srgb(emit)
        bsdf.inputs["Emission Strength"].default_value = emit_str
    _mats[name] = m
    return m


def palette():
    return {
        # walls
        "mud": M("mud_terra", "#A96B48"),
        "mud_dk": M("mud_dark", "#7A4A30"),
        "mud_tan": M("mud_tan", "#C29A6B"),
        "stone": M("stone_pale", "#D9CDB0", rough=0.8),
        "stone_w": M("stone_white", "#E4DCC6", rough=0.78),
        # ground
        "dirt": M("dirt_apron", "#8A6A48"),
        "soil": M("soil_dark", "#6B4B30"),
        "sand": M("sand_spit", "#CBB184"),
        "earth": M("earth_pack", "#B08D5F"),
        # wood
        "wood": M("wood_mid", "#7A5632"),
        "wood_dk": M("wood_dark", "#4E3418"),
        "rope": M("rope_tan", "#B39562"),
        # roof / mats
        "thatch": M("thatch_mat", "#C4A05A"),
        "thatch_dk": M("thatch_dark", "#9A7B40"),
        "roof_mud": M("roof_mud", "#966842"),
        # cloth
        "cl_yel": M("cloth_yellow", "#D9A83C"),
        "cl_org": M("cloth_orange", "#C97434"),
        "cl_red": M("cloth_red", "#A6402E"),
        "rug": M("rug_red", "#8E3B2C"),
        "linen": M("linen_pale", "#D8C9A8"),
        # crops
        # "amber" not "gold" — gold-named meshes get night emissive in kitLoader
        "crop_g": M("crop_amber", "#B99A3F"),
        "crop_gr": M("crop_green", "#7D8A38"),
        "crop_dk": M("crop_deep", "#5E7030"),
        # brick
        "brick": M("brick_red", "#9A5B3C"),
        "brick_g": M("brick_grey", "#8A7259"),
        "char": M("char_dark", "#3A2E24"),
        # accents
        "gold": M("gold_leaf", "#D4A438", rough=0.45, metal=0.6),
        "blue": M("nile_blue", "#4A6E8A", rough=0.7),
        "pot": M("pottery", "#A05A34"),
        "dark": M("door_dark", "#241A12"),
        "ember": M("ember_glow", "#E86A18", rough=0.6,
                   emit="#FF7A20", emit_str=2.5),
        "water": M("channel_water", "#4E5E48", rough=0.35),
        "grey": M("clay_grey", "#847A6C"),
    }


# ---------------------------------------------------------------- geo helpers
_counter = [0]


def _new_obj(name, mesh):
    _counter[0] += 1
    o = bpy.data.objects.new(f"{name}_{_counter[0]:03d}", mesh)
    bpy.context.scene.collection.objects.link(o)
    return o


def box(name, w, d, h, loc, mat, rz=0.0, rx=0.0, ry=0.0):
    """Solid box; loc = (x, y, z_bottom_center)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    o = _new_obj(name, mesh)
    o.location = (loc[0], loc[1], loc[2] + h / 2)
    o.rotation_euler = (rx, ry, rz)
    o.data.materials.append(mat)
    return o


def frustum(name, wb, db, wt, dt, h, loc, mat, rz=0.0):
    """Battered (tapered) solid mass; loc = (x, y, z_bottom_center)."""
    bm = bmesh.new()
    vb = [bm.verts.new((sx * wb / 2, sy * db / 2, 0))
          for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    vt = [bm.verts.new((sx * wt / 2, sy * dt / 2, h))
          for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    bm.faces.new(vb[::-1])
    bm.faces.new(vt)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((vb[i], vb[j], vt[j], vt[i]))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    o = _new_obj(name, mesh)
    o.location = loc
    o.rotation_euler = (0, 0, rz)
    o.data.materials.append(mat)
    return o


def cyl(name, r, h, loc, mat, seg=10, rtop=None, rx=0.0, ry=0.0, rz=0.0):
    """Cylinder / tapered cylinder; loc = (x, y, z_bottom_center)."""
    bm = bmesh.new()
    r2 = r if rtop is None else rtop
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg,
                          radius1=r, radius2=r2, depth=h)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    o = _new_obj(name, mesh)
    o.location = (loc[0], loc[1], loc[2] + h / 2)
    o.rotation_euler = (rx, ry, rz)
    o.data.materials.append(mat)
    return o


def torus(name, r, tr, loc, mat, seg=12, rings=8):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=r, minor_radius=tr, major_segments=seg,
        minor_segments=rings, location=(loc[0], loc[1], loc[2] + tr))
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    return o


def sphere(name, r, loc, mat, seg=8):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(4, seg // 2),
                              radius=r)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    o = _new_obj(name, mesh)
    o.location = (loc[0], loc[1], loc[2] + r)
    o.data.materials.append(mat)
    return o


def stairs(name, n, width, run, rise, loc, mat, along="x", sign=1):
    """Solid staircase climbing from loc; steps stack in +Z."""
    objs = []
    for i in range(n):
        h = rise * (i + 1)
        if along == "x":
            o = box(name, run, width, h,
                    (loc[0] + sign * (i + 0.5) * run, loc[1], loc[2]), mat)
        else:
            o = box(name, width, run, h,
                    (loc[0], loc[1] + sign * (i + 0.5) * run, loc[2]), mat)
        objs.append(o)
    return objs


def basket(name, x, y, z, P, r=0.11, h=0.13, fill="grey"):
    a = cyl(f"{name}_bask", r, h, (x, y, z), P["thatch_dk"], seg=9, rtop=r * 1.18)
    b = cyl(f"{name}_fill", r * 0.82, 0.05, (x, y, z + h - 0.014), P[fill], seg=9)
    return [a, b]


def amphora(name, x, y, z, P, s=1.0):
    body = cyl(f"{name}_pot", 0.075 * s, 0.2 * s, (x, y, z), P["pot"], seg=9,
               rtop=0.028 * s)
    neck = cyl(f"{name}_pot_neck", 0.05 * s, 0.07 * s, (x, y, z + 0.19 * s),
               P["pot"], seg=8, rtop=0.055 * s)
    return [body, neck]


def bevel(o, w=0.02):
    md = o.modifiers.new("bev", "BEVEL")
    md.width = w
    md.segments = 1
    md.angle_limit = math.radians(40)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()
    _counter[0] = 0


def grab_all():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


# ---------------------------------------------------------------- GREAT HOUSE
def build_great_house(P):
    """Board 01: two-tier mudbrick estate — stone band, loggia pergola,
    external stair, striped door awning, gold disc, pots."""
    # ground apron (trimmed so the corner never kisses the market base)
    box("gh_dirt_apron", 3.05, 3.05, 0.07, (0, 0, 0), P["dirt"])
    # lower story: battered terracotta mass
    lower = frustum("gh_mud_lower", 2.75, 2.45, 2.6, 2.3, 1.12, (0, 0, 0.07),
                    P["mud"])
    bevel(lower, 0.025)
    # pale stone mid band (upper half of story 1, slightly proud)
    band = frustum("gh_stone_band", 2.66, 2.36, 2.56, 2.26, 0.62,
                   (0, 0, 1.16), P["stone"])
    bevel(band, 0.02)
    # thin stone string-course between mud and stone
    box("gh_stone_string", 2.74, 2.44, 0.07, (0, 0, 1.12), P["stone_w"])
    # story-1 roof slab / terrace
    box("gh_mud_terrace", 2.62, 2.32, 0.1, (0, 0, 1.78), P["mud_dk"])

    # upper story LEFT: plain mud tower with parapet
    tower = frustum("gh_mud_tower", 1.28, 2.2, 1.2, 2.1, 0.82,
                    (-0.62, 0, 1.88), P["mud"])
    bevel(tower, 0.02)
    box("gh_stone_parapet", 1.3, 2.22, 0.09, (-0.62, 0, 2.7), P["stone"])
    box("gh_vent_box", 0.18, 0.18, 0.16, (-0.75, 0.55, 2.79), P["stone_w"])
    # tower roofline trim (cornice teeth suggestion: 3 small blocks)
    for i, yy in enumerate((-0.7, 0, 0.7)):
        box("gh_trim", 0.1, 0.3, 0.07, (-1.24, yy, 2.62), P["stone_w"])

    # upper story RIGHT: wooden loggia / pergola with mat roof
    lx, lw, ld = 0.72, 1.35, 2.15
    deckz = 1.88
    # corner + mid posts
    for px in (lx - lw / 2 + 0.08, lx + lw / 2 - 0.08):
        for py in (-ld / 2 + 0.08, 0, ld / 2 - 0.08):
            box("gh_wood_post", 0.09, 0.09, 0.78, (px, py, deckz), P["wood_dk"])
    # lattice rails: two horizontal bands each open side
    for zz in (deckz + 0.22, deckz + 0.46):
        box("gh_wood_rail_f", lw, 0.05, 0.1, (lx, -ld / 2 + 0.06, zz), P["wood"])
        box("gh_wood_rail_s", 0.05, ld, 0.1, (lx + lw / 2 - 0.06, 0, zz), P["wood"])
    # lattice verticals (front): thin sticks
    for i in range(6):
        px = lx - lw / 2 + 0.18 + i * (lw - 0.36) / 5
        box("gh_wood_lat", 0.035, 0.035, 0.5, (px, -ld / 2 + 0.06, deckz + 0.14),
            P["wood"])
    # mat roof over loggia (thatch, slight overhang)
    box("gh_thatch_roof", lw + 0.25, ld + 0.25, 0.09, (lx, 0, deckz + 0.78),
        P["thatch"])
    box("gh_wood_fascia", lw + 0.27, 0.06, 0.06, (lx, -(ld + 0.25) / 2 + 0.02,
        deckz + 0.74), P["wood_dk"])
    # hanging rug on loggia front rail
    box("gh_rug_hang", 0.46, 0.045, 0.52, (lx + 0.25, -ld / 2 + 0.02,
        deckz + 0.02), P["rug"])
    box("gh_rug_hang2", 0.4, 0.045, 0.44, (lx - 0.62, ld / 2 - 0.02,
        deckz + 0.06), P["cl_org"])

    # external stair: proud of the front face, climbing left→right to terrace
    sy = -1.42  # fully outside the battered wall (base face ≈ -1.22)
    stairs("gh_stone_stair", 9, 0.44, 0.165, 0.185, (-1.6, sy, 0.07),
           P["stone"], along="x", sign=1)
    # solid mud stringer wall carrying the flight (outer side)
    frustum("gh_mud_stringer", 1.5, 0.13, 1.45, 0.11, 0.9,
            (-0.85, sy - 0.24, 0.07), P["mud"])
    # low landing wall at top of flight
    box("gh_stone_landing", 0.3, 0.44, 0.06, (-0.02, sy, 1.73), P["stone"])

    # door: center-right of front face
    dx = 0.32
    fy = -1.21  # front face outer plane of lower mass (approx)
    box("gh_door_recess", 0.52, 0.16, 0.8, (dx, fy - 0.02, 0.14), P["dark"])
    box("gh_stone_jambL", 0.1, 0.12, 0.9, (dx - 0.33, fy - 0.03, 0.12), P["stone_w"])
    box("gh_stone_jambR", 0.1, 0.12, 0.9, (dx + 0.33, fy - 0.03, 0.12), P["stone_w"])
    box("gh_stone_lintel", 0.78, 0.13, 0.13, (dx, fy - 0.03, 1.0), P["stone_w"])
    # gold sun disc above lintel
    cyl("gh_gold_disc", 0.09, 0.05, (dx, fy - 0.02, 1.2), P["gold"], seg=12,
        rx=math.radians(90))
    # striped awning over door: red canopy angled + 2 slim poles
    box("gh_cloth_awn_door", 0.9, 0.55, 0.045, (dx, fy - 0.28, 1.06), P["cl_red"],
        rx=math.radians(-18))
    box("gh_cloth_awn_str1", 0.9, 0.14, 0.05, (dx, fy - 0.44, 1.005), P["linen"],
        rx=math.radians(-18))
    for sxp in (dx - 0.4, dx + 0.4):
        cyl("gh_wood_awnpole", 0.025, 0.92, (sxp, fy - 0.5, 0.07), P["wood_dk"], seg=7)

    # two yellow window awnings + dark windows on the stone band (front face)
    for wx in (-0.85, 1.0):
        box("gh_win_dark", 0.3, 0.07, 0.36, (wx, -1.185, 1.3), P["dark"])
        # awning: top edge kisses the wall above the window, slopes down-out
        box("gh_cloth_awn_win", 0.44, 0.36, 0.035, (wx, -1.33, 1.6),
            P["cl_yel"], rx=math.radians(-32))
    # small dark window on the left face of the stone band
    box("gh_win_dark_side", 0.07, 0.3, 0.3, (-1.33, -0.35, 1.32), P["dark"])

    # pots at the door
    amphora("gh", dx - 0.62, fy - 0.28, 0.07, P, s=1.15)
    amphora("gh2", dx - 0.78, fy - 0.12, 0.07, P, s=0.8)
    basket("gh", dx + 0.7, fy - 0.3, 0.07, P, r=0.1, fill="crop_g")


# ---------------------------------------------------------------- MARKET
def build_market(P):
    """Board 02: colonnade hall — battered ends, heavy roof slab, awnings,
    counters with goods, amphorae, corner steps."""
    # stepped limestone base
    box("mk_stone_base", 3.15, 2.25, 0.1, (0, 0, 0), P["stone"])
    box("mk_stone_base2", 2.98, 2.08, 0.1, (0, 0, 0.1), P["stone_w"])
    box("mk_stone_floor", 2.85, 1.92, 0.05, (0, 0, 0.2), P["stone"])

    # battered end walls + back wall (mud)
    wl = frustum("mk_mud_endL", 0.62, 1.95, 0.5, 1.78, 1.0, (-1.32, 0, 0.25),
                 P["mud"])
    bevel(wl, 0.02)
    wr = frustum("mk_mud_endR", 0.62, 1.95, 0.5, 1.78, 1.0, (1.32, 0, 0.25),
                 P["mud"])
    bevel(wr, 0.02)
    bk = frustum("mk_mud_back", 2.9, 0.4, 2.8, 0.32, 1.0, (0, 0.82, 0.25),
                 P["mud"])
    bevel(bk, 0.02)

    # colonnade: 5 pale columns with capitals
    for i in range(5):
        cx = -1.0 + i * 0.5
        cyl("mk_stone_col", 0.085, 0.88, (cx, -0.72, 0.25), P["stone_w"], seg=10)
        box("mk_stone_cap", 0.2, 0.2, 0.07, (cx, -0.72, 1.13), P["stone_w"])

    # heavy roof slab + raised border
    roof = box("mk_mud_roofslab", 3.12, 2.24, 0.2, (0, 0, 1.25), P["mud_tan"])
    bevel(roof, 0.03)
    box("mk_mud_roofrim", 2.84, 1.96, 0.07, (0, 0, 1.45), P["mud_dk"])
    box("mk_stone_cornice", 3.16, 2.28, 0.05, (0, 0, 1.2), P["stone_w"])
    # reed mats stacked on roof edge
    box("mk_matting_roof", 0.8, 0.4, 0.05, (0.9, -0.85, 1.45), P["thatch"])
    box("mk_matting_roof2", 0.6, 0.35, 0.05, (-1.05, -0.8, 1.45), P["thatch_dk"])

    # cloth awnings: tied at the roof edge, sloping down-and-out over goods
    cols = [(-0.75, "cl_yel"), (-0.25, "cl_org"), (0.375, "cl_yel"),
            (0.875, "cl_org")]
    for cx, cm in cols:
        box("mk_cloth_awn", 0.48, 0.6, 0.035, (cx, -1.38, 1.0), P[cm],
            rx=math.radians(-26))
        cyl("mk_wood_awnpole", 0.024, 0.88, (cx - 0.2, -1.6, 0.2), P["wood_dk"],
            seg=7)
    cyl("mk_wood_awnpole", 0.024, 0.88, (1.08, -1.6, 0.2), P["wood_dk"], seg=7)

    # counters: mud blocks + textile tops + goods
    for (cx, cy, cloth) in ((-0.55, -1.62, "cl_org"), (1.15, -1.5, "cl_yel")):
        box("mk_mud_counter", 0.92, 0.5, 0.5, (cx, cy, 0.0), P["mud_dk"])
        box("mk_cloth_top", 0.98, 0.56, 0.05, (cx, cy, 0.5), P[cloth])
        basket("mk", cx - 0.28, cy - 0.02, 0.55, P, r=0.1, fill="crop_g")
        basket("mk2", cx + 0.25, cy + 0.05, 0.55, P, r=0.09, fill="grey")
    # floor goods: baskets + amphorae row near right colonnade
    basket("mk3", 0.45, -1.15, 0.25, P, r=0.13, fill="crop_g")
    basket("mk4", 0.15, -1.3, 0.25, P, r=0.1, fill="grey")
    amphora("mk", 1.5, -1.05, 0.2, P, s=1.3)
    amphora("mk2", 1.68, -0.8, 0.2, P, s=1.0)
    amphora("mk3", -1.55, -0.9, 0.2, P, s=1.1)
    # corner steps
    box("mk_stone_step", 0.7, 0.3, 0.08, (0.4, -1.98, 0.0), P["stone_w"])
    box("mk_stone_step2", 0.7, 0.24, 0.08, (0.4, -1.86, 0.08), P["stone"])


# ---------------------------------------------------------------- EMMER FIELD
def build_emmer_field(P):
    """Board 08: 4 quadrant crop beds, irrigation cross, banded shed,
    rush fence, baskets."""
    base = box("ef_soil_base", 3.3, 3.3, 0.1, (0, 0, 0), P["soil"])
    bevel(base, 0.02)
    # irrigation cross (dark wet channels + low banks)
    box("ef_water_chX", 3.3, 0.34, 0.035, (0, 0, 0.1), P["water"])
    box("ef_water_chY", 0.34, 3.3, 0.035, (0, 0, 0.1), P["water"])
    for s in (-1, 1):
        box("ef_soil_bankX", 3.3, 0.07, 0.07, (0, s * 0.24, 0.1), P["mud_dk"])
        box("ef_soil_bankY", 0.07, 3.3, 0.07, (s * 0.24, 0, 0.1), P["mud_dk"])

    # quadrant crop beds
    import random
    rnd = random.Random(11)
    for qx in (-1, 1):
        for qy in (-1, 1):
            cx0, cy0 = qx * 0.94, qy * 0.94
            if qx == -1 and qy == -1:
                # shed quadrant: smaller bed pushed to corner
                bed_w = bed_d = 0.85
                cx0, cy0 = -1.15, -1.15
            else:
                bed_w = bed_d = 1.28
            box("ef_crop_bed", bed_w + 0.06, bed_d + 0.06, 0.1,
                (cx0, cy0, 0.1), P["crop_dk"])
            # crop rows: fine two-tone rows (green base, amber heads) + tufts
            rows = 6
            for r in range(rows):
                ry = cy0 - bed_d / 2 + (r + 0.5) * bed_d / rows
                hh = 0.22 + 0.05 * (r % 3) + rnd.random() * 0.04
                box("ef_crop_rowbase", bed_w, bed_d / rows * 0.66, hh,
                    (cx0, ry, 0.2), P["crop_gr"])
                box("ef_crop_rowhead", bed_w * 0.97, bed_d / rows * 0.5, 0.1,
                    (cx0, ry, 0.2 + hh), P["crop_g"])
            for _ in range(14):
                tx = cx0 + (rnd.random() - 0.5) * bed_w * 0.9
                ty = cy0 + (rnd.random() - 0.5) * bed_d * 0.9
                th = 0.4 + rnd.random() * 0.2
                box("ef_crop_tuft", 0.055, 0.055, th, (tx, ty, 0.24),
                    P["crop_g"] if rnd.random() > 0.3 else P["crop_gr"],
                    rz=rnd.random())

    # banded mudbrick shed (front-left quadrant, open front)
    shx, shy = -0.62, -0.95
    frustum("ef_brick_shed", 0.95, 0.8, 0.9, 0.75, 0.72, (shx, shy, 0.1),
            P["brick"])
    # tan banding courses (slightly proud)
    for zz in (0.28, 0.5):
        box("ef_mud_band", 0.97, 0.82, 0.07, (shx, shy, zz), P["mud_tan"])
    box("ef_door_open", 0.4, 0.1, 0.5, (shx, shy - 0.38, 0.12), P["dark"])
    # reed-lattice flat roof + wood beams (snug overhang)
    box("ef_thatch_roof", 1.02, 0.86, 0.06, (shx, shy, 0.82), P["thatch"])
    box("ef_wood_beamF", 1.05, 0.05, 0.05, (shx, shy - 0.4, 0.79), P["wood_dk"])
    box("ef_wood_beamB", 1.05, 0.05, 0.05, (shx, shy + 0.4, 0.79), P["wood_dk"])
    # props: grain pile + baskets by shed door
    cyl("ef_crop_grainpile", 0.16, 0.14, (shx + 0.42, shy - 0.5, 0.1),
        P["crop_g"], seg=9, rtop=0.02)
    basket("ef", shx + 0.65, shy - 0.32, 0.1, P, r=0.1, fill="crop_g")
    basket("ef2", shx - 0.52, shy - 0.5, 0.1, P, fill="crop_g", r=0.08)

    # rush fence: back and right edges (posts + rails)
    for i in range(11):
        px = -1.55 + i * 0.31
        box("ef_fence_post", 0.04, 0.04, 0.34, (px, 1.6, 0.1), P["thatch_dk"])
    box("ef_fence_railB", 3.2, 0.035, 0.05, (0, 1.6, 0.33), P["wood"])
    box("ef_fence_railB2", 3.2, 0.035, 0.05, (0, 1.6, 0.2), P["wood"])
    for i in range(11):
        py = -1.55 + i * 0.31
        box("ef_fence_post", 0.04, 0.04, 0.34, (1.6, py, 0.1), P["thatch_dk"])
    box("ef_fence_railR", 0.035, 3.2, 0.05, (1.6, 0, 0.33), P["wood"])
    box("ef_fence_railR2", 0.035, 3.2, 0.05, (1.6, 0, 0.2), P["wood"])


# ---------------------------------------------------------------- MUDBRICK YARD
def build_mudbrick_yard(P):
    """Board 03: stepped pyramid kiln with glowing mouth, brick stacks,
    drying rack, mats with bricks, shade canopy, clay baskets."""
    base = box("my_earth_base", 3.3, 3.3, 0.08, (0, 0, 0), P["earth"])
    bevel(base, 0.02)

    # kiln: stepped battered pyramid, right-of-center
    kx, ky = 0.75, 0.25
    steps = [(1.55, 1.45, 0.55), (1.3, 1.2, 0.45), (1.0, 0.95, 0.4),
             (0.68, 0.65, 0.32)]
    z = 0.08
    for i, (w, d, h) in enumerate(steps):
        f = frustum("my_brick_kiln", w, d, w * 0.82, d * 0.82, h, (kx, ky, z),
                    P["brick"])
        bevel(f, 0.02)
        z += h
    # smoke stain band near top + crown
    box("my_char_stain", 0.62, 0.6, 0.2, (kx, ky, z - 0.26), P["char"])
    cyl("my_brick_crown", 0.24, 0.14, (kx, ky, z), P["mud_dk"], seg=10)
    cyl("my_kiln_glow_top", 0.15, 0.05, (kx, ky, z + 0.12), P["ember"], seg=9)
    # firing mouth: dark arch inset into the base course + ember glow proud
    box("my_door_mouth", 0.4, 0.14, 0.44, (kx, ky - 0.68, 0.08), P["dark"])
    box("my_kiln_glow_mouth", 0.24, 0.04, 0.2, (kx, ky - 0.775, 0.1),
        P["ember"])
    # soot streak flat against the face above the mouth
    box("my_char_smudge", 0.42, 0.025, 0.3, (kx, ky - 0.67, 0.54), P["char"],
        rx=math.radians(-9))
    # brick band courses on kiln body (thin proud strips)
    for zz in (0.4, 0.85):
        box("my_mud_kilnband", 1.42 - zz * 0.5, 0.06, 0.06,
            (kx, ky - (0.7 - zz * 0.24), zz + 0.08), P["mud_tan"])

    # brick stacks: stepped pyramids of grey/red brick, left side
    def brick_stack(sx, sy, courses, bw, mat):
        zz = 0.08
        for c in range(courses):
            w = bw - c * 0.22
            d = bw * 0.8 - c * 0.18
            if w <= 0.1 or d <= 0.1:
                break
            box("my_brick_stack", w, d, 0.22, (sx, sy, zz), mat)
            # course joint line — subtle, must not read as black caps
            box("my_mud_courseline", w + 0.01, d + 0.01, 0.014,
                (sx, sy, zz + 0.206), P["mud_dk"])
            zz += 0.22
    brick_stack(-1.05, 0.75, 4, 1.05, P["brick_g"])
    brick_stack(-0.45, 1.15, 3, 0.8, P["brick_g"])
    brick_stack(-1.15, -0.15, 3, 0.75, P["brick"])

    # drying rack: post frame + slat table + bricks on top
    rx0, ry0 = -0.35, -0.25
    for px, py in ((rx0 - 0.45, ry0 - 0.3), (rx0 + 0.45, ry0 - 0.3),
                   (rx0 - 0.45, ry0 + 0.3), (rx0 + 0.45, ry0 + 0.3)):
        box("my_wood_rackpost", 0.06, 0.06, 0.62, (px, py, 0.08), P["wood_dk"])
    box("my_wood_rackrailF", 1.0, 0.05, 0.05, (rx0, ry0 - 0.3, 0.64), P["wood"])
    box("my_wood_rackrailB", 1.0, 0.05, 0.05, (rx0, ry0 + 0.3, 0.64), P["wood"])
    for i in range(6):
        box("my_wood_rackslat", 0.13, 0.66, 0.03,
            (rx0 - 0.42 + i * 0.17, ry0, 0.69), P["wood"])
    for i in range(4):
        box("my_brick_wet", 0.14, 0.09, 0.07,
            (rx0 - 0.3 + i * 0.2, ry0 + 0.05 * (i % 2), 0.72), P["grey"])

    # drying mats with brick rows (front)
    for mi, (mx, my_) in enumerate(((-0.7, -1.15), (0.35, -1.25))):
        box("my_matting_dry", 0.85, 0.55, 0.02, (mx, my_, 0.08), P["thatch"])
        for bi in range(6):
            bxp = mx - 0.28 + (bi % 3) * 0.28
            byp = my_ - 0.12 + (bi // 3) * 0.24
            box("my_brick_dry", 0.16, 0.1, 0.08, (bxp, byp, 0.1),
                P["brick"] if (bi + mi) % 2 else P["grey"])

    # shade canopy back-right: 4 poles + angled mat
    cx0, cy0 = 1.15, 1.15
    for px, py in ((cx0 - 0.5, cy0 - 0.4), (cx0 + 0.5, cy0 - 0.4),
                   (cx0 - 0.5, cy0 + 0.4), (cx0 + 0.5, cy0 + 0.4)):
        cyl("my_wood_canpole", 0.03, 0.75 + (0.12 if py > cy0 else 0),
            (px, py, 0.08), P["wood_dk"], seg=7)
    box("my_matting_canopy", 1.25, 1.0, 0.045, (cx0, cy0, 0.86), P["thatch"],
        rx=math.radians(-7))

    # clay baskets + pot
    basket("my", -1.3, -0.85, 0.08, P, r=0.13, fill="grey")
    basket("my2", -1.05, -1.1, 0.08, P, r=0.11, fill="grey")
    basket("my3", -1.35, -1.3, 0.08, P, r=0.1, fill="grey")
    sphere("my_grey_clay", 0.07, (-1.3, -0.85, 0.2), P["grey"], seg=7)
    amphora("my", 1.55, -0.7, 0.08, P, s=1.0)


# ---------------------------------------------------------------- HARBOR
def build_harbor(P):
    """Board 04: warehouse on sand spit, plank pier arm, moored barge,
    amphorae, bollards + rope. Water side = Blender +X (Babylon -X)."""
    # sand spit under warehouse (land side)
    spit = box("hb_sand_spit", 1.9, 2.9, 0.1, (-0.7, 0, 0), P["sand"])
    bevel(spit, 0.03)

    # warehouse
    wx, wy = -0.7, 0.25
    wh = frustum("hb_mud_ware", 1.3, 1.05, 1.22, 0.98, 0.92, (wx, wy, 0.1),
                 P["mud_tan"])
    bevel(wh, 0.02)
    box("hb_stone_cornice", 1.32, 1.07, 0.08, (wx, wy, 1.02), P["stone"])
    box("hb_mud_roof", 1.18, 0.94, 0.07, (wx, wy, 1.1), P["mud_dk"])
    # roof mats + rolled bundles
    box("hb_matting_roof", 0.5, 0.42, 0.05, (wx - 0.2, wy + 0.1, 1.17),
        P["thatch"])
    cyl("hb_matting_roll", 0.055, 0.5, (wx + 0.3, wy - 0.15, 1.17), P["thatch_dk"],
        seg=8, ry=math.radians(90))
    # door recess + blue clerestory band (artboard blue windows)
    box("hb_door_ware", 0.34, 0.09, 0.6, (wx, wy - 0.51, 0.14), P["dark"])
    box("hb_stone_doorframe", 0.46, 0.06, 0.08, (wx, wy - 0.52, 0.74), P["stone_w"])
    box("hb_blue_clerestory", 0.5, 0.05, 0.14, (wx, wy - 0.5, 0.82), P["blue"])
    for sxp in (-1, 1):
        box("hb_win_dark", 0.1, 0.06, 0.12, (wx + sxp * 0.42, wy - 0.5, 0.6),
            P["dark"])
    # leaning mats + amphorae at warehouse wall
    box("hb_matting_lean", 0.34, 0.05, 0.5, (wx + 0.5, wy - 0.45, 0.1),
        P["thatch"], rx=math.radians(12))
    amphora("hb_w1", wx - 0.5, wy - 0.42, 0.1, P, s=1.1)
    amphora("hb_w2", wx - 0.34, wy - 0.55, 0.1, P, s=0.85)
    # small palm
    cyl("hb_wood_palm", 0.04, 0.55, (wx - 0.55, wy + 0.42, 0.1), P["wood_dk"],
        seg=7, rtop=0.028)
    for a in range(5):
        box("hb_crop_frond", 0.3, 0.07, 0.02, (wx - 0.55, wy + 0.42, 0.62),
            P["crop_gr"], rz=a * 1.256, rx=math.radians(-16))

    # plank pier: main run toward water (+X), then side arm forward (-Y)
    deck_z = 0.26
    # stringers + posts
    for yy in (-0.28, 0.28):
        box("hb_wood_stringer", 2.3, 0.08, 0.07, (0.55, yy, deck_z - 0.07),
            P["wood_dk"])
    for i in range(4):
        px = -0.35 + i * 0.62
        for yy in (-0.3, 0.3):
            cyl("hb_wood_post", 0.05, deck_z + 0.06, (px, yy, -0.06),
                P["wood_dk"], seg=8)
    # deck planks (individual, slight gaps)
    for i in range(11):
        px = -0.4 + i * 0.2
        box("hb_wood_plank", 0.17, 0.72, 0.05, (px, 0, deck_z), P["wood"])
    # side arm at far end toward -Y
    for yy in range(6):
        py = -0.45 - yy * 0.2
        box("hb_wood_plank_arm", 0.62, 0.17, 0.05, (1.38, py, deck_z), P["wood"])
    for i in range(3):
        py = -0.5 - i * 0.5
        for xx in (1.12, 1.64):
            cyl("hb_wood_post_arm", 0.045, deck_z + 0.06, (xx, py, -0.06),
                P["wood_dk"], seg=8)
    # bollards + rope coils on deck
    for (bx_, by_) in ((1.64, -0.5), (1.64, -1.35), (0.2, 0.3)):
        cyl("hb_wood_bollard", 0.05, 0.16, (bx_, by_, deck_z + 0.025),
            P["wood_dk"], seg=8)
    torus("hb_rope_coil", 0.09, 0.025, (1.4, -0.85, deck_z + 0.025), P["rope"])
    torus("hb_rope_coil2", 0.07, 0.02, (0.5, -0.22, deck_z + 0.025), P["rope"])
    # amphorae cluster on pier arm
    amphora("hb_p1", 1.28, -1.15, deck_z + 0.025, P, s=0.95)
    amphora("hb_p2", 1.45, -1.05, deck_z + 0.025, P, s=0.8)
    amphora("hb_p3", 1.5, -1.22, deck_z + 0.025, P, s=0.7)

    # moored barge alongside arm (west of arm, floating at z≈0.06)
    bx0, by0, bz0 = 0.55, -1.15, 0.06
    hull = box("hb_wood_hull", 1.5, 0.44, 0.2, (bx0, by0, bz0), P["wood_dk"])
    bevel(hull, 0.04)
    # curved prow / stern (angled risers)
    box("hb_wood_prow", 0.42, 0.34, 0.14, (bx0 - 0.78, by0, bz0 + 0.1),
        P["wood_dk"], ry=math.radians(-24))
    box("hb_wood_stern", 0.42, 0.34, 0.14, (bx0 + 0.78, by0, bz0 + 0.1),
        P["wood_dk"], ry=math.radians(24))
    # gunwale rails
    for yy in (-0.2, 0.2):
        box("hb_wood_gunwale", 1.46, 0.05, 0.05, (bx0, by0 + yy, bz0 + 0.2),
            P["wood"])
    # deck mat + cargo sacks
    box("hb_matting_deck", 0.62, 0.3, 0.04, (bx0 - 0.1, by0, bz0 + 0.2),
        P["thatch"])
    for i in range(3):
        box("hb_linen_sack", 0.18, 0.14, 0.11,
            (bx0 + 0.3 + (i % 2) * 0.16, by0 - 0.04 + (i // 2) * 0.12,
             bz0 + 0.2), P["linen"], rz=0.3 * i)
    # steering oar resting against the stern gunwale
    cyl("hb_wood_oar", 0.02, 0.55, (bx0 + 0.62, by0 + 0.16, bz0 + 0.16),
        P["wood"], seg=6, ry=math.radians(48))
    box("hb_wood_oarblade", 0.14, 0.05, 0.2, (bx0 + 0.86, by0 + 0.16,
        bz0 + 0.02), P["wood"], ry=math.radians(30))


# ---------------------------------------------------------------- RIVER CLAY PIT
def build_river_clay_pit(P):
    """Terraced riverside dig: stepped excavation rings down to a wet clay
    pool, plank ramp, clay-ball piles, baskets."""
    base = box("cp_earth_base", 3.0, 3.0, 0.1, (0, 0, 0), P["earth"])
    bevel(base, 0.02)
    # terraces descending toward center (stacked shrinking rings read as dig)
    frustum("cp_mud_terr1", 2.55, 2.55, 2.4, 2.4, 0.14, (0, 0, 0.1), P["mud_tan"])
    frustum("cp_mud_terr2", 1.95, 1.95, 1.8, 1.8, 0.12, (0, 0, 0.24), P["mud"])
    frustum("cp_mud_terr3", 1.4, 1.4, 1.28, 1.28, 0.1, (0, 0, 0.36), P["mud_dk"])
    # wet clay pool on the top step (reads as the dig heart)
    box("cp_water_claypool", 0.95, 0.95, 0.05, (0, 0, 0.44), P["water"])
    box("cp_mud_poolrim", 1.1, 0.12, 0.1, (0, -0.5, 0.42), P["mud_dk"])
    box("cp_mud_poolrim2", 0.12, 1.1, 0.1, (0.5, 0, 0.42), P["mud_dk"])
    # plank ramp down the front face
    box("cp_wood_ramp", 0.4, 1.15, 0.06, (-0.45, -0.95, 0.18), P["wood"],
        rx=math.radians(14))
    # clay ball piles + baskets on the rim
    for i, (px, py) in enumerate(((-1.1, 0.9), (-0.85, 1.1), (1.0, -0.95))):
        sphere(f"cp_grey_clay{i}", 0.1, (px, py, 0.1), P["grey"], seg=7)
        sphere(f"cp_grey_clay{i}b", 0.075, (px + 0.16, py - 0.08, 0.1),
               P["grey"], seg=7)
    basket("cp", 1.15, 0.85, 0.1, P, r=0.12, fill="grey")
    basket("cp2", 0.9, 1.05, 0.1, P, r=0.1, fill="grey")
    amphora("cp", -1.2, -0.7, 0.1, P, s=0.9)
    # digging stakes
    for px, py in ((0.7, 0.7), (-0.7, 0.55)):
        cyl("cp_wood_stake", 0.03, 0.3, (px, py, 0.38), P["wood_dk"], seg=6)


# ---------------------------------------------------------------- MARSH REED BED
def build_marsh_reed_bed(P):
    """Managed reed paddies: wet basin, mud berms, dense rush clumps,
    cut-bundle stacks. (Names avoid 'reed' — kitLoader bobs reed meshes.)"""
    base = box("mr_soil_base", 3.0, 3.0, 0.1, (0, 0, 0), P["soil"])
    bevel(base, 0.02)
    # water basin + berm grid (2×2 paddies)
    box("mr_water_basin", 2.7, 2.7, 0.05, (0, 0, 0.1), P["water"])
    box("mr_mud_bermX", 2.9, 0.16, 0.1, (0, 0, 0.1), P["mud_dk"])
    box("mr_mud_bermY", 0.16, 2.9, 0.1, (0, 0, 0.1), P["mud_dk"])
    box("mr_mud_rim1", 2.9, 0.14, 0.12, (0, -1.42, 0.08), P["mud_dk"])
    box("mr_mud_rim2", 2.9, 0.14, 0.12, (0, 1.42, 0.08), P["mud_dk"])
    box("mr_mud_rim3", 0.14, 2.9, 0.12, (-1.42, 0, 0.08), P["mud_dk"])
    box("mr_mud_rim4", 0.14, 2.9, 0.12, (1.42, 0, 0.08), P["mud_dk"])
    # dense rush clumps per paddy: solid mass + stalks + seed heads
    import random
    rnd = random.Random(7)
    for qx in (-1, 1):
        for qy in (-1, 1):
            cx0, cy0 = qx * 0.72, qy * 0.72
            box("mr_rush_mass", 0.85, 0.85, 0.3, (cx0, cy0, 0.13),
                P["crop_dk"])
            for _ in range(10):
                tx = cx0 + (rnd.random() - 0.5) * 0.85
                ty = cy0 + (rnd.random() - 0.5) * 0.85
                th = 0.5 + rnd.random() * 0.35
                cyl("mr_rush_stalk", 0.028, th, (tx, ty, 0.14), P["crop_gr"],
                    seg=5)
                if rnd.random() > 0.5:
                    box("mr_crop_head", 0.05, 0.05, 0.1, (tx, ty, 0.14 + th),
                        P["crop_g"])
    # cut bundle stack on the near rim + basket
    for i in range(3):
        cyl(f"mr_thatch_bundle{i}", 0.07, 0.55, (-1.15 + i * 0.17, -1.42, 0.14),
            P["thatch"], seg=7, ry=math.radians(90))
    cyl("mr_thatch_bundle_top", 0.07, 0.5, (-1.06, -1.42, 0.27), P["thatch_dk"],
        seg=7, ry=math.radians(90))
    basket("mr", 1.2, -1.3, 0.1, P, r=0.1, fill="crop_gr")


# ---------------------------------------------------------------- export/render
BUILDERS = {
    "great_house": build_great_house,
    "market": build_market,
    "emmer_field": build_emmer_field,
    "mudbrick_yard": build_mudbrick_yard,
    "harbor": build_harbor,
    "river_clay_pit": build_river_clay_pit,
    "marsh_reed_bed": build_marsh_reed_bed,
}


def add_preview_rig(size=4.2):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 48
    sc.cycles.use_denoising = False
    sc.render.resolution_x = 900
    sc.render.resolution_y = 720
    world = bpy.data.worlds.new("W")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.72, 0.65, 0.52, 1)
    bg.inputs[1].default_value = 0.55
    sun_data = bpy.data.lights.new("sun", type="SUN")
    sun_data.energy = 3.4
    sun_data.color = (1.0, 0.85, 0.63)
    sun_data.angle = 0.18
    sun = bpy.data.objects.new("sun", sun_data)
    sc.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(48), 0, math.radians(28))
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = size * 1.35
    cam = bpy.data.objects.new("cam", cam_data)
    sc.collection.objects.link(cam)
    az, el, d = math.radians(-38), math.radians(40), size * 4
    center = (0, 0, 0.7)
    cam.location = (center[0] + d * math.cos(el) * math.sin(az),
                    center[1] - d * math.cos(el) * math.cos(az),
                    center[2] + d * math.sin(el))
    v = Vector((center[0] - cam.location[0], center[1] - cam.location[1],
                center[2] - cam.location[2]))
    cam.rotation_euler = v.to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    # ground
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -0.005))
    p = bpy.context.active_object
    p.name = "ZZpreview_ground"
    m = bpy.data.materials.new("ground")
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = \
        (0.6, 0.52, 0.38, 1)
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 1.0
    p.data.materials.append(m)


def merge_by_material(kind):
    """Apply modifiers, then join objects sharing a material into one mesh.
    Joined name carries the material name so kitLoader keyword logic
    (gold/glow/kiln → night emissive; reed → bob) still works."""
    objs = grab_all()
    for o in bpy.context.scene.objects:
        o.select_set(o in objs)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.convert(target="MESH")  # applies bevels
    groups = {}
    for o in grab_all():
        mat = o.data.materials[0].name if o.data.materials else "none"
        groups.setdefault(mat, []).append(o)
    merged = []
    for mat, group in groups.items():
        for o in bpy.context.scene.objects:
            o.select_set(o in group)
        bpy.context.view_layer.objects.active = group[0]
        if len(group) > 1:
            bpy.ops.object.join()
        joined = bpy.context.view_layer.objects.active
        joined.name = f"{kind}_{mat}"
        merged.append(joined)
    # Babylon axis chain lands Blender -Y on +Z (fronts faced away in game).
    # Rotate the whole kit 180° about Z and bake so facades hit Babylon -Z.
    import mathutils
    rot = mathutils.Matrix.Rotation(math.pi, 4, "Z")
    for o in merged:
        o.matrix_world = rot @ o.matrix_world
        o.select_set(True)
    bpy.context.view_layer.objects.active = merged[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return merged


for kind in KINDS:
    reset()
    P = palette()
    BUILDERS[kind](P)
    kit_objs = merge_by_material(kind)
    tris = sum(len(o.data.polygons) * 2 for o in kit_objs)  # rough (quads→2)
    print(f"BUILT {kind}: {len(kit_objs)} meshes ~{tris} tris")
    # export GLB (selection only, apply modifiers)
    for o in bpy.context.scene.objects:
        o.select_set(o in kit_objs)
    out = os.path.join(MODELS, f"{kind}.glb")
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB",
                              use_selection=True, export_apply=True,
                              export_yup=True)
    print(f"EXPORTED {out} bytes={os.path.getsize(out)}")
    # preview render
    add_preview_rig()
    bpy.context.scene.render.filepath = os.path.join(OUT, f"new-{kind}.png")
    bpy.ops.render.render(write_still=True)
print("DONE")
