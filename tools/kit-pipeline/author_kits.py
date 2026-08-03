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
       "river_clay_pit", "marsh_reed_bed", "training_grounds", "shrine",
       "ration_house", "luxury_material", "luxury_workshop", "vessel_shop",
       "reed_basket_shop", "warehouse"]
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
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    # Base color × COLOR_0 vertex jitter (painted-variation read in Babylon).
    # Wiring the attribute makes the glTF exporter emit COLOR_0.
    col = nt.nodes.new("ShaderNodeRGB")
    col.outputs[0].default_value = srgb(hexcol)
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    nt.links.new(col.outputs[0], mix.inputs[6])
    nt.links.new(attr.outputs["Color"], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
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
        # ground — aprons stay sandy so kits sit IN the desert, not on plinths
        "dirt": M("dirt_apron", "#B49873"),
        "soil": M("soil_dark", "#6B4B30"),
        "sand": M("sand_spit", "#CBB184"),
        "earth": M("earth_pack", "#BFA67E"),
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
        # crops — desaturated olive/sage family (no lime/neon reads), heads
        # wheat-tan. "amber" not "gold" — gold names get night emissive.
        "crop_g": M("crop_amber", "#C4A55C"),
        "crop_gr": M("crop_green", "#82894A"),
        "crop_dk": M("crop_deep", "#6E7A3A"),
        "crop_lt": M("crop_light", "#969256"),
        # brick
        "brick": M("brick_red", "#9A5B3C"),
        "brick_g": M("brick_grey", "#8A7259"),
        "char": M("char_dark", "#3A2E24"),
        # accents
        "gold": M("gold_leaf", "#D4A438", rough=0.45, metal=0.6),
        "blue": M("nile_blue", "#4A6E8A", rough=0.7),
        "pot": M("pottery", "#A05A34"),
        "dark": M("door_dark", "#33261C", rough=0.95),
        "ember": M("ember_glow", "#E86A18", rough=0.6,
                   emit="#FF7A20", emit_str=2.5),
        "water": M("channel_water", "#4E5E48", rough=0.35),
        "grey": M("clay_grey", "#847A6C"),
        # luxury goods
        "copper": M("copper_ingot", "#B4652F", rough=0.5, metal=0.45),
        "gem": M("gem_violet", "#7B4E93", rough=0.45),
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
    # ground apron (trimmed so the corner never kisses the market base;
    # low + sandy so the kit sits IN the desert, not on a plinth)
    box("gh_dirt_apron", 3.05, 3.05, 0.05, (0, 0, 0), P["dirt"])
    # lower story: battered terracotta mass
    lower = frustum("gh_mud_lower", 2.75, 2.45, 2.6, 2.3, 1.12, (0, 0, 0.05),
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
    # tower roof: mud-dark slab with a pale parapet rim (not one big white slab)
    box("gh_mud_towerroof", 1.24, 2.14, 0.07, (-0.62, 0, 2.7), P["mud_dk"])
    for s in (-1, 1):
        box("gh_stone_rimY", 1.2, 0.08, 0.14, (-0.62, s * 1.0, 2.73),
            P["stone"])
        box("gh_stone_rimX", 0.08, 1.92, 0.14, (-0.62 + s * 0.56, 0, 2.73),
            P["stone"])
    # small mud stair-bulkhead seated on the roof slab (was a stray white cube)
    box("gh_mud_bulkhead", 0.3, 0.36, 0.24, (-0.85, 0.55, 2.77), P["mud_tan"])
    box("gh_dark_bulkdoor", 0.2, 0.03, 0.17, (-0.85, 0.36, 2.79), P["dark"])
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
    # hanging rugs: wooden rod + rope ties + bracket arms so they read as
    # hung textiles (proud of the lattice, shaded by the thatch overhang)
    rgx, rgy = lx + 0.25, -ld / 2 - 0.035
    cyl("gh_wood_rugrod", 0.024, 0.62, (rgx, rgy, deckz + 0.275),
        P["wood_dk"], seg=7, ry=math.radians(90))
    for s in (-1, 1):
        box("gh_rope_rugtie", 0.035, 0.035, 0.1,
            (rgx + s * 0.17, rgy, deckz + 0.5), P["rope"])
        box("gh_wood_rodarm", 0.045, 0.1, 0.045,
            (rgx + s * 0.26, -ld / 2 + 0.005, deckz + 0.555), P["wood_dk"])
    box("gh_rug_hang", 0.46, 0.05, 0.5, (rgx, rgy, deckz + 0.02), P["rug"])
    rg2x, rg2y = lx - 0.62, ld / 2 + 0.035
    cyl("gh_wood_rugrod2", 0.022, 0.54, (rg2x, rg2y, deckz + 0.275),
        P["wood_dk"], seg=7, ry=math.radians(90))
    for s in (-1, 1):
        box("gh_rope_rugtie2", 0.03, 0.03, 0.1,
            (rg2x + s * 0.14, rg2y, deckz + 0.5), P["rope"])
    box("gh_wood_rodarm2", 0.045, 0.1, 0.045,
        (0.125, ld / 2 - 0.005, deckz + 0.555), P["wood_dk"])
    box("gh_rug_hang2", 0.4, 0.05, 0.44, (rg2x, rg2y, deckz + 0.06),
        P["cl_org"])

    # external stair: proud of the front face, climbing left→right to terrace
    sy = -1.5  # clear of the battered wall taper (base face ≈ -1.22)
    # dirt pad extends the apron under the flight so nothing hovers off-apron
    box("gh_dirt_stairpad", 1.95, 0.55, 0.05, (-0.85, -1.62, 0), P["dirt"])
    stairs("gh_stone_stair", 9, 0.44, 0.165, 0.185, (-1.6, sy, 0.05),
           P["stone"], along="x", sign=1)
    # solid mud stringer wall carrying the flight (outer side)
    frustum("gh_mud_stringer", 1.5, 0.13, 1.45, 0.11, 0.9,
            (-0.85, sy - 0.24, 0.05), P["mud"])
    # return wall ties the stringer's top end flush into the wall face
    box("gh_mud_stringer_ret", 0.12, 0.6, 0.9, (-0.14, -1.5, 0.05), P["mud"])
    # low landing wall at top of flight
    box("gh_stone_landing", 0.3, 0.44, 0.06, (-0.02, sy, 1.715), P["stone"])

    # door: center-right of front face
    dx = 0.32
    fy = -1.21  # front face outer plane of lower mass (approx)
    box("gh_door_recess", 0.52, 0.16, 0.8, (dx, fy - 0.02, 0.14), P["dark"])
    box("gh_stone_jambL", 0.1, 0.12, 0.9, (dx - 0.33, fy - 0.03, 0.12), P["stone_w"])
    box("gh_stone_jambR", 0.1, 0.12, 0.9, (dx + 0.33, fy - 0.03, 0.12), P["stone_w"])
    box("gh_stone_lintel", 0.78, 0.13, 0.13, (dx, fy - 0.03, 1.0), P["stone_w"])
    # gold sun disc above lintel
    cyl("gh_gold_disc", 0.09, 0.05, (dx, fy + 0.02, 1.2), P["gold"], seg=12,
        rx=math.radians(90))
    # striped awning over door: red canopy angled + 2 slim poles
    box("gh_cloth_awn_door", 0.9, 0.55, 0.045, (dx, fy - 0.28, 1.06), P["cl_red"],
        rx=math.radians(-18))
    box("gh_cloth_awn_str1", 0.9, 0.14, 0.05, (dx, fy - 0.44, 1.005), P["linen"],
        rx=math.radians(-18))
    for sxp in (dx - 0.4, dx + 0.4):
        cyl("gh_wood_awnpole", 0.025, 0.92, (sxp, fy - 0.5, 0.05), P["wood_dk"], seg=7)

    # two yellow window awnings + dark windows on the stone band (front face)
    for wx in (-0.85, 1.0):
        box("gh_win_dark", 0.3, 0.07, 0.36, (wx, -1.185, 1.3), P["dark"])
        # awning: top edge kisses the wall above the window, slopes down-out
        box("gh_cloth_awn_win", 0.44, 0.36, 0.035, (wx, -1.33, 1.6),
            P["cl_yel"], rx=math.radians(-32))
    # small dark window on the left face of the stone band
    box("gh_win_dark_side", 0.07, 0.3, 0.3, (-1.33, -0.35, 1.32), P["dark"])

    # pots at the door
    amphora("gh", dx - 0.62, fy - 0.28, 0.05, P, s=1.15)
    amphora("gh2", dx - 0.78, fy - 0.12, 0.05, P, s=0.8)
    basket("gh", dx + 0.7, fy - 0.3, 0.05, P, r=0.1, fill="crop_g")


# ---------------------------------------------------------------- MARKET
def build_market(P):
    """Board 02: colonnade hall — battered ends, heavy roof slab, awnings,
    counters with goods, amphorae, corner steps."""
    # stepped limestone base
    mb1 = box("mk_stone_base", 3.15, 2.25, 0.1, (0, 0, 0), P["stone"])
    bevel(mb1, 0.02)
    mb2 = box("mk_stone_base2", 2.98, 2.08, 0.1, (0, 0, 0.1), P["stone_w"])
    bevel(mb2, 0.02)
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

    # heavy roof slab + cornice
    roof = box("mk_mud_roofslab", 3.12, 2.24, 0.2, (0, 0, 1.25), P["mud_tan"])
    bevel(roof, 0.03)
    box("mk_stone_cornice", 3.16, 2.28, 0.05, (0, 0, 1.2), P["stone_w"])
    # low parapet rim strips around the roof edge (roof surface stays open)
    for s in (-1, 1):
        box("mk_mud_rimY", 2.9, 0.1, 0.09, (0, s * 1.02, 1.45), P["mud_dk"])
        box("mk_mud_rimX", 0.1, 1.84, 0.09, (s * 1.4, 0, 1.45), P["mud_dk"])
    # wood joist battens: thin proud strips breaking up the slab
    for i in range(5):
        box("mk_wood_batten", 0.055, 1.78, 0.035, (-1.1 + i * 0.55, 0.02, 1.45),
            P["wood_dk"])
    # roof hatch + small vent box
    box("mk_wood_hatchframe", 0.42, 0.42, 0.05, (0.72, 0.5, 1.45), P["wood_dk"])
    box("mk_dark_hatch", 0.3, 0.3, 0.045, (0.72, 0.5, 1.475), P["dark"])
    box("mk_mud_vent", 0.16, 0.16, 0.15, (-0.78, 0.55, 1.45), P["mud_tan"])
    box("mk_dark_venttop", 0.1, 0.1, 0.04, (-0.78, 0.55, 1.6), P["dark"])
    # reed mats + rolled mat on the roof surface
    box("mk_matting_roof", 0.8, 0.4, 0.05, (0.9, -0.85, 1.45), P["thatch"])
    box("mk_matting_roof2", 0.6, 0.35, 0.05, (-1.05, -0.8, 1.45), P["thatch_dk"])
    cyl("mk_thatch_roofroll", 0.055, 0.6, (-0.25, -0.7, 1.45 + 0.055 - 0.3),
        P["thatch_dk"], seg=8, ry=math.radians(90))

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
            # bed base is mud-brown soil — green rows read as planted lines
            # with visible soil gaps, never a solid green cube
            box("ef_soil_bed", bed_w + 0.06, bed_d + 0.06, 0.1,
                (cx0, cy0, 0.1), P["soil"])
            # crop rows: thin planted lines in 3 olive tones + wheat heads
            # (workers are ~0.6 shoulder height — stalks stay well below)
            rows = 9
            greens = ("crop_gr", "crop_dk", "crop_lt")
            for r in range(rows):
                ry = cy0 - bed_d / 2 + (r + 0.5) * bed_d / rows
                hh = 0.13 + 0.035 * (r % 3) + rnd.random() * 0.03
                # base in 4 jittered segments — a planted row, never a plank
                for si in range(4):
                    shh = hh * (0.75 + rnd.random() * 0.5)
                    box("ef_crop_rowbase", bed_w * 0.22, bed_d / rows * 0.44,
                        shh,
                        (cx0 + (si - 1.5) * bed_w * 0.245,
                         ry + (rnd.random() - 0.5) * 0.03, 0.2),
                        P[greens[(r + si) % 3]], rz=(rnd.random() - 0.5) * 0.1)
                    if rnd.random() > 0.35:
                        box("ef_crop_rowhead", bed_w * 0.16,
                            bed_d / rows * 0.3, 0.05,
                            (cx0 + (si - 1.5) * bed_w * 0.245, ry,
                             0.2 + shh), P["crop_g"])
            for _ in range(14):
                tx = cx0 + (rnd.random() - 0.5) * bed_w * 0.9
                ty = cy0 + (rnd.random() - 0.5) * bed_d * 0.9
                th = 0.26 + rnd.random() * 0.13
                box("ef_crop_tuft", 0.038, 0.038, th, (tx, ty, 0.24),
                    P[greens[rnd.randrange(3)]] if rnd.random() > 0.25
                    else P["crop_g"], rz=rnd.random())

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
    # stone footing under the water-side edge so the spit never cantilevers
    for py in (-1.1, 0, 1.1):
        box("hb_stone_footing", 0.22, 0.5, 0.14, (-1.6, py, -0.06), P["stone"])

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

    # moored barge alongside arm (hull settled low in the water, z≈0.04)
    bx0, by0, bz0 = 0.55, -1.15, 0.04
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
    # timber tripod hoist straddling the pit, rope down to a hanging basket
    tilt, ang0 = 0.66, math.radians(90)
    for k in range(3):
        ang = ang0 + k * math.radians(120)
        cyl("cp_wood_tripodleg", 0.035, 1.32, (0.36 * math.cos(ang),
            0.36 * math.sin(ang), 0.21), P["wood_dk"], seg=7,
            ry=tilt, rz=ang + math.pi)
    cyl("cp_rope_lash", 0.075, 0.09, (0, 0, 1.24), P["rope"], seg=8)
    cyl("cp_rope_hoist", 0.014, 0.7, (0, 0, 0.56), P["rope"], seg=6)
    basket("cp_hang", 0, 0, 0.47, P, r=0.09, h=0.11, fill="grey")
    # taller spoil mound on the back-right rim (dug earth, clay cap)
    cyl("cp_earth_spoil", 0.52, 0.8, (1.0, 0.95, 0.1), P["earth"], seg=11,
        rtop=0.07)
    cyl("cp_mud_spoilfoot", 0.6, 0.14, (1.0, 0.95, 0.1), P["mud_tan"], seg=11,
        rtop=0.5)
    sphere("cp_grey_spoilcap", 0.09, (1.02, 0.92, 0.86), P["grey"], seg=6)
    # low mudbrick wall segments on the back rim — built edge of the works
    box("cp_mud_backwall", 1.45, 0.16, 0.34, (-0.55, 1.3, 0.1), P["mud"])
    box("cp_mud_backwallcap", 1.49, 0.2, 0.05, (-0.55, 1.3, 0.44), P["mud_dk"])
    box("cp_mud_backwall2", 0.55, 0.16, 0.24, (0.35, 1.3, 0.1), P["mud"])
    # clay ball piles + baskets on the rim
    for i, (px, py) in enumerate(((-1.1, 0.9), (-0.85, 1.1), (1.0, -0.95))):
        sphere(f"cp_grey_clay{i}", 0.1, (px, py, 0.1), P["grey"], seg=7)
        sphere(f"cp_grey_clay{i}b", 0.075, (px + 0.16, py - 0.08, 0.1),
               P["grey"], seg=7)
    basket("cp", 1.28, -0.15, 0.1, P, r=0.12, fill="grey")
    basket("cp2", 1.1, 0.12, 0.1, P, r=0.1, fill="grey")
    amphora("cp", -1.2, -0.7, 0.1, P, s=0.9)
    # digging stakes
    for px, py in ((0.42, 0.5), (-0.7, 0.55)):
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
    greens = ("crop_gr", "crop_dk", "crop_lt")
    for qx in (-1, 1):
        for qy in (-1, 1):
            cx0, cy0 = qx * 0.72, qy * 0.72
            # rounded clump: stacked shrinking boxes in 3 greens, jittered so
            # the top reads as a mound, not one flat cube
            jx = (rnd.random() - 0.5) * 0.1
            jy = (rnd.random() - 0.5) * 0.1
            for mi in range(5):
                mw = 0.55 - mi * 0.07
                box(f"mr_rush_mass{mi}", mw, mw * 0.9, 0.12,
                    (cx0 + jx * mi + (rnd.random() - 0.5) * 0.18,
                     cy0 + jy * mi + (rnd.random() - 0.5) * 0.18,
                     0.12 + mi * 0.075),
                    P[greens[mi % 3]], rz=rnd.random() * 0.8)
            # stalks: short and thin — workers are ~0.6 at the shoulder
            for _ in range(12):
                tx = cx0 + (rnd.random() - 0.5) * 0.8
                ty = cy0 + (rnd.random() - 0.5) * 0.8
                th = 0.32 + rnd.random() * 0.22
                cyl("mr_rush_stalk", 0.018, th, (tx, ty, 0.14),
                    P[greens[rnd.randrange(3)]], seg=5)
                if rnd.random() > 0.55:
                    box("mr_crop_head", 0.04, 0.04, 0.07, (tx, ty, 0.14 + th),
                        P["crop_g"])
    # cut bundle stack on the near rim + basket
    for i in range(3):
        cyl(f"mr_thatch_bundle{i}", 0.07, 0.55, (-1.15 + i * 0.17, -1.42, 0.14),
            P["thatch"], seg=7, ry=math.radians(90))
    cyl("mr_thatch_bundle_top", 0.07, 0.5, (-1.06, -1.42, 0.27), P["thatch_dk"],
        seg=7, ry=math.radians(90))
    basket("mr", 1.2, -1.3, 0.1, P, r=0.1, fill="crop_gr")


# ---------------------------------------------------------------- TRAINING GROUNDS
def build_training_grounds(P):
    """Board 05: open packed-earth yard, low mud wall on two sides with blue
    band, archery targets on tripods, training dummies, spear rack, shade
    awning, water jars. Low silhouette, tallest ~1.2."""
    base = box("tg_earth_base", 3.3, 3.3, 0.08, (0, 0, 0), P["earth"])
    bevel(base, 0.02)
    # worn yard patch (subtle tonal break in the open ground)
    box("tg_sand_worn", 1.7, 1.5, 0.008, (-0.1, -0.25, 0.08), P["sand"])

    # low mudbrick wall: back (+Y) and left (-X), with blue painted band + cap
    box("tg_mud_wallB", 3.2, 0.2, 0.36, (0, 1.52, 0.08), P["mud"])
    box("tg_blue_bandB", 3.22, 0.04, 0.055, (0, 1.43, 0.22), P["blue"])
    box("tg_mud_capB", 3.26, 0.24, 0.05, (0, 1.52, 0.44), P["mud_dk"])
    box("tg_mud_wallL", 0.2, 3.15, 0.355, (-1.52, -0.03, 0.08), P["mud"])
    box("tg_blue_bandL", 0.04, 3.1, 0.055, (-1.43, -0.05, 0.22), P["blue"])
    # cap stops short of the corner so it never z-fights the back cap
    box("tg_mud_capL", 0.24, 2.98, 0.05, (-1.52, -0.14, 0.435), P["mud_dk"])

    # 3 archery targets: straw disc on splayed tripod, facing the yard (-Y)
    for tx in (-0.72, 0.02, 0.76):
        ty = 1.0
        zc = 0.42  # disc center height
        # tripod: two splayed front legs + one raked back leg
        for s in (-1, 1):
            box("tg_wood_leg", 0.04, 0.04, 0.6, (tx + s * 0.11, ty + 0.02, 0.05),
                P["wood_dk"], ry=math.radians(s * 12))
        box("tg_wood_legback", 0.04, 0.04, 0.6, (tx, ty + 0.14, 0.05),
            P["wood_dk"], rx=math.radians(-22))
        # straw disc + concentric painted rings (loc z = center - h/2 for rx=90)
        cyl("tg_thatch_disc", 0.2, 0.055, (tx, ty, zc - 0.0275), P["thatch"],
            seg=14, rx=math.radians(90))
        cyl("tg_ringmark", 0.125, 0.022, (tx, ty - 0.02, zc - 0.011),
            P["cl_red"], seg=12, rx=math.radians(90))
        cyl("tg_ringmark_c", 0.05, 0.02, (tx, ty - 0.032, zc - 0.01),
            P["linen"], seg=9, rx=math.radians(90))

    # round shields leaning on the back wall (board 05 shield cluster)
    for sx, mm in ((-1.15, "cl_red"), (1.25, "blue")):
        cyl("tg_wood_shield", 0.17, 0.045, (sx, 1.34, 0.125), P["wood"],
            seg=12, rx=math.radians(72))
        cyl("tg_boss", 0.07, 0.02, (sx, 1.285, 0.15), P[mm], seg=9,
            rx=math.radians(72))

    # 2 training dummies: post + crossbar + wrapped linen torso + rope belt
    for dx, dy, rr in ((-0.85, -0.2, 0.25), (-0.55, -1.0, -0.2)):
        cyl("tg_wood_dpost", 0.045, 0.95, (dx, dy, 0.08), P["wood_dk"], seg=8)
        box("tg_wood_dbar", 0.5, 0.055, 0.055, (dx, dy, 0.68), P["wood"],
            rz=rr)
        cyl("tg_linen_torso", 0.105, 0.36, (dx, dy, 0.42), P["linen"], seg=9)
        torus("tg_rope_belt", 0.105, 0.02, (dx, dy, 0.53), P["rope"])
        sphere("tg_linen_head", 0.07, (dx, dy, 0.92), P["linen"], seg=7)

    # spear rack against the left wall: posts + rail + leaning spears
    rx0, ry0 = -1.28, 0.35
    for py in (ry0 - 0.5, ry0 + 0.5):
        box("tg_wood_rackpost", 0.05, 0.05, 0.72, (rx0, py, 0.08), P["wood_dk"])
    box("tg_wood_rackrail", 0.06, 1.1, 0.05, (rx0, ry0, 0.75), P["wood"])
    for i in range(7):
        py = ry0 - 0.42 + i * 0.14
        cyl("tg_wood_spear", 0.013, 1.02, (rx0 + 0.09, py, 0.06), P["wood"],
            seg=6, ry=math.radians(-9))
        box("tg_grey_tip", 0.03, 0.03, 0.09, (rx0 + 0.005, py, 1.06),
            P["grey"], ry=math.radians(-9))

    # shade awning front-right: 4 poles + tilted mat, jars beneath
    ax, ay = 0.95, -0.95
    for px, py in ((ax - 0.5, ay - 0.42), (ax + 0.5, ay - 0.42),
                   (ax - 0.5, ay + 0.42), (ax + 0.5, ay + 0.42)):
        cyl("tg_wood_awnpole", 0.03, 0.95 + (0.14 if py > ay else 0),
            (px, py, 0.08), P["wood_dk"], seg=7)
    box("tg_matting_shade", 1.25, 1.05, 0.045, (ax, ay, 1.06), P["thatch"],
        rx=math.radians(-8))
    amphora("tg_j1", ax - 0.25, ay + 0.1, 0.08, P, s=1.1)
    amphora("tg_j2", ax + 0.05, ay - 0.12, 0.08, P, s=0.85)
    basket("tg", ax + 0.32, ay + 0.18, 0.08, P, r=0.1, fill="crop_g")

    # banner pole near the right edge (artboard standard)
    cyl("tg_wood_banpole", 0.028, 1.15, (1.45, 0.4, 0.08), P["wood_dk"], seg=7)
    box("tg_linen_banner", 0.05, 0.3, 0.42, (1.45, 0.42, 0.72), P["linen"])
    box("tg_cl_emblem", 0.055, 0.16, 0.14, (1.45, 0.42, 0.85), P["cl_red"])

    # floor props: practice mat + spare bundle + water jar row by back wall
    box("tg_matting_floor", 0.75, 0.55, 0.02, (0.45, 0.15, 0.08), P["thatch_dk"])
    cyl("tg_thatch_bundle", 0.07, 0.5, (1.15, 1.28, 0.145), P["thatch"],
        seg=7, ry=math.radians(90))
    amphora("tg_j3", -1.25, -1.2, 0.08, P, s=0.95)


# ---------------------------------------------------------------- SHRINE
def build_shrine(P):
    """Board 06: stepped stone platform, battered white naos with cavetto
    cornice, gold-trimmed dark doorway, gold dome crest (glows at night),
    obelisks with gold tips, offering bowls, rush bundles."""
    # stepped platform
    b1 = box("sh_stone_plat1", 2.6, 2.6, 0.15, (0, 0, 0), P["stone"])
    bevel(b1, 0.02)
    b2 = box("sh_stone_plat2", 2.3, 2.3, 0.14, (0, 0, 0.15), P["stone_w"])
    bevel(b2, 0.02)
    box("sh_stone_plat3", 2.0, 2.0, 0.12, (0, 0, 0.29), P["stone"])
    top = 0.41
    # front stairs to platform (front = -Y)
    stairs("sh_stone_stair", 4, 0.92, 0.16, 0.103, (0, -1.95, 0),
           P["stone_w"], along="y", sign=1)

    # blue wave band on the platform front (board 06 base trim)
    box("sh_blue_platband", 2.05, 0.04, 0.05, (0, -1.16, 0.2), P["blue"])

    # naos: battered white-stone chapel
    naos = frustum("sh_stone_naos", 1.7, 1.45, 1.48, 1.24, 1.05,
                   (0, 0.18, top), P["stone_w"])
    bevel(naos, 0.02)
    # blue painted frieze band under the cornice
    box("sh_blue_frieze", 1.56, 1.31, 0.1, (0, 0.18, top + 0.9), P["blue"])
    # cavetto cornice: strong outward flare + cap slab tucked inside the flare
    frustum("sh_stone_cavetto", 1.52, 1.28, 1.86, 1.6, 0.18,
            (0, 0.18, top + 1.05), P["stone"])
    box("sh_stone_cap", 1.78, 1.52, 0.06, (0, 0.18, top + 1.23), P["stone_w"])
    # gold dome crest — 'gold' mesh glows at night
    cyl("sh_gold_crestring", 0.21, 0.07, (0, 0.18, top + 1.29), P["gold"], seg=12)
    sphere("sh_gold_crest", 0.19, (0, 0.18, top + 1.32), P["gold"], seg=10)

    # doorway: dark recess + gold jambs/lintel on the front face
    fy = -0.55
    box("sh_door_recess", 0.46, 0.16, 0.72, (0, fy + 0.03, top + 0.05), P["dark"])
    box("sh_gold_jambL", 0.07, 0.09, 0.84, (-0.3, fy, top + 0.02), P["gold"])
    box("sh_gold_jambR", 0.07, 0.09, 0.84, (0.3, fy, top + 0.02), P["gold"])
    box("sh_gold_lintel", 0.7, 0.09, 0.09, (0, fy, top + 0.86), P["gold"])
    # offering mat before the door
    box("sh_matting_door", 0.52, 0.4, 0.02, (0, -0.98, top), P["thatch"])

    # flanking obelisks with gold pyramidions
    for sx in (-1, 1):
        ox, oy = sx * 0.78, -0.72
        box("sh_stone_obase", 0.24, 0.24, 0.08, (ox, oy, top), P["stone"])
        frustum("sh_stone_obelisk", 0.17, 0.17, 0.1, 0.1, 0.72,
                (ox, oy, top + 0.08), P["stone_w"])
        frustum("sh_gold_otip", 0.11, 0.11, 0.015, 0.015, 0.14,
                (ox, oy, top + 0.8), P["gold"])

    # offering bowls + incense stand on steps and platform
    cyl("sh_pot_bowl", 0.1, 0.07, (0.55, -1.05, top), P["pot"], seg=9,
        rtop=0.12)
    cyl("sh_crop_offer", 0.085, 0.035, (0.55, -1.05, top + 0.055), P["crop_g"],
        seg=9)
    cyl("sh_pot_bowl2", 0.08, 0.06, (-0.6, -1.55, 0.15), P["pot"], seg=9,
        rtop=0.095)
    cyl("sh_char_incense", 0.045, 0.2, (0.75, -1.5, 0.15), P["char"], seg=7,
        rtop=0.06)
    # cut rush bundles laid on the platform edge (board 06 left side)
    for i in range(2):
        cyl(f"sh_crop_rush{i}", 0.055, 0.75, (-0.85 + i * 0.1, 0.85 - i * 0.22,
            0.29 + 0.055 - 0.375), P["crop_gr"], seg=6, ry=math.radians(90),
            rz=math.radians(18))
    # small side stone: stela against naos flank
    box("sh_stone_stela", 0.08, 0.3, 0.4, (0.82, 0.35, top), P["stone"])


# ---------------------------------------------------------------- RATION HOUSE
def build_ration_house(P):
    """Board 09: mudbrick bakehouse hall + granary annex with beehive silos,
    arched oven mouth, serving counter with awning, bread, sacks, baskets."""
    base = box("rh_dirt_apron", 2.8, 2.7, 0.05, (0, 0, 0), P["dirt"])
    bevel(base, 0.02)

    # main hall (battered, board-09 sloped mass)
    hall = frustum("rh_mud_hall", 1.75, 1.55, 1.55, 1.35, 1.05,
                   (-0.42, 0.18, 0.05), P["mud_tan"])
    bevel(hall, 0.025)
    box("rh_stone_string", 1.72, 1.52, 0.06, (-0.42, 0.18, 0.78), P["stone"])
    box("rh_mud_parapet", 1.6, 1.4, 0.08, (-0.42, 0.18, 1.12), P["mud_dk"])
    box("rh_mud_roof", 1.48, 1.28, 0.06, (-0.42, 0.18, 1.12), P["mud"])
    # chimney stub back corner (board 09)
    box("rh_mud_chimney", 0.2, 0.2, 0.32, (-1.0, 0.7, 1.12), P["mud_tan"])
    box("rh_dark_chimtop", 0.12, 0.12, 0.05, (-1.0, 0.7, 1.44), P["dark"])
    # roof drying: mat + two grain rows (roll + third row cut for legibility)
    box("rh_matting_roof", 0.6, 0.5, 0.03, (-0.42, 0.1, 1.18), P["thatch"])
    for i in range(2):
        box("rh_crop_dryrow", 0.5, 0.1, 0.045, (-0.42, -0.02 + i * 0.2, 1.2),
            P["crop_g"], rz=0.05 * (i * 2 - 1))

    # arched oven mouth on the front face (pot arch ring + dark throat +
    # warm cloth-orange inset suggesting the fire, no emissive)
    fy = -0.62
    cyl("rh_pot_ovenarch", 0.34, 0.1, (-0.42, fy - 0.03, 0.36 - 0.05), P["pot"],
        seg=16, rx=math.radians(90))
    cyl("rh_dark_oventhroat", 0.24, 0.08, (-0.42, fy - 0.05, 0.36 - 0.04),
        P["dark"], seg=14, rx=math.radians(90))
    cyl("rh_cl_ovenwarm", 0.13, 0.03, (-0.42, fy - 0.115, 0.3 - 0.015),
        P["cl_org"], seg=10, rx=math.radians(90))
    box("rh_stone_ovenshelf", 0.66, 0.26, 0.1, (-0.42, fy - 0.14, 0.05),
        P["stone"])
    sphere("rh_linen_bread", 0.06, (-0.56, fy - 0.16, 0.17), P["linen"], seg=7)
    sphere("rh_linen_bread2", 0.05, (-0.28, fy - 0.18, 0.17), P["linen"], seg=7)

    # door right of the oven (dark recess + wood lintel); the apron strip in
    # front stays clear so the entrance reads (ladder cut — crowded the face)
    box("rh_dark_door", 0.38, 0.22, 0.64, (0.18, fy - 0.01, 0.05), P["dark"])
    box("rh_wood_doorlintel", 0.5, 0.2, 0.09, (0.18, fy + 0.01, 0.71),
        P["wood_dk"])

    # granary annex + beehive silos (cyl taper + sphere cap)
    annex = frustum("rh_mud_annex", 1.0, 1.2, 0.9, 1.1, 0.58, (0.85, 0.6, 0.05),
                    P["mud"])
    bevel(annex, 0.02)
    box("rh_mud_annexroof", 0.92, 1.12, 0.06, (0.85, 0.6, 0.65), P["mud_dk"])
    # silos enlarged so the beehive silhouette leads the read
    silos = ((1.02, 0.15, 1.18), (0.68, -0.44, 1.02), (1.12, -0.86, 0.86))
    for i, (sx, sy, s) in enumerate(silos):
        cyl(f"rh_mud_silo{i}", 0.27 * s, 0.52 * s, (sx, sy, 0.05), P["mud_tan"],
            seg=12, rtop=0.2 * s)
        sphere(f"rh_mud_silocap{i}", 0.2 * s, (sx, sy, 0.05 + 0.52 * s - 0.16 * s),
               P["mud_tan"], seg=10)
        box(f"rh_dark_silohatch{i}", 0.075 * s, 0.05, 0.085 * s,
            (sx, sy - 0.245 * s, 0.3 * s), P["dark"])
        cyl(f"rh_mud_silobase{i}", 0.3 * s, 0.05, (sx, sy, 0.05), P["mud_dk"],
            seg=12)

    # serving counter with awning (front-left, fully on the apron)
    cx, cy = -0.95, -0.88
    box("rh_mud_counter", 0.8, 0.4, 0.46, (cx, cy, 0.05), P["mud_dk"])
    box("rh_linen_countertop", 0.86, 0.46, 0.04, (cx, cy, 0.53), P["linen"])
    box("rh_wood_breadboard", 0.34, 0.22, 0.03, (cx - 0.18, cy - 0.02, 0.57),
        P["wood"])
    sphere("rh_crop_loaf", 0.05, (cx - 0.24, cy - 0.04, 0.6), P["crop_g"], seg=7)
    sphere("rh_crop_loaf2", 0.045, (cx - 0.1, cy + 0.02, 0.6), P["crop_g"], seg=7)
    basket("rh_c", cx + 0.24, cy + 0.04, 0.57, P, r=0.09, fill="crop_g")
    box("rh_cloth_awn", 0.95, 0.52, 0.04, (cx, cy - 0.22, 0.96), P["cl_org"],
        rx=math.radians(-24))
    for sxp in (cx - 0.42, cx + 0.42):
        cyl("rh_wood_awnpole", 0.025, 0.9, (sxp, cy - 0.42, 0.05),
            P["wood_dk"], seg=7)

    # two readable clusters, open apron kept in front of the door:
    # counter cluster gets one sack + one basket; a jar tucks by the silos
    s = box("rh_linen_sack0", 0.24, 0.2, 0.2, (-1.05, -1.24, 0.05), P["linen"],
            rz=0.35)
    bevel(s, 0.04)
    basket("rh_g1", -0.65, -1.16, 0.05, P, r=0.12, fill="crop_g")
    amphora("rh_j1", 1.3, -0.34, 0.05, P, s=1.1)


# ---------------------------------------------------------------- LUXURY MATERIAL
def build_luxury_material(P):
    """Board 07 raw side: stone/ingot yard — heavy rack, white-stone block
    stacks, copper ingot piles, gem crate, rope-bound bundles, canopy,
    workbench."""
    base = box("lm_dirt_base", 2.8, 2.8, 0.08, (0, 0, 0), P["dirt"])
    bevel(base, 0.02)
    box("lm_stone_pad", 1.5, 1.2, 0.05, (-0.45, -0.35, 0.08), P["stone"])

    # heavy material rack along the back wall: chunky double-row post frame,
    # thick planked shelves with support rails — every item visibly seated.
    # Top shelf surface stays <= 0.8 and the side posts rise ABOVE the goods
    # so nothing reads detached at the in-game high-iso camera (az≈142).
    ry0 = 1.05
    for px in (-1.12, 0.0, 1.12):
        for py in (ry0 - 0.22, ry0 + 0.22):
            box("lm_wood_rackpost", 0.1, 0.1, 1.02, (px, py, 0.08),
                P["wood_dk"])
    for zz in (0.36, 0.70):
        # support rails under the shelf, spanning the posts front and back
        box("lm_wood_shelfrail", 2.34, 0.07, 0.07, (0, ry0 - 0.22, zz - 0.09),
            P["wood_dk"])
        box("lm_wood_shelfrail2", 2.34, 0.07, 0.07, (0, ry0 + 0.22, zz - 0.09),
            P["wood_dk"])
        box("lm_wood_shelf", 2.4, 0.58, 0.1, (0, ry0, zz), P["wood"])
    # side frames capping each post pair above the goods (visible from -Z iso)
    for px in (-1.12, 0.0, 1.12):
        box("lm_wood_sidecap", 0.12, 0.56, 0.08, (px, ry0, 1.06), P["wood_dk"])
    # shelf goods seated flat on the shelf tops (lower top 0.46, upper 0.80)
    for i in range(3):
        box("lm_stone_shelfblock", 0.32, 0.24, 0.2, (-0.85 + i * 0.36, ry0, 0.46),
            P["stone_w"], rz=0.06 * (i - 1))
    for i in range(4):
        box("lm_copper_shelfingot", 0.2, 0.1, 0.07, (0.45 + (i % 2) * 0.26, ry0
            - 0.06 + (i // 2) * 0.14, 0.46), P["copper"], rz=0.1 * (i % 2))
    # upper shelf stays EMPTY — anything up there reads as floating against
    # the desert beyond the pad at the game camera (judge R2-R4)
    # ground pallet with spare copper stock in front of the rack — ties the
    # metal read to the ground plane
    box("lm_wood_pallet", 0.62, 0.4, 0.06, (1.0, 0.55, 0.08), P["wood"])
    for i in range(3):
        box("lm_copper_palingot", 0.24, 0.11, 0.08,
            (0.88 + (i % 2) * 0.26, 0.48 + (i // 2) * 0.13, 0.14), P["copper"],
            rz=0.08 * i)

    # white-stone block stacks (left, 2 courses + offset cap)
    sx0, sy0 = -1.0, -0.15
    for c, n in ((0, 2), (1, 2)):
        for i in range(n):
            box("lm_stone_block", 0.52, 0.36, 0.26,
                (sx0 + (i - 0.5) * 0.56, sy0, 0.08 + c * 0.26), P["stone_w"],
                rz=0.04 * (c + i))
    box("lm_stone_blockcap", 0.5, 0.34, 0.24, (sx0 - 0.1, sy0 + 0.05, 0.6),
        P["stone_w"], rz=0.12)

    # copper ingot piles: crosswise courses (front-center)
    def ingot_pile(px, py, courses):
        for c in range(courses):
            n = courses - c
            for i in range(n):
                if c % 2 == 0:
                    box("lm_copper_pile", 0.3, 0.13, 0.085,
                        (px + (i - (n - 1) / 2) * 0.15, py, 0.08 + c * 0.085),
                        P["copper"], rz=math.radians(90))
                else:
                    box("lm_copper_pile", 0.3, 0.13, 0.085,
                        (px, py + (i - (n - 1) / 2) * 0.15, 0.08 + c * 0.085),
                        P["copper"])
    ingot_pile(-0.12, -0.95, 4)
    ingot_pile(0.38, -1.12, 2)

    # gem crate: wood crate + violet gem fill + loose gems
    gx, gy = 0.85, -0.55
    box("lm_wood_crate", 0.4, 0.4, 0.24, (gx, gy, 0.08), P["wood"])
    box("lm_wood_craterim", 0.44, 0.44, 0.05, (gx, gy, 0.3), P["wood_dk"])
    box("lm_gem_fill", 0.32, 0.32, 0.06, (gx, gy, 0.3), P["gem"])
    sphere("lm_gem_loose", 0.045, (gx - 0.07, gy + 0.05, 0.36), P["gem"], seg=6)
    sphere("lm_gem_loose2", 0.04, (gx + 0.08, gy - 0.06, 0.36), P["gem"], seg=6)

    # rope-bound upright bundles (right side)
    for i, (px, py, s) in enumerate(((1.15, 0.12, 1.0), (0.58, 0.38, 0.85))):
        cyl(f"lm_thatch_bund{i}", 0.12 * s, 0.55 * s, (px, py, 0.08),
            P["thatch"], seg=8)
        cyl(f"lm_rope_bind{i}", 0.13 * s, 0.05, (px, py, 0.08 + 0.3 * s),
            P["rope"], seg=8)
        cyl(f"lm_rope_bind{i}b", 0.13 * s, 0.05, (px, py, 0.08 + 0.12 * s),
            P["rope"], seg=8)

    # shade canopy over the crate corner
    for px, py in ((0.55, -1.2), (1.25, -1.2), (0.55, -0.15), (1.25, -0.15)):
        cyl("lm_wood_canpole", 0.028, 0.9 + (0.1 if py > -0.6 else 0),
            (px, py, 0.08), P["wood_dk"], seg=7)
    box("lm_matting_canopy", 0.95, 1.3, 0.045, (0.9, -0.68, 1.0), P["thatch"],
        rx=math.radians(-6))
    box("lm_wood_canfascia", 0.98, 0.06, 0.055, (0.9, -1.31, 0.94),
        P["wood_dk"], rx=math.radians(-6))

    # low workbench + tools + stone chunks
    wx, wy = -0.5, -1.05
    box("lm_wood_bench", 0.7, 0.34, 0.32, (wx, wy, 0.08), P["wood"])
    box("lm_wood_benchtop", 0.76, 0.4, 0.04, (wx, wy, 0.4), P["wood_dk"])
    box("lm_char_chisel", 0.16, 0.03, 0.025, (wx - 0.15, wy + 0.04, 0.44),
        P["char"], rz=0.4)
    box("lm_wood_mallet", 0.09, 0.05, 0.06, (wx + 0.12, wy - 0.05, 0.44),
        P["wood_dk"])
    sphere("lm_grey_chunk", 0.07, (wx + 0.24, wy + 0.08, 0.44), P["grey"], seg=6)
    basket("lm", -1.15, -1.05, 0.08, P, r=0.11, fill="grey")


# ---------------------------------------------------------------- LUXURY WORKSHOP
def build_luxury_workshop(P):
    """Board 07 craft side: mudbrick body with wide open front, interior
    bench + tools, hearth ('hearth_glow' night ember), gold display shelf
    ('gold_display'), striped awning, chimney."""
    hearth_glow = M("hearth_glow", "#E86A18", rough=0.6, emit="#FF7A20",
                    emit_str=2.5)
    gold_disp = M("gold_display", "#D4A438", rough=0.45, metal=0.6)

    base = box("lw_dirt_base", 2.7, 2.6, 0.08, (0, 0, 0), P["dirt"])
    bevel(base, 0.02)
    box("lw_stone_floor", 2.1, 1.6, 0.05, (0, -0.3, 0.08), P["stone"])

    # shallow U body pushed back so the craft yard stays visible in-game
    bk = frustum("lw_mud_back", 2.3, 0.38, 2.18, 0.3, 1.18, (0, 0.95, 0.08),
                 P["mud"])
    bevel(bk, 0.02)
    for sx in (-1, 1):
        w = frustum("lw_mud_side", 0.38, 1.4, 0.3, 1.3, 1.18,
                    (sx * 0.96, 0.42, 0.08), P["mud"])
        bevel(w, 0.02)
        # stone corner pier at the open front (board 07 trim)
        box("lw_stone_pier", 0.22, 0.22, 1.26, (sx * 1.0, -0.24, 0.08),
            P["stone"])
    # roof slab + cornice + parapet (covers the body only, not the yard)
    box("lw_stone_cornice", 2.42, 1.62, 0.07, (0, 0.42, 1.26), P["stone_w"])
    roof = box("lw_mud_roofslab", 2.3, 1.52, 0.12, (0, 0.42, 1.33), P["mud_tan"])
    bevel(roof, 0.03)
    box("lw_mud_parapet", 2.34, 0.14, 0.1, (0, 1.08, 1.45), P["mud_dk"])
    # chimney rising off the back roof (board 07 flared stack)
    cyl("lw_pot_chimney", 0.11, 0.6, (0.72, 0.85, 1.4), P["pot"], seg=9,
        rtop=0.08)
    cyl("lw_pot_chimflare", 0.08, 0.16, (0.72, 0.85, 2.0), P["pot"], seg=9,
        rtop=0.14)

    # workbench in the open yard, tools + dye bowl on top
    bx0, by0 = -0.42, -0.62
    box("lw_wood_bench", 0.85, 0.4, 0.42, (bx0, by0, 0.13), P["wood"])
    box("lw_wood_benchtop", 0.92, 0.46, 0.04, (bx0, by0, 0.55), P["wood_dk"])
    box("lw_char_tool", 0.18, 0.03, 0.03, (bx0 - 0.2, by0, 0.59), P["char"],
        rz=0.5)
    cyl("lw_pot_dyebowl", 0.07, 0.06, (bx0 + 0.15, by0 + 0.05, 0.59), P["pot"],
        seg=9, rtop=0.085)
    cyl("lw_gem_dye", 0.055, 0.02, (bx0 + 0.15, by0 + 0.05, 0.64), P["gem"],
        seg=8)

    # hearth kiln in the yard front-right, ember mouth faces the viewer
    hx, hy = 0.62, -0.55
    frustum("lw_brick_hearth", 0.55, 0.5, 0.4, 0.36, 0.55, (hx, hy, 0.13),
            P["brick"])
    box("lw_char_hearthtop", 0.32, 0.28, 0.06, (hx, hy, 0.68), P["char"])
    box("lw_dark_hearthmouth", 0.24, 0.07, 0.22, (hx, hy - 0.27, 0.2), P["dark"])
    box("lw_hearth_glow", 0.17, 0.05, 0.14, (hx, hy - 0.295, 0.22), hearth_glow)

    # gold display: wall-backed shelf low against the rear wall — a tall
    # freestanding rack read as "gold floating in the sky" from behind
    # (its thin posts vanish over the roofline at the game camera)
    dy = 0.62
    for px in (-0.85, -0.05):
        box("lw_wood_disppost", 0.06, 0.06, 0.62, (px, dy, 0.13), P["wood_dk"])
    box("lw_wood_dispshelf", 0.95, 0.2, 0.04, (-0.45, dy, 0.5), P["wood"])
    box("lw_gold_ditem1", 0.16, 0.11, 0.12, (-0.72, dy, 0.54), gold_disp)
    cyl("lw_gold_ditem2", 0.05, 0.15, (-0.42, dy, 0.54), gold_disp, seg=8)
    sphere("lw_gold_ditem3", 0.05, (-0.18, dy, 0.54), gold_disp, seg=7)

    # striped cloth awning sloping off the roof edge over the yard
    box("lw_cloth_awn", 1.95, 0.72, 0.04, (0, -0.62, 1.2), P["cl_yel"],
        rx=math.radians(-17))
    box("lw_blue_awnstripe", 1.96, 0.2, 0.045, (0, -0.85, 1.13),
        P["blue"], rx=math.radians(-17))
    for sx in (-0.85, 0.85):
        cyl("lw_wood_awnpole", 0.026, 1.06, (sx, -0.95, 0.08), P["wood_dk"],
            seg=7)

    # yard props: big dye pot, gem basket, amphora
    cyl("lw_pot_bigdye", 0.13, 0.18, (-1.13, -0.85, 0.08), P["pot"], seg=10,
        rtop=0.15)
    cyl("lw_gem_dyefill", 0.11, 0.03, (-1.13, -0.85, 0.25), P["gem"], seg=9)
    basket("lw", 1.05, -1.0, 0.08, P, r=0.11, fill="gem")
    amphora("lw_a", 1.18, -0.35, 0.08, P, s=0.95)


# ---------------------------------------------------------------- VESSEL SHOP
def build_vessel_shop(P):
    """Anchors 03 kiln + 02 shopfront: mini stepped pottery kiln with
    'kiln_glow' ember, hero amphora racks (10 pots), shopfront counter +
    awning."""
    kiln_glow = M("kiln_glow", "#E86A18", rough=0.6, emit="#FF7A20",
                  emit_str=2.5)

    base = box("vs_earth_base", 2.6, 2.6, 0.08, (0, 0, 0), P["earth"])
    bevel(base, 0.02)

    # stall: small mudbrick shop, back-left
    st = frustum("vs_mud_stall", 1.35, 1.05, 1.25, 0.95, 0.92,
                 (-0.55, 0.65, 0.08), P["mud"])
    bevel(st, 0.02)
    box("vs_stone_cornice", 1.38, 1.08, 0.06, (-0.55, 0.65, 1.0), P["stone"])
    box("vs_mud_roof", 1.22, 0.92, 0.06, (-0.55, 0.65, 1.06), P["mud_dk"])
    box("vs_dark_door", 0.34, 0.09, 0.58, (-0.55, 0.13, 0.12), P["dark"])
    box("vs_stone_lintel", 0.46, 0.07, 0.07, (-0.55, 0.12, 0.72), P["stone_w"])
    # display pots on the stall roof
    amphora("vs_r1", -0.8, 0.55, 1.12, P, s=0.7)
    amphora("vs_r2", -0.32, 0.72, 1.12, P, s=0.6)

    # mini stepped kiln (board 03 language), back-right
    kx, ky = 0.78, 0.72
    z = 0.08
    for w, d, h in ((0.95, 0.9, 0.36), (0.74, 0.7, 0.3), (0.5, 0.47, 0.26)):
        f = frustum("vs_brick_kiln", w, d, w * 0.8, d * 0.8, h, (kx, ky, z),
                    P["brick"])
        bevel(f, 0.02)
        z += h
    box("vs_char_stain", 0.34, 0.33, 0.14, (kx, ky, z - 0.16), P["char"])
    cyl("vs_mud_crown", 0.14, 0.1, (kx, ky, z), P["mud_dk"], seg=9)
    box("vs_dark_mouth", 0.26, 0.1, 0.3, (kx, ky - 0.44, 0.08), P["dark"])
    box("vs_kiln_glow", 0.17, 0.04, 0.15, (kx, ky - 0.5, 0.1), kiln_glow)

    # HERO: amphora rack — open wood frame, pots standing proud on both tiers
    rx0, ry0 = 0.55, -0.55
    for px in (rx0 - 0.62, rx0 + 0.62):
        for py in (ry0 - 0.2, ry0 + 0.2):
            box("vs_wood_rackpost", 0.06, 0.06, 0.66, (px, py, 0.08),
                P["wood_dk"])
    for zz in (0.26, 0.62):
        box("vs_wood_shelf", 1.38, 0.48, 0.05, (rx0, ry0, zz), P["wood"])
    for i in range(4):  # lower tier
        amphora(f"vs_l{i}", rx0 - 0.48 + i * 0.32, ry0 - 0.08, 0.31, P, s=0.8)
    for i in range(5):  # top tier, fully exposed
        amphora(f"vs_u{i}", rx0 - 0.52 + i * 0.26, ry0, 0.67, P, s=0.72)
    # ground pots leaning by the rack
    amphora("vs_g1", -0.25, -0.85, 0.08, P, s=1.1)
    amphora("vs_g2", 0.02, -1.0, 0.08, P, s=0.85)
    amphora("vs_g3", 1.05, -0.95, 0.08, P, s=0.95)

    # shopfront counter + awning (front-left, board 02 language)
    cx, cy = -0.85, -0.85
    box("vs_mud_counter", 0.75, 0.4, 0.44, (cx, cy, 0.08), P["mud_dk"])
    box("vs_cloth_countertop", 0.8, 0.45, 0.04, (cx, cy, 0.52), P["cl_org"])
    cyl("vs_pot_cup", 0.045, 0.08, (cx - 0.2, cy, 0.56), P["pot"], seg=8)
    cyl("vs_pot_cup2", 0.04, 0.07, (cx + 0.1, cy + 0.06, 0.56), P["pot"], seg=8)
    box("vs_cloth_awn", 0.9, 0.5, 0.04, (cx, cy - 0.15, 0.98), P["cl_yel"],
        rx=math.radians(-24))
    for sxp in (cx - 0.4, cx + 0.4):
        cyl("vs_wood_awnpole", 0.024, 0.92, (sxp, cy - 0.35, 0.08),
            P["wood_dk"], seg=7)
    # clay basket + mat
    basket("vs", 1.1, 0.1, 0.08, P, r=0.11, fill="grey")
    box("vs_matting_floor", 0.6, 0.45, 0.02, (0.05, -0.15, 0.08), P["thatch"])


# ---------------------------------------------------------------- REED BASKET SHOP
def build_reed_basket_shop(P):
    """Anchors 02 shopfront + 08 reeds: mudbrick stall, hero basket stacks,
    rush bundle lean, weaving frame, yellow awning. (Mesh names all contain
    'basket' via kind prefix, so kitLoader's reed-bob stays off.)"""
    base = box("rb_dirt_base", 2.6, 2.6, 0.08, (0, 0, 0), P["dirt"])
    bevel(base, 0.02)

    # stall: mudbrick with mat roof
    st = frustum("rb_mud_stall", 1.55, 1.15, 1.45, 1.05, 0.95,
                 (-0.35, 0.6, 0.08), P["mud_tan"])
    bevel(st, 0.02)
    box("rb_wood_beamF", 1.6, 0.06, 0.06, (-0.35, 0.08, 0.97), P["wood_dk"])
    box("rb_wood_beamB", 1.6, 0.06, 0.06, (-0.35, 1.12, 0.97), P["wood_dk"])
    box("rb_thatch_roof", 1.7, 1.3, 0.07, (-0.35, 0.6, 1.03), P["thatch"])
    box("rb_thatch_ridge", 1.72, 0.18, 0.05, (-0.35, 0.6, 1.1), P["thatch_dk"])
    box("rb_dark_door", 0.36, 0.09, 0.6, (-0.55, 0.06, 0.12), P["dark"])
    # counter through the open front
    box("rb_mud_counter", 0.7, 0.4, 0.44, (0.15, -0.05, 0.08), P["mud_dk"])
    box("rb_thatch_countertop", 0.76, 0.46, 0.04, (0.15, -0.05, 0.52),
        P["thatch"])
    basket("rb_c1", 0.0, -0.08, 0.56, P, r=0.08, fill="crop_g")
    basket("rb_c2", 0.32, -0.02, 0.56, P, r=0.07, fill="grey")

    # yellow awning off the stall front
    box("rb_cloth_awn", 1.5, 0.6, 0.04, (-0.35, -0.28, 0.92), P["cl_yel"],
        rx=math.radians(-20))
    for sxp in (-0.95, 0.25):
        cyl("rb_wood_awnpole", 0.026, 0.86, (sxp, -0.52, 0.08), P["wood_dk"],
            seg=7)

    # HERO: basket stacks, varied radii, 2-3 high
    def stack(px, py, radii):
        z = 0.08
        for i, r in enumerate(radii):
            h = 0.13 + r * 0.35
            top = i == len(radii) - 1
            if top:
                basket("rb_s", px, py, z, P, r=r, h=h, fill="crop_g")
            else:  # lower baskets carry the next basket, no fill disc
                cyl("rb_s_bask", r, h, (px, py, z), P["thatch_dk"], seg=9,
                    rtop=r * 1.18)
            z += h + 0.028
    stack(0.85, -0.75, (0.16, 0.135, 0.11))
    stack(1.05, -0.3, (0.13, 0.11))
    stack(0.55, -1.0, (0.12, 0.1))
    basket("rb_solo", 1.15, -0.85, 0.08, P, r=0.1, fill="crop_gr")
    # big woven storage basket with rope band
    cyl("rb_thatch_bigbask", 0.2, 0.34, (1.0, 0.35, 0.08), P["thatch_dk"],
        seg=10, rtop=0.25)
    cyl("rb_rope_band", 0.235, 0.05, (1.0, 0.35, 0.3), P["rope"], seg=10)

    # rush bundle lean against the stall's right flank (green + dry)
    for i, mm in enumerate(("crop_gr", "thatch", "crop_gr")):
        cyl(f"rb_rush_lean{i}", 0.055, 0.8, (0.52 + i * 0.11, 0.55 - i * 0.04,
            0.06), P[mm], seg=6, rx=math.radians(14), ry=math.radians(-6))

    # weaving frame: thin lattice loom (left side)
    wx, wy = -1.05, -0.5
    for px in (wx - 0.3, wx + 0.3):
        box("rb_wood_loompost", 0.05, 0.05, 0.85, (px, wy, 0.08), P["wood_dk"])
    for zz in (0.2, 0.88):
        box("rb_wood_loomrail", 0.66, 0.045, 0.045, (wx, wy, zz), P["wood"])
    for i in range(5):
        box("rb_rope_warp", 0.022, 0.022, 0.63, (wx - 0.22 + i * 0.11, wy, 0.24),
            P["rope"])
    for zz in (0.38, 0.52):
        box("rb_thatch_weft", 0.5, 0.03, 0.05, (wx, wy + 0.01, zz), P["thatch"])
    # spare bundle at the loom's foot
    cyl("rb_thatch_spare", 0.06, 0.5, (wx, wy - 0.3, 0.08 + 0.06 - 0.25),
        P["thatch"], seg=7, ry=math.radians(90), rz=math.radians(12))


# ---------------------------------------------------------------- WAREHOUSE
def build_warehouse(P):
    """Anchor 04 warehouse mass, standalone: battered mud walls, stone
    cornice, blue clerestory band, dark door + ramp, roof mats + rolls,
    crates + sealed jars outside."""
    base = box("wh_sand_apron", 2.9, 2.7, 0.08, (0, 0, 0), P["sand"])
    bevel(base, 0.03)

    # main battered mass
    ware = frustum("wh_mud_ware", 2.35, 1.9, 2.15, 1.72, 1.28, (0, 0.15, 0.08),
                   P["mud_tan"])
    bevel(ware, 0.025)
    # buttress ribs on the front face (harbor-mass language, adds relief)
    for bxp in (-0.78, 0.78):
        frustum("wh_mud_buttress", 0.26, 0.14, 0.2, 0.1, 1.1,
                (bxp, -0.85, 0.08), P["mud"])
    cor = box("wh_stone_cornice", 2.38, 1.94, 0.09, (0, 0.15, 1.36), P["stone"])
    bevel(cor, 0.02)
    box("wh_mud_roof", 2.18, 1.74, 0.07, (0, 0.15, 1.45), P["mud_dk"])
    # low parapet rim with crenel gaps (2 on the front run, 1 per flank)
    for cx0, ln in ((-0.79, 0.62), (0.1, 0.66), (0.85, 0.5)):
        box("wh_mud_rimF", ln, 0.09, 0.1, (cx0, -0.68, 1.52), P["mud"])
    for cx0, ln in ((-0.45, 1.3), (0.78, 0.64)):
        box("wh_mud_rimB", ln, 0.09, 0.1, (cx0, 0.98, 1.52), P["mud"])
    # X strips stop short of the corners — no coplanar overlap with rim runs
    box("wh_mud_rimL", 0.09, 1.55, 0.1, (-1.06, 0.15, 1.52), P["mud"])
    for cy0, ln in ((-0.28, 0.65), (0.62, 0.6)):
        box("wh_mud_rimR", 0.09, ln, 0.1, (1.06, cy0, 1.52), P["mud"])
    # wood joist lines across the roof surface (thin proud strips)
    for yy in (-0.42, -0.05, 0.32, 0.69):
        box("wh_wood_joist", 1.96, 0.05, 0.03, (0, yy, 1.52), P["wood_dk"])
    # roof hatch with frame
    box("wh_wood_hatchframe", 0.4, 0.4, 0.05, (0.78, -0.4, 1.52), P["wood_dk"])
    box("wh_dark_hatch", 0.28, 0.28, 0.045, (0.78, -0.4, 1.545), P["dark"])

    # blue clerestory band + dark vent slots near the top
    box("wh_blue_clerestory", 1.95, 0.05, 0.16, (0, -0.79, 1.08), P["blue"])
    for i in range(3):
        box("wh_dark_slot", 0.16, 0.05, 0.12, (-0.55 + i * 0.55, -0.8, 1.1),
            P["dark"])
    box("wh_blue_clerside", 0.05, 1.5, 0.14, (1.13, 0.15, 1.09), P["blue"])

    # dark door + stone frame + ramp
    box("wh_dark_doorway", 0.52, 0.1, 0.78, (0, -0.86, 0.14), P["dark"])
    box("wh_stone_jambL", 0.09, 0.09, 0.88, (-0.34, -0.87, 0.12), P["stone_w"])
    box("wh_stone_jambR", 0.09, 0.09, 0.88, (0.34, -0.87, 0.12), P["stone_w"])
    box("wh_stone_dlintel", 0.78, 0.1, 0.1, (0, -0.87, 1.0), P["stone_w"])
    ramp = box("wh_stone_ramp", 0.58, 0.6, 0.05, (0, -1.05, 0.095), P["stone"],
               rx=math.radians(8))
    bevel(ramp, 0.02)

    # roof mats + rolled bundles (proud of the roof surface, inside the rim)
    box("wh_matting_roof", 0.7, 0.55, 0.04, (-0.5, 0.3, 1.52), P["thatch"])
    box("wh_matting_roof2", 0.5, 0.4, 0.04, (0.35, -0.2, 1.52),
        P["thatch_dk"])
    for i in range(2):
        cyl(f"wh_thatch_roll{i}", 0.055, 0.6 - i * 0.12,
            (0.35 + i * 0.18, 0.5, 1.52 + 0.055 - (0.6 - i * 0.12) / 2),
            P["thatch_dk"], seg=8, ry=math.radians(90))

    # crates stacked clear of the battered wall, front-left
    box("wh_wood_crate", 0.34, 0.34, 0.3, (-1.22, -0.95, 0.08), P["wood"])
    box("wh_wood_crate2", 0.3, 0.3, 0.27, (-1.2, -0.92, 0.38), P["wood_dk"],
        rz=0.2)
    box("wh_wood_crate3", 0.32, 0.32, 0.28, (-1.26, -0.55, 0.08), P["wood"],
        rz=-0.12)
    # sealed jars (amphorae with linen lids) front-right
    for i, (px, py, s) in enumerate(((0.95, -0.95, 1.1), (1.2, -0.75, 0.9),
                                     (1.08, -1.15, 0.8))):
        amphora(f"wh_j{i}", px, py, 0.08, P, s=s)
        cyl(f"wh_linen_seal{i}", 0.055 * s, 0.03, (px, py, 0.08 + 0.255 * s),
            P["linen"], seg=8)
    # rope coil + lean mat on the flank
    torus("wh_rope_coil", 0.08, 0.022, (1.25, -0.35, 0.08), P["rope"])
    box("wh_matting_lean", 0.36, 0.05, 0.55, (-1.22, 0.35, 0.06), P["thatch"],
        rx=math.radians(12))
    basket("wh", 1.3, 0.15, 0.08, P, r=0.1, fill="grey")


# ---------------------------------------------------------------- export/render
BUILDERS = {
    "great_house": build_great_house,
    "market": build_market,
    "emmer_field": build_emmer_field,
    "mudbrick_yard": build_mudbrick_yard,
    "harbor": build_harbor,
    "river_clay_pit": build_river_clay_pit,
    "marsh_reed_bed": build_marsh_reed_bed,
    "training_grounds": build_training_grounds,
    "shrine": build_shrine,
    "ration_house": build_ration_house,
    "luxury_material": build_luxury_material,
    "luxury_workshop": build_luxury_workshop,
    "vessel_shop": build_vessel_shop,
    "reed_basket_shop": build_reed_basket_shop,
    "warehouse": build_warehouse,
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
    # az 142° views the post-bake +Y side = the authored -Y front facade
    az, el, d = math.radians(142), math.radians(40), size * 4
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
        # 'reed' in a node name green-tints + implies bob in kitLoader keyword
        # logic; reed_basket_shop meshes must not inherit it from the kind.
        joined.name = f"{kind.replace('reed_', 'rush_')}_{mat}"
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
    paint_variation(merged)
    return merged


def paint_variation(objs, seed=5):
    """Hand-painted read on flat-color kits: per-face value jitter baked into
    COLOR_0 vertex colors (Babylon multiplies them into base color), plus a
    subtle top-light / bottom-dirt vertical grade. Kills the MS-Paint flatness
    without textures."""
    import random
    rnd = random.Random(seed)
    for o in objs:
        me = o.data
        if not me.polygons:
            continue
        lo = min(v.co.z for v in me.vertices)
        hi = max(v.co.z for v in me.vertices)
        span = max(0.35, hi - lo)
        attr = me.color_attributes.new(name="Col", type="BYTE_COLOR",
                                       domain="CORNER")
        name = o.name.lower()
        # cloth/ember/gold keep tighter jitter so accents stay clean
        tight = any(k in name for k in ("cloth", "gold", "ember", "glow",
                                        "water", "linen"))
        amp = 0.05 if tight else 0.16
        mw = o.matrix_world
        for poly in me.polygons:
            f = 1.0 + rnd.uniform(-amp, amp)
            # faces near ground pick up dirt; high faces bleach in the sun
            zc = sum(me.vertices[v].co.z for v in poly.vertices) / len(poly.vertices)
            t = (zc - lo) / span
            grade = 0.87 + 0.17 * min(1.0, max(0.0, t))
            v = f * grade
            # ground-contact band: world-space low faces take extra dirt
            if not tight:
                zw = sum((mw @ me.vertices[vi].co).z
                         for vi in poly.vertices) / len(poly.vertices)
                if zw < 0.18:
                    v *= 0.85
            for li in poly.loop_indices:
                attr.data[li].color = (v, v, v, 1.0)


AO_SAMPLES = 48


def bake_ao(objs):
    """MATERIALS ceiling-breaker: bake real Cycles ambient occlusion into the
    COLOR_0 vertex colors, multiplied with the existing jitter/grade. Corners,
    under-eaves and prop bases visibly darken so kits stop looking pasted.
    Headless-safe: Cycles vertex-color bake target, no lights needed."""
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = AO_SAMPLES
    sc.cycles.use_denoising = False
    sc.render.bake.target = "VERTEX_COLORS"
    if sc.world is None:
        sc.world = bpy.data.worlds.new("bake_world")
    # short ray distance = local contact shadow, not global gloom
    sc.world.light_settings.distance = 1.6
    for o in objs:
        me = o.data
        name = o.name.lower()
        if not me.polygons:
            continue
        if "ember" in name or "glow" in name:
            continue  # emissives must not carry baked shadow
        # accents keep a gentler AO so cloth/gold/water/pottery stay clean
        soft = any(k in name for k in ("cloth", "gold", "linen", "water",
                                       "pottery"))
        ao = me.color_attributes.new(name="AO", type="FLOAT_COLOR",
                                     domain="CORNER")
        me.color_attributes.active_color = ao
        for other in bpy.context.scene.objects:
            other.select_set(other is o)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.bake(type="AO")
        col = me.color_attributes["Col"]
        for li in range(len(me.loops)):
            a = ao.data[li].color[0]
            if soft:
                a = 0.65 + 0.35 * a
            else:
                a = 0.35 + 0.65 * pow(a, 1.4)
            c = col.data[li].color
            col.data[li].color = (c[0] * a, c[1] * a, c[2] * a, 1.0)
        me.color_attributes.remove(me.color_attributes["AO"])
        me.color_attributes.active_color = me.color_attributes["Col"]


for kind in KINDS:
    reset()
    P = palette()
    BUILDERS[kind](P)
    kit_objs = merge_by_material(kind)
    bake_ao(kit_objs)
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
