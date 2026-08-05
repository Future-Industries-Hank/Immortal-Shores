"""
GOAL-GRAPHICS-READY: author hero building kits as SOLID artboard-adjacent glTF.
Blender 4.x headless. Axes: front facade = -Y (lands on Babylon -Z).
Run: blender -b -P author_kits.py -- [kind ...]
"""
import bpy
import bmesh
import math
import os
import struct
import sys
from mathutils import Vector

REPO = "/home/eric/apps/mmo-city-builder"
MODELS = os.path.join(REPO, "apps/client/public/models/buildings")
DECOR_MODELS = os.path.join(REPO, "apps/client/public/models/decor")
OUT = "/tmp/claude-1000/-home-eric/f840123e-860a-4c45-add6-0b16a98ff524/scratchpad/kit-previews"
os.makedirs(OUT, exist_ok=True)
os.makedirs(DECOR_MODELS, exist_ok=True)

ALL = ["great_house", "great_house_dress", "market", "emmer_field",
       "mudbrick_yard", "harbor",
       "river_clay_pit", "marsh_reed_bed", "training_grounds", "shrine",
       "ration_house", "luxury_material", "luxury_workshop", "vessel_shop",
       "reed_basket_shop", "warehouse"]
DECOR_ALL = ["obelisk", "statue_standing", "statue_seated", "small_pyramid"]
# no `--` args = author everything; named args select from either family, so
# `-- market` still authors only the market kit exactly as before
_sel = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None
KINDS = [k for k in _sel if k in ALL] if _sel else ALL
DECOR_KINDS = [k for k in _sel if k in DECOR_ALL] if _sel else DECOR_ALL

# ---------------------------------------------------------------- materials


def srgb(hexstr):
    h = hexstr.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [pow(v, 2.2) for v in c] + [1.0]


# ---- surface families. Declared up here because M() has to know which
# materials will receive a baked detail texture: that texture stores
# detail x AO, both <= 1, so a textured material renders DARKER than its
# authored swatch by the texture's own mean. TEX_GAIN is that mean's
# reciprocal, measured over the visible texels of every kit (see
# surface_bake's report line), applied once at authoring time so the
# settlement's exposure is exactly where it was before this stage existed.
# It is a single constant on purpose — per-kit normalisation would make the
# same mudbrick photograph at a different value in two different kits.
TEX_GAIN = 1.14

# material name -> surface family. Anything unlisted gets no UV and no texture,
# which is deliberate: crops, water and emissives are thin or bright accents
# where a pattern is pure cost (emmer_field alone is ~4.5k tris of blades).
_FAMILY = (
    ("mud_", "mudbrick"), ("roof_mud", "mudbrick"), ("brick_", "mudbrick"),
    ("stone_pale", "plaster"), ("stone_white", "plaster"),
    ("interior_warm", "plaster"), ("pottery", "plaster"),
    ("char_dark", "plaster"),
    ("stone_warm", "stone"), ("stone_groove", "stone"),
    # limestone gets its own family, not "stone": see _detail's "casing" branch
    # — its coursing has to survive a 46-degree battered face, which the shared
    # stone coordinate provably does not.
    ("limestone_", "casing"),
    ("wood_", "timber"), ("door_dark", "timber"),
    ("thatch_", "thatch"), ("rope_", "thatch"),
    ("cloth_", "cloth"), ("rug_", "cloth"), ("linen_", "cloth"),
    ("granite", "hardstone"), ("granodiorite", "hardstone"),
    ("electrum", "hardstone"),
    ("dirt_", "ground"), ("soil_", "ground"), ("sand_", "ground"),
    ("earth_", "ground"), ("clay_grey", "ground"),
)


def family_of(matname):
    for key, fam in _FAMILY:
        if matname.startswith(key):
            return fam
    return None



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
    base = srgb(hexcol)
    if family_of(name):                       # pre-multiply the texture headroom
        base = [min(1.0, c * TEX_GAIN) for c in base[:3]] + [1.0]
    col.outputs[0].default_value = base
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
        # ---- WALLS. Sand-buff Nile mudbrick, NOT fired terracotta (owner:
        # "please favor sand colored bricks over red bricks"; also the truer
        # material — straw-tempered river silt dries tan, not brick red).
        #
        # The thing that made this more than a swatch swap: the settlement used
        # to separate from the desert BY HUE, red walls at H20 against sand at
        # H37. Measured on the live board that separation was never actually
        # doing the work — lit sand renders V221 and a mud_terra wall renders
        # V92, so 129 levels of VALUE carry the read and only 17 degrees of hue
        # were riding along. That value gap is geometric (ground faces the key,
        # facades do not) and is untouched by recolouring, which is what makes
        # this safe. So the family moves onto the sand's hue axis but stops
        # ~6 degrees short of it and drops BELOW the sand's saturation (0.51),
        # i.e. greyer/cooler than the ground it stands on, never yellower.
        #
        # What is deliberately NOT recoloured: roof_mud, pottery, cloth_orange/
        # red, rug_red and the granite props all stay at H20-25. With the walls
        # neutralised those become the settlement's warm accents, so the town
        # keeps a red note in the roofs and awnings instead of in every facade.
        "mud": M("mud_terra", "#AC865F"),
        # socle/band tone: still the darkest wall step (48 levels under "mud",
        # same gap it always had) and kept a few degrees warmer than the wall
        # so a shaded course reads as shadow on brick, not as grey paint
        "mud_dk": M("mud_dark", "#7C5B42"),
        # trim/upper course. Pushed 31 levels over "mud" (was 25) to buy back
        # the facade's internal break: mud and mud_tan used to be 11 degrees
        # apart in hue and are now 2, so value has to carry that split alone.
        "mud_tan": M("mud_tan", "#CBA475"),
        "stone": M("stone_pale", "#D9CDB0", rough=0.8),
        "stone_w": M("stone_white", "#E4DCC6", rough=0.78),
        # cut limestone: warm quarry tone + a darker chisel/band tone so
        # blocks never read as neutral untextured greybox at 3x zoom
        "stone_wm": M("stone_warm", "#C6A870", rough=0.82),
        "stone_gv": M("stone_groove", "#9E8253", rough=0.88),
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
        # brick — the loose stacks in the yard and the kiln aprons. Renamed off
        # "brick_red": nothing in the client keys on the material name (the
        # kitLoader keyword list is apron/earth_pack/dirt_/gold/glow/window/
        # lamp/hearth/crest/kiln/canopy/reed) and family_of still matches on
        # the "brick_" prefix, so this is a rename for honesty only.
        # Held 12 levels ABOVE the wall so a brick stack against a wall is a
        # value step, not a hue step, now that both are buff.
        "brick": M("brick_sand", "#A07B56"),
        "brick_g": M("brick_grey", "#8A7259"),
        "char": M("char_dark", "#3A2E24"),
        # accents
        "gold": M("gold_leaf", "#D4A438", rough=0.45, metal=0.6),
        "blue": M("nile_blue", "#4A6E8A", rough=0.7),
        "pot": M("pottery", "#A05A34"),
        "dark": M("door_dark", "#33261C", rough=0.95),
        # dim warm interior fill: every doorway / window / under-awning void
        # gets one of these so openings read as shaded rooms, never as pure
        # black holes punched in the facade (judge R15-4)
        "inner": M("interior_warm", "#6A4B33", rough=0.98),
        "ember": M("ember_glow", "#E86A18", rough=0.6,
                   emit="#FF7A20", emit_str=2.5),
        "water": M("channel_water", "#4E5E48", rough=0.35),
        "grey": M("clay_grey", "#847A6C"),
        # luxury goods
        "copper": M("copper_ingot", "#B4652F", rough=0.5, metal=0.45),
        "gem": M("gem_violet", "#7B4E93", rough=0.45),
        # ---- decor stone. Deliberately OUTSIDE the building kits' limestone
        # family. Props stand alone in open sand with nothing to read against,
        # so each needs its own value band 25-35 levels UNDER the desert plus a
        # hue a few degrees off the 33-38 deg sand axis. Judges measured the old
        # props at 9 levels / 2 degrees of separation and simply lost them.
        #
        # Aswan granite: pulled off the terracotta axis on purpose. The old
        # #96594B sat at hue 13 next to mudbrick's hue 20 at near the same
        # value, so the obelisks merged into the shop walls behind them. Real
        # Aswan granite is a cool plum-red, ~hue 358 and 45 levels darker.
        "granite": M("granite_aswan", "#7A4C3B", rough=0.60),
        "granite_dk": M("granite_shadow", "#573326", rough=0.64),
        # pyramidion sheathing. NOT P["gold"]: that one is metal=0.6, and decor
        # goes through decorLoader, which has no kitLoader-style rescue and no
        # environment texture — a metallic PBR cap renders near-black there.
        "electrum": M("electrum_cap", "#CBA65A", rough=0.48),
        # ---- HARDSTONE (statues). Same move that made the obelisk the one prop
        # all three judges could read: leave the sand hue axis. Every prop but
        # the obelisk measured within 3 deg of sand H36, so they read as "darker
        # sand" rather than as stone. This family extends the obelisk's Aswan
        # granite (H358 S0.42, the proven one) instead of inventing a third
        # stone: H350-2, a plum-red that is ~34 deg off sand and still 15-20 off
        # mudbrick's H20 so the figures cannot merge into a shop wall either.
        #
        # Saturation is load-bearing and was the trap. The first pass took this
        # family to H325-341 at S0.15-0.24 on the theory that "cooler and
        # greyer" meant desaturating: low-chroma magenta is LAVENDER, and the
        # statues photographed as violet candy. Chroma stays near the sand's own
        # so these read as a coloured stone, and the separation is carried by
        # hue and value instead.
        #
        # Value is the other half. The old family was authored so dark (grano
        # V110) that after the AO bake the whole figure crushed to V65 with no
        # internal break: throne, lap, torso and nemes all merged into one
        # near-black lump. Each stone is now ~30-40 levels apart at source so
        # the masses stay separable AFTER occlusion, not just in the palette.
        "qtz": M("granite_pale", "#B07C69", rough=0.72),
        "qtz_dk": M("granite_pale_shade", "#724A3C", rough=0.74),
        "grano_lt": M("granodiorite_lit", "#B48675", rough=0.68),
        "grano": M("granodiorite", "#785042", rough=0.66),
        "grano_dk": M("granodiorite_deep", "#503126", rough=0.70),
        # ---- LIMESTONE (tomb, stele, statue plinths). Judges called the tomb
        # "khaki-olive" and "mud-brick": it was S0.44 at the sand's own hue 38,
        # so it could only ever read as sand that had gone dark. Cooled to H24-29
        # and dropped to S0.26-0.38 — off-axis AND greyer than the sand's 0.49,
        # which is what says dressed limestone. Not further: at S0.27 the tomb
        # photographed as a grey-mauve slab, which is the same failure from the
        # other side.
        #
        # Value could not go UP. The client grades small_pyramid albedo by 0.8,
        # so even a pure white course photographs ~60 levels under lit sand and
        # a pale casing-stone tomb is simply not reachable from this file. The
        # mass is read by a three-value split instead — dark socle, mid courses,
        # pale dressed cap — which also stops it photographing as one flat slab.
        #
        # Values re-scaled +8% when limestone moved from the "stone" surface
        # family to "casing". The casing pattern is far denser (block bond +
        # per-block tone + scour), so its atlas mean falls ~0.92 -> ~0.84 and
        # TEX_GAIN is deliberately ONE constant for the whole settlement. The
        # rescale is exactly that ratio, so the tomb photographs at the value
        # it did before the coursing landed, not 9% darker. Hue and saturation
        # are held: each channel is scaled by the same factor.
        # tomb_cap also came DOWN off 232 so that value x TEX_GAIN stays under
        # 255 — it used to clamp on red only, which silently pushed the cap
        # from H28 S0.25 to H35 S0.22.
        "tomb": M("limestone_tomb", "#DEB897", rough=0.86),
        "tomb_dk": M("limestone_socle", "#9E7B65", rough=0.88),
        "tomb_cap": M("limestone_cap", "#DFC3A7", rough=0.80),
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
    # ROUNDNESS: +4 segments everywhere. Call sites ask for 6-10, which is what
    # made jars, columns and limbs photograph as faceted retro prisms; +4 costs
    # ~40% of the cylinder tris on a 32k-tri library and reads as round.
    seg = seg + 4
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


def torus(name, r, tr, loc, mat, seg=16, rings=10):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=r, minor_radius=tr, major_segments=seg,
        minor_segments=rings, location=(loc[0], loc[1], loc[2] + tr))
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    return o


def sphere(name, r, loc, mat, seg=8):
    bm = bmesh.new()
    seg = seg + 4                                   # see cyl(): roundness bump
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(5, seg // 2),
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


def recess(name, w, h, x, yf, z, P, d=0.09, ring=0.05):
    """Wall opening that can never read as a pure black hole (judge R15-4):
    a dark reveal box set into the wall plane `yf` (the outward -Y face of
    the wall) plus a dim WARM interior panel standing 4 mm proud of it, so
    the void reads as a shaded room framed by its own reveal."""
    box(name + "_dark", w, d, h, (x, yf + d / 2, z), P["dark"])
    dd = d * 0.6
    box(name + "_inner", max(0.05, w - 2 * ring), dd, max(0.06, h - ring),
        (x, yf - 0.004 + dd / 2, z + ring * 0.5), P["inner"])


def recess_x(name, dpt, h, xf, y, z, P, sx=1, d=0.09, ring=0.05):
    """`recess` for an opening in an X-facing wall; xf = outward face plane,
    sx = +1 for a +X face, -1 for a -X face."""
    box(name + "_dark", d, dpt, h, (xf - sx * d / 2, y, z), P["dark"])
    dd = d * 0.6
    box(name + "_inner", dd, max(0.05, dpt - 2 * ring), max(0.06, h - ring),
        (xf + sx * 0.004 - sx * dd / 2, y, z + ring * 0.5), P["inner"])


def awning(name, w, d, back, tilt, mat, P, thick=0.042, front_poles=(),
           back_poles=(), ground=0.0, pole_r=0.025, stripe=None,
           stripe_frac=0.32, inset=0.035):
    """Sloped cloth awning pinned by its BACK (high) edge at
    back = (x_centre, y_wall, z_wall) and falling away toward -Y over depth
    `d` at `tilt` degrees.

    Two invariants the judges kept catching us on (R15-1a / R15-3):
      * the back edge sits exactly ON the wall face passed in, so the cloth
        can neither float off the wall nor shoot through it;
      * every pole listed in front_poles / back_poles is grown from `ground`
        to the EXACT canopy underside solved at that pole's own y, so no
        post can ever pierce the canopy or stop short of it.
    Returns (front_y, front_underside_z) for seating props beneath it."""
    a = math.radians(tilt)
    ca, sa = math.cos(a), math.sin(a)
    xc, yb, zb = back
    cy = yb - (d / 2) * ca
    cz = zb - (d / 2) * sa
    box(name, w, d, thick, (xc, cy, cz - thick / 2), mat, rx=a)
    if stripe is not None:
        u = -(d / 2) * (1 - stripe_frac)   # stripe rides the low (front) edge
        t = -thick * 0.55                  # proud on TOP, visible from iso
        box(name + "_stripe", w * 1.004, d * stripe_frac, thick,
            (xc, cy + u * ca + t * sa, cz + u * sa - t * ca - thick / 2),
            stripe, rx=a)

    def under(yp):
        return cz + (yp - cy) * math.tan(a) - (thick / 2) / ca
    yf = yb - d * ca
    for px in front_poles:
        yp = yf + inset
        cyl(name + "_pole", pole_r, under(yp) - ground, (px, yp, ground),
            P["wood_dk"], seg=7)
    for px in back_poles:
        yp = yb - inset
        cyl(name + "_bpole", pole_r, under(yp) - ground, (px, yp, ground),
            P["wood_dk"], seg=7)
    return yf, under(yf + inset)


def canopy(name, w, d, centre, tilt, mat, P, thick=0.05, ground=0.0,
           pole_r=0.03, inset=0.08):
    """Four-post shade mat. Each post height is solved against the tilted
    underside at that post's own y, so posts meet the mat flush instead of
    spearing through it (judge R15-1a)."""
    a = math.radians(tilt)
    ca = math.cos(a)
    cx, cy, cz = centre
    box(name, w, d, thick, (cx, cy, cz - thick / 2), mat, rx=a)
    for px in (cx - w / 2 + inset, cx + w / 2 - inset):
        for py in (cy - d / 2 + inset, cy + d / 2 - inset):
            h = cz + (py - cy) * math.tan(a) - (thick / 2) / ca - ground
            cyl(name + "_pole", pole_r, h, (px, py, ground), P["wood_dk"],
                seg=7)


def bevel(o, w=0.02, seg=2):
    """Chamfer the hard arrises. TWO segments, not one: a single-segment
    chamfer still presents one flat facet to a fixed key light, so the edge
    either catches the sun or does not and the form reads as a paper fold. Two
    give a short highlight ramp across the arris, which is the whole difference
    between "blocky" and "solid" at board zoom."""
    md = o.modifiers.new("bev", "BEVEL")
    md.width = w
    md.segments = seg
    md.limit_method = "ANGLE"
    md.angle_limit = math.radians(40)
    md.use_clamp_overlap = True


_cutters = []


def carve(o, cuts):
    """Boolean-subtract solid boxes out of `o`: chipped corners, knocked-out
    blocks, real cavities. Weathering that REMOVES stone keeps a silhouette
    crisp where piling loose geometry on top of it only blurs the mass.
    `cuts` are (w, d, h, (x, y, z_bottom), rz_degrees); cutters carry the
    target's own material so the difference never opens an empty slot, and
    they are dropped once merge_by_material applies the stack."""
    mat = o.data.materials[0] if o.data.materials else None
    for w, d, h, loc, rz in cuts:
        c = box("CUT", w, d, h, loc, mat, rz=math.radians(rz))
        _cutters.append(c)
        md = o.modifiers.new("cut", "BOOLEAN")
        md.operation = "DIFFERENCE"
        md.object = c


def chip(cx, cy, sx, sy, inset, z, h, s=0.7):
    """`carve` cut that shears a corner at (cx, cy) back by `inset` along its
    bisector. The cutter is parked so ONLY its inner plane reaches the solid,
    which is what keeps the break a single clean triangle instead of the
    knife-edge slivers a corner-centred cutter leaves behind."""
    t = (s - inset) / math.sqrt(2)
    return (2 * s, 2 * s, h, (cx + sx * t, cy + sy * t, z), 45.0)


# ------------------------------------------------------------ landscape geo
# The three RESOURCE kits are landscape, not architecture. Owner: "the reed and
# emmer fields can skirt the river bank in a natural kind of way. The clay pit
# can be a pit not a square. Squares work for buildings and pad sites, but
# these are the natural elements and resources that players dont build."
#
# Everything below exists so a field, a wetland and an excavation can be
# authored as closed irregular LOOPS extruded into slabs, instead of boxes.
# Nothing here is used by any building kit.
#
# ORIENTATION — MEASURED, not assumed. emmer's shed is authored at Blender
# (-0.68, -0.75); live it lands at Babylon (-9.28, -3.65) on a plot centred at
# (-8.60, -2.90), i.e. offset (-0.68, -0.75). So after the 180-degree bake in
# merge_by_material the mapping is the IDENTITY: Blender +X -> Babylon +X,
# Blender +Y -> Babylon +Z.
#
# The three resource plots sit at Babylon x ~ -8.5 and the river is further out
# at x ~ -9 .. -10, so THE RIVER IS AT BLENDER -X and the desert at Blender +X.
# All three builders below are authored in those terms: wet edge on -X, dry
# edge on +X, bank running along Y.
#
# The river surface is at Babylon y = 0.04 and a kit's lowest vertex is
# normalised onto y = 0 by kitLoader, so a fringe slab under 40 mm tall passes
# UNDER the water on the river side and stands proud on the sand side. That is
# how the wet edges below thin out without ever intersecting the water plane.
RIVER_X = -1.0
WATER_Y = 0.04


def loop(cx, cy, r, n=26, wob=0.16, rot=0.0, sq=1.0, rnd=None,
         harm=(2.0, 3.0, 5.0)):
    """Closed irregular outline: `n` points around (cx, cy) at radius `r`,
    modulated by three low harmonics plus a little per-point noise. Star-shaped
    about the centre by construction, so prism()'s fan caps are always valid.
    `sq` squashes the loop on Y (an elongated plot skirting the bank)."""
    import random
    rnd = rnd or random.Random(1)
    ph = [rnd.uniform(0, math.pi * 2) for _ in harm]
    amps = (wob, wob * 0.60, wob * 0.34)
    pts = []
    for i in range(n):
        t = math.pi * 2 * i / n
        f = 1.0
        for k in range(len(harm)):
            f += amps[k] * math.sin(harm[k] * t + ph[k])
        f += rnd.uniform(-wob * 0.16, wob * 0.16)
        pts.append((cx + r * f * math.cos(t + rot),
                    cy + r * f * sq * math.sin(t + rot)))
    return pts


def _centroid(pts):
    n = float(len(pts))
    return sum(p[0] for p in pts) / n, sum(p[1] for p in pts) / n


def inset_loop(outer, d, wob=0.30, rot=0.0, toward=(0.0, 0.0)):
    """A loop strictly INSIDE `outer`: every point pulled toward an interior
    point by the FRACTION `d` of its own radius, varied around the ring.

    Three properties are load-bearing:
      * it can never cross its parent, so a stack of these is guaranteed to
        make a clean set of nested terrace rings — a crossing tears the ring
        open and the pit shows daylight through its own wall;
      * the inset is proportional, not absolute, so five nested levels cannot
        compound their wobble into a pinched-off floor;
      * `toward` walks the centre everything shrinks at, so each terrace is
        eccentric to the one above it and the bowl stops reading as concentric
        rings turned on a lathe."""
    cx, cy = _centroid(outer)
    tx, ty = cx + toward[0], cy + toward[1]
    n = len(outer)
    pts = []
    for i, (x, y) in enumerate(outer):
        t = math.pi * 2 * i / n
        s = 1.0 - d * (1.0 + wob * math.sin(3 * t + rot)
                       + wob * 0.55 * math.sin(5 * t - rot * 1.7))
        s = max(0.35, min(0.97, s))
        vx, vy = x - tx, y - ty
        pts.append((tx + vx * s, ty + vy * s))
    return pts


def rot2(x, y, a):
    c, s = math.cos(a), math.sin(a)
    return x * c - y * s, x * s + y * c


def prism(name, pts, h, z, mat, taper=0.0):
    """Solid slab from z to z+h with `pts` as its outline.

    Caps are triangle FANS from the outline's own centroid, never n-gons: a
    26-vertex wobbling n-gon triangulates unpredictably and both the AO bake
    and the atlas unwrap pick that up as banding across a whole field."""
    cx, cy = _centroid(pts)
    bm = bmesh.new()
    n = len(pts)
    bot = [bm.verts.new((x, y, 0.0)) for x, y in pts]
    top = [bm.verts.new((cx + (x - cx) * (1 - taper),
                         cy + (y - cy) * (1 - taper), h)) for x, y in pts]
    cb = bm.verts.new((cx, cy, 0.0))
    ct = bm.verts.new((cx, cy, h))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((cb, bot[j], bot[i]))
        bm.faces.new((ct, top[i], top[j]))
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    o = _new_obj(name, mesh)
    o.location = (0, 0, z)
    o.data.materials.append(mat)
    return o


def ring(name, outer, inner, z, h, mat):
    """Annulus slab — a terrace tread, an excavation lip, a pool rim. `outer`
    and `inner` are loops with the SAME point count; the band between them is
    quads, so nothing here can produce a degenerate cap."""
    assert len(outer) == len(inner)
    bm = bmesh.new()
    n = len(outer)
    ob = [bm.verts.new((x, y, 0.0)) for x, y in outer]
    ot = [bm.verts.new((x, y, h)) for x, y in outer]
    ib = [bm.verts.new((x, y, 0.0)) for x, y in inner]
    it = [bm.verts.new((x, y, h)) for x, y in inner]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((ot[i], ot[j], it[j], it[i]))     # tread
        bm.faces.new((ob[i], ib[i], ib[j], ob[j]))     # underside
        bm.faces.new((ob[i], ob[j], ot[j], ot[i]))     # outer wall
        bm.faces.new((ib[i], it[i], it[j], ib[j]))     # inner wall (the cut)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    o = _new_obj(name, mesh)
    o.location = (0, 0, z)
    o.data.materials.append(mat)
    return o


def curve(pts, steps=7):
    """Catmull-Rom resample. A four-point control polyline for an irrigation
    channel or a worked path has to arrive as a CURVE — a chain of straight
    segments is just a smaller set of rectangles."""
    p = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(len(p) - 3):
        p0, p1, p2, p3 = p[i], p[i + 1], p[i + 2], p[i + 3]
        for s in range(steps):
            t = s / float(steps)
            t2, t3 = t * t, t * t * t
            out.append(tuple(
                0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t
                       + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
                       + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
                for k in (0, 1)))
    out.append(tuple(pts[-1]))
    return out


def strip(name, pts, half, h, z, mat):
    """Extruded ribbon along the polyline `pts` — an irrigation channel, a mud
    bund, a worked path. `half` is a scalar half-width or one value per point
    (a channel that narrows as it runs inland).

    Built as an explicit quad strip rather than prism(outline): a fan cap over
    a long curving outline produces sliver triangles that the atlas unwrap
    cannot pack and the AO bake reads as streaks."""
    n = len(pts)
    hs = half if isinstance(half, (list, tuple)) else [half] * n
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        a = pts[max(0, i - 1)]
        b = pts[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / L, dx / L
        left.append((x + nx * hs[i], y + ny * hs[i]))
        right.append((x - nx * hs[i], y - ny * hs[i]))
    bm = bmesh.new()
    lb = [bm.verts.new((p[0], p[1], 0.0)) for p in left]
    rb = [bm.verts.new((p[0], p[1], 0.0)) for p in right]
    lt = [bm.verts.new((p[0], p[1], h)) for p in left]
    rt = [bm.verts.new((p[0], p[1], h)) for p in right]
    for i in range(n - 1):
        bm.faces.new((lt[i], lt[i + 1], rt[i + 1], rt[i]))
        bm.faces.new((lb[i], rb[i], rb[i + 1], lb[i + 1]))
        bm.faces.new((lb[i], lb[i + 1], lt[i + 1], lt[i]))
        bm.faces.new((rb[i], rt[i], rt[i + 1], rb[i + 1]))
    bm.faces.new((lb[0], lt[0], rt[0], rb[0]))
    bm.faces.new((lb[n - 1], rb[n - 1], rt[n - 1], lt[n - 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    o = _new_obj(name, mesh)
    o.location = (0, 0, z)
    o.data.materials.append(mat)
    return o


def offset_path(pts, d):
    """Polyline parallel to `pts`, `d` to its left (negative = right). `d` may
    be per-point. Used to grow the two bunds of an irrigation channel from the
    channel's own centreline so they can never part company with the water."""
    n = len(pts)
    ds = d if isinstance(d, (list, tuple)) else [d] * n
    out = []
    for i, (x, y) in enumerate(pts):
        a = pts[max(0, i - 1)]
        b = pts[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1.0
        out.append((x - dy / L * ds[i], y + dx / L * ds[i]))
    return out


def pool(name, outline, z, rim_h, water_h, rim_mat, water_mat, inset=0.20):
    """Standing water HELD in a mud rim.

    Written the obvious way — a rim prism with a smaller water prism on top —
    the water ends up entirely INSIDE the rim solid and never renders. The rim
    has to be a RING with the water dropped through its hole, and the water
    outline has to be a shade smaller than the hole so the two vertical walls
    are never coplanar."""
    inner = inset_loop(outline, inset, wob=0.18, rot=1.3)
    ring(name + "_rim", outline, inner, z, rim_h, rim_mat)
    prism(name + "_water", inset_loop(inner, 0.04, wob=0.0), water_h, z,
          water_mat)


def lying(name, r, length, x, y, ground, mat, rz=0.0, seg=7):
    """Cylinder lying on its side with its axis exactly one radius above
    `ground`. cyl() places its own centre at z + h/2 BEFORE rotating, so a
    horizontal bundle written the obvious way floats at half its own length."""
    return cyl(name, r, length, (x, y, ground + r - length / 2), mat, seg=seg,
               ry=math.radians(90), rz=rz)


def mound(name, cx, cy, r, h, mat, rnd, z=0.0, sq=1.0, rot=0.0, lobes=3):
    """Tipped spoil / a crop heap. A cone photographs as a tent (judge R10);
    offset shrinking lobes photograph as material somebody dumped."""
    objs = []
    for i in range(lobes):
        f = 1.0 - i / float(lobes + 0.6)
        pts = loop(cx + rnd.uniform(-0.06, 0.06) * i,
                   cy + rnd.uniform(-0.06, 0.06) * i,
                   r * f, n=14, wob=0.20, rot=rot + i * 1.1, sq=sq, rnd=rnd)
        objs.append(prism(name, pts, h * (0.42 + 0.30 * i), z, mat, taper=0.34))
    return objs


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()
    _counter[0] = 0
    _cutters.clear()


def grab_all():
    return [o for o in bpy.context.scene.objects
            if o.type == "MESH" and not o.name.startswith("CUT_")]


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

    # ---- external stair, front-left, climbing +X to a landing pier ----
    # The old flight ran THROUGH a mud stringer wall whose far end stopped
    # dead in mid-air off a pad that hung over the road. The treads are
    # already solid blocks, so the stringer is gone: a stepped cheek wall now
    # hugs their outer edge (abutting, never overlapping) and the flight
    # terminates on a pilaster pier founded on the apron (judge R15-2a/2b).
    APRON = 0.05
    sy_out, sy_in, cheek_d = -1.51, -1.20, 0.075
    tread_y = (sy_out + cheek_d + sy_in) / 2
    tread_w = sy_in - (sy_out + cheek_d)
    x0, run, rise, n = -1.28, 0.16, 0.185, 9
    for i in range(n):
        h = rise * (i + 1)
        box("gh_stone_stair", run, tread_w, h,
            (x0 + (i + 0.5) * run, tread_y, APRON), P["stone"])
    # cheek wall in three wide panels whose tops follow the flight. Low
    # enough that most treads stay legible, and abutting the treads in Y
    # rather than running through them.
    for k in range(3):
        ch = rise * (3 * k + 1)
        cxs = x0 + (3 * k + 1.5) * run
        box("gh_mud_cheek", run * 3, cheek_d, ch,
            (cxs, sy_out + cheek_d / 2, APRON), P["mud"])
        box("gh_stone_cheekcap", run * 3, cheek_d + 0.02, 0.035,
            (cxs, sy_out + cheek_d / 2, APRON + ch), P["stone_w"])
    # newel at the foot of the flight — the cheek wall starts on masonry
    box("gh_mud_newel", 0.2, 0.30, 0.62, (-1.40, -1.355, APRON), P["mud"])
    box("gh_stone_newelcap", 0.26, 0.36, 0.06, (-1.40, -1.355, 0.67),
        P["stone_w"])
    # landing pilaster: solid from apron to top tread, so the flight ends on
    # a pier instead of a blank slab hanging in air
    ptop = APRON + rise * n
    box("gh_mud_pilaster", 0.30, 0.28, ptop - APRON, (0.32, -1.35, APRON),
        P["mud"])
    box("gh_mud_pilband", 0.33, 0.31, 0.06, (0.32, -1.35, 0.74), P["mud_tan"])
    box("gh_stone_landing", 0.34, 0.32, 0.06, (0.32, -1.35, ptop), P["stone"])
    box("gh_stone_pilcap", 0.38, 0.36, 0.05, (0.32, -1.35, ptop + 0.06),
        P["stone_w"])

    # ---- door, right of the pilaster, with a proper stone surround ----
    dx = 0.85
    dfy = -1.20             # nominal outer plane of the lower mass at door ht
    box("gh_stone_threshold", 0.66, 0.17, 0.05, (dx, -1.26, APRON), P["stone"])
    recess("gh_door", 0.52, 0.86, dx, dfy, APRON, P, d=0.14, ring=0.06)
    for s in (-1, 1):
        box("gh_stone_jamb", 0.1, 0.12, 0.86, (dx + s * 0.33, dfy - 0.055,
            APRON), P["stone_w"])
    box("gh_stone_lintel", 0.80, 0.14, 0.13, (dx, dfy - 0.07, 0.91),
        P["stone_w"])
    # striped door awning: back edge ON the stone-band face, falling
    # down-and-out, both poles solved to its underside and footed on the apron
    awning("gh_cloth_awn_door", 0.62, 0.36, (dx, -1.175, 1.34), 26, P["cl_red"],
           P, thick=0.045, front_poles=(dx - 0.26, dx + 0.26), ground=APRON,
           stripe=P["linen"], stripe_frac=0.3)
    # gold sun disc set into the band face above the awning
    cyl("gh_gold_disc", 0.085, 0.05, (dx, -1.165, 1.595), P["gold"], seg=12,
        rx=math.radians(90))

    # ---- windows: framed openings, warm interiors, seated awnings ----
    # Each window is a sill + jambs + lintel around a warm recess, and the
    # awning's back edge is pinned ON the stone-band face above the lintel
    # (they used to hover in front of frameless black slots).
    for wx in (-0.95, -0.30):
        wfy = -1.16
        box("gh_stone_sill", 0.54, 0.13, 0.06, (wx, wfy - 0.045, 1.14),
            P["stone_w"])
        recess("gh_win", 0.34, 0.34, wx, wfy, 1.20, P, d=0.08, ring=0.04)
        for s in (-1, 1):
            box("gh_stone_winjamb", 0.07, 0.10, 0.36,
                (wx + s * 0.205, wfy - 0.03, 1.18), P["stone_w"])
        box("gh_stone_winlintel", 0.54, 0.11, 0.09, (wx, wfy - 0.035, 1.54),
            P["stone_w"])
        awning("gh_cloth_awn_win", 0.50, 0.32, (wx, -1.135, 1.75), 26,
               P["cl_yel"], P, thick=0.038)
        cyl("gh_wood_awnrod", 0.019, 0.52, (wx, -1.398, 1.3296), P["wood_dk"],
            seg=6, ry=math.radians(90))
    # small framed window on the left face of the stone band
    box("gh_stone_sidelint", 0.11, 0.40, 0.07, (-1.355, -0.35, 1.60),
        P["stone_w"])
    for s in (-1, 1):
        box("gh_stone_sidejamb", 0.11, 0.06, 0.34, (-1.355, -0.35 + s * 0.17,
            1.26), P["stone_w"])
    recess_x("gh_winside", 0.28, 0.32, -1.318, -0.35, 1.28, P, sx=-1, d=0.08,
             ring=0.045)

    # pots at the door, all inside the apron
    amphora("gh", 1.30, -1.33, APRON, P, s=1.1)
    amphora("gh2", 1.20, -1.13, APRON, P, s=0.8)
    basket("gh", 0.85, -1.36, APRON, P, r=0.1, fill="crop_g")


# --------------------------------------------------- GREAT HOUSE TIER DRESSING
# A7: the Great House photographs IDENTICALLY at humble and at imperial, two
# rounds after the owner asked that levelling it visibly level the settlement.
# The renderer already has the machinery — scene.ts keeps `tierBands` (a mesh is
# enabled while band <= the settlement tier index) and drives roads, ground,
# greenery and props off it. What it has never had is anything to show ON the
# building.
#
# This kit is that dressing, and it is a SEPARATE GLB on purpose. Adding meshes
# to great_house.glb would re-pack its shared UV atlas and re-run its AO bake,
# i.e. it would change the HUMBLE building in order to describe the imperial
# one. Authored as its own kit, great_house.glb stays byte-identical and
# "hide every band" is exactly today's Great House by construction, not by
# measurement.
#
# THE CONTRACT THE SCENE CAN RELY ON (all of it verified in the report):
#   * Authored in great_house's own local frame, and the kit's bounding box is
#     PINNED to great_house's — x +-1.530, z -1.535..+1.525, y from 0 — by the
#     four corner precinct posts of band 1. kitLoader centres a kit on the XZ
#     midpoint of its own box and seats it on its own minimum Y, so both kits
#     get the SAME correction and the dressing lands on the building with no
#     per-kit offset table. The pins are real geometry that is HIDDEN at humble
#     and still bounds the box, because preload measures every mesh in the file
#     before anything is toggled.
#   * Every mesh is named  great_house_dress_<material>_b<N>  with N the tier
#     INDEX at which the piece first appears: 1 settled, 2 prosperous, 3 grand,
#     4 imperial. Nothing carries b0 — humble shows none of it. Bands are
#     CUMULATIVE, matching tierBands: show a mesh while N <= tier index.
#   * Purely cosmetic. No apron, no ground plane, no footprint: the kit adds
#     nothing at all below z 0.05 except the corner posts, and kitLoader's pick
#     box is a fixed 2.8 x 2.5 x 2.8 this file never touches.
#
# The materials are the settlement palette re-declared with a _b<N> suffix, so
# merge_by_material — which groups by material — lands one mesh per (band,
# material) pair without the shared merge code having to learn about bands.
# family_of() still matches on the leading name, so the dressing is surfaced by
# the same atlas stage as everything else.
GH_DRESS_MATS = {
    "mud":     ("mud_terra",   "#AC865F", 0.92, 0.0),
    "stone":   ("stone_pale",  "#D9CDB0", 0.80, 0.0),
    "stone_w": ("stone_white", "#E4DCC6", 0.78, 0.0),
    "wood_dk": ("wood_dark",   "#4E3418", 0.92, 0.0),
    "thatch":  ("thatch_mat",  "#C4A05A", 0.92, 0.0),
    "cl_red":  ("cloth_red",   "#A6402E", 0.92, 0.0),
    "linen":   ("linen_pale",  "#D8C9A8", 0.92, 0.0),
    "pot":     ("pottery",     "#A05A34", 0.92, 0.0),
    "gold":    ("gold_leaf",   "#D4A438", 0.45, 0.6),
}


def DM(key, band):
    """Palette material tagged with the tier band that owns it."""
    base, hexc, rough, metal = GH_DRESS_MATS[key]
    return M(f"{base}_b{band}", hexc, rough=rough, metal=metal)


def _gh_dress_occluders():
    """great_house's own masses, rebuilt as unexported grey solids.

    bake_ao and surface_bake's texel-AO pass both shoot rays through the whole
    Blender scene, so without the building present the dressing would bake as
    if it floated in empty space: the cornice would carry no soffit, the
    banners no contact, the parapet no shadow against the terrace — the exact
    "sits ON not IN" failure the judges keep scoring. These stand-ins are named
    CUT_* so grab_all() never picks them up (no merge, no export, no atlas) and
    they are pre-rotated 180 degrees about Z because merge_by_material rotates
    the REAL kit by that much afterwards; both then sit in the same frame for
    every bake."""
    # plain material, NOT M(): M() multiplies base colour by the COLOR_0
    # attribute, which only merge_by_material/paint_variation ever create, so
    # an occluder built with it renders black in the preview and hides the very
    # alignment the preview exists to check.
    G = bpy.data.materials.new("CUToccluder")
    G.use_nodes = True
    G.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = \
        srgb("#8C8C8C")
    G.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
    frustum("CUT_occ_low", 2.75, 2.45, 2.6, 2.3, 1.12, (0, 0, 0.05), G)
    frustum("CUT_occ_band", 2.66, 2.36, 2.56, 2.26, 0.62, (0, 0, 1.16), G)
    box("CUT_occ_terr", 2.62, 2.32, 0.1, (0, 0, 1.78), G)
    frustum("CUT_occ_tower", 1.28, 2.2, 1.2, 2.1, 0.82, (-0.62, 0, 1.88), G)
    box("CUT_occ_towerroof", 1.24, 2.14, 0.07, (-0.62, 0, 2.7), G)
    for s in (-1, 1):
        box("CUT_occ_rimY", 1.2, 0.08, 0.14, (-0.62, s * 1.0, 2.73), G)
        box("CUT_occ_rimX", 0.08, 1.92, 0.14, (-0.62 + s * 0.56, 0, 2.73), G)
    box("CUT_occ_bulk", 0.3, 0.36, 0.24, (-0.85, 0.55, 2.77), G)
    lx, lw, ld, deckz = 0.72, 1.35, 2.15, 1.88
    for px in (lx - lw / 2 + 0.08, lx + lw / 2 - 0.08):
        for py in (-ld / 2 + 0.08, 0, ld / 2 - 0.08):
            box("CUT_occ_post", 0.09, 0.09, 0.78, (px, py, deckz), G)
    box("CUT_occ_thatch", lw + 0.25, ld + 0.25, 0.09, (lx, 0, deckz + 0.78), G)
    # the flight, its cheek wall and the two piers it runs between
    sy_out, sy_in, cheek_d = -1.51, -1.20, 0.075
    tread_y = (sy_out + cheek_d + sy_in) / 2
    tread_w = sy_in - (sy_out + cheek_d)
    x0, run, rise = -1.28, 0.16, 0.185
    for i in range(9):
        box("CUT_occ_tread", run, tread_w, rise * (i + 1),
            (x0 + (i + 0.5) * run, tread_y, 0.05), G)
    for k in range(3):
        box("CUT_occ_cheek", run * 3, cheek_d, rise * (3 * k + 1),
            (x0 + (3 * k + 1.5) * run, sy_out + cheek_d / 2, 0.05), G)
    box("CUT_occ_newel", 0.2, 0.30, 0.68, (-1.40, -1.355, 0.05), G)
    box("CUT_occ_pil", 0.30, 0.28, 1.665, (0.32, -1.35, 0.05), G)
    box("CUT_occ_lint", 0.80, 0.14, 0.13, (0.85, -1.27, 0.91), G)
    import mathutils
    rot = mathutils.Matrix.Rotation(math.pi, 4, "Z")
    for o in bpy.context.scene.objects:
        if o.name.startswith("CUT_occ"):
            o.matrix_world = rot @ o.matrix_world


def build_great_house_dress(P):
    """Board 01 DRESSING: everything the Great House gains as the settlement
    levels, in four cumulative bands. Band 0 is deliberately empty."""
    _gh_dress_occluders()

    # ---- BAND 1, settled: the estate is kept -------------------------------
    # Four corner precinct posts. They are also the kit's BBOX PINS: cap
    # half-width 0.085 about (+-1.445, -1.45 / +1.44) reproduces great_house's
    # own x +-1.530 and z -1.535..+1.525 to the millimetre, which is what makes
    # the two kits share one centring correction. Do not move them without
    # re-measuring great_house.glb.
    for sx in (-1, 1):
        for sy, cy in ((-1, -1.45), (1, 1.44)):
            box("gd_mud_post", 0.13, 0.13, 0.24, (sx * 1.445, cy, 0.0),
                DM("mud", 1))
            box("gd_stone_postcap", 0.17, 0.17, 0.04, (sx * 1.445, cy, 0.24),
                DM("stone_w", 1))
    # a woven screen rolled down the loggia's open +X side, under the eave
    box("gd_thatch_screen", 0.035, 1.90, 0.60, (1.375, 0, 1.99),
        DM("thatch", 1))
    cyl("gd_wood_screenrod", 0.026, 1.94, (1.375, 0, 1.63), DM("wood_dk", 1),
        seg=7, rx=math.radians(90))
    # stores on the tower roof: the only free deck on the building, and the
    # one place a small prop still reads from a fixed 45-degree board camera
    cyl("gd_pottery_jar", 0.105, 0.30, (-0.32, 0.42, 2.77), DM("pot", 1),
        seg=8, rtop=0.07)
    cyl("gd_pottery_jar2", 0.085, 0.24, (-0.46, 0.10, 2.77), DM("pot", 1),
        seg=8, rtop=0.055)
    box("gd_thatch_matroll", 0.22, 0.60, 0.15, (-0.24, -0.42, 2.77),
        DM("thatch", 1))

    # ---- BAND 2, prosperous: the house is dressed in stone -----------------
    # Two-step corbel cornice at the terrace line. This is the single most
    # useful piece in the kit and not only for the tier read: it is a real 0.13
    # overhang over the facade, so it puts a soffit and a cast shadow exactly
    # where three rounds of judging have said the building has none.
    #
    # RINGS, NOT SLABS, and that distinction is the whole piece. Authored as
    # solid frusta the first time, the cornice's top face became a 2.84 x 2.54
    # pale plane at z1.92 that swallowed the mud terrace, the loggia deck and
    # the foot of every post — a bald light polygon on the roof, which is the
    # complaint (A8) another part of this round is busy fixing. As annuli the
    # dark terrace deck stays exactly where it is and only the eaves change.
    def rect(w, d):
        return [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2),
                (-w / 2, d / 2)]

    ring("gd_stone_cornice", rect(2.74, 2.44), rect(2.46, 2.16), 1.78, 0.07,
         DM("stone", 2))
    ring("gd_stone_cornicecap", rect(2.88, 2.58), rect(2.50, 2.20), 1.85, 0.06,
         DM("stone_w", 2))
    # terrace parapet: front run plus two short returns, standing on the cap
    box("gd_stone_parapet", 2.72, 0.11, 0.26, (0, -1.235, 1.91),
        DM("stone", 2))
    for sx in (-1, 1):
        box("gd_stone_parapetret", 0.11, 0.50, 0.26, (sx * 1.385, -1.03, 1.91),
            DM("stone", 2))
    # heavier door architrave on top of the existing lintel, on two consoles
    box("gd_stone_architrave", 1.00, 0.18, 0.11, (0.85, -1.30, 1.04),
        DM("stone_w", 2))
    for s in (-1, 1):
        box("gd_stone_console", 0.12, 0.14, 0.09, (0.85 + s * 0.40, -1.33,
            0.95), DM("stone", 2))

    # ---- BAND 3, grand: a formal front -------------------------------------
    # Flanking standards. They stand clear of the battered wall on stone
    # buttress blocks and inside the +-1.53 envelope the posts already pin, so
    # the kit's silhouette grows UPWARD and never outward.
    for sx in (-1, 1):
        box("gd_stone_mastbase", 0.24, 0.30, 0.30, (sx * 1.40, 0.10, 0.05),
            DM("stone", 3))
        cyl("gd_wood_mast", 0.042, 2.20, (sx * 1.44, 0.10, 0.35),
            DM("wood_dk", 3), seg=8)
        cyl("gd_wood_mastcross", 0.020, 0.42, (sx * 1.44, 0.10, 2.21),
            DM("wood_dk", 3), seg=6, rx=math.radians(90))
        box("gd_cloth_pennant", 0.030, 0.38, 1.00, (sx * 1.487, 0.10, 1.40),
            DM("cl_red", 3))
        box("gd_linen_pennantband", 0.030, 0.38, 0.22,
            (sx * 1.4885, 0.10, 1.52), DM("linen", 3))
    # stepped merlons along the tower parapet — a serrated roofline is the one
    # change to this building that is legible at board zoom without any zoom
    for mx in (-1.18, -0.90, -0.62, -0.34, -0.06):
        box("gd_stone_merlon", 0.13, 0.10, 0.11, (mx, -1.0, 2.87),
            DM("stone_w", 3))
    for my in (-0.60, -0.20, 0.20, 0.60):
        box("gd_stone_merlonside", 0.10, 0.13, 0.11, (-1.18, my, 2.87),
            DM("stone_w", 3))

    # ---- BAND 4, imperial: gilding -----------------------------------------
    # Everything here is a THIN plate on something band 2 or 3 already built,
    # so the imperial step is a change of MATERIAL at the same silhouette. The
    # "gold" in the mesh name is what kitLoader keys its night emissive off.
    # gilded moulding tucked in the reveal between the two cornice steps, so
    # the gold is a LINE catching the key rather than a plate facing the sky
    ring("gd_gold_cornicefillet", rect(2.78, 2.48), rect(2.70, 2.40), 1.83,
         0.02, DM("gold", 4))
    box("gd_gold_architrave", 1.02, 0.04, 0.06, (0.85, -1.40, 1.06),
        DM("gold", 4))
    # winged disc centred on the parapet over the door
    cyl("gd_gold_disc", 0.16, 0.05, (0.85, -1.345, 2.04), DM("gold", 4),
        seg=12, rx=math.radians(90))
    for s in (-1, 1):
        box("gd_gold_wing", 0.30, 0.04, 0.06, (0.85 + s * 0.30, -1.32, 2.01),
            DM("gold", 4))
    for sx in (-1, 1):
        cyl("gd_gold_finial", 0.05, 0.17, (sx * 1.44, 0.10, 2.55),
            DM("gold", 4), seg=8, rtop=0.010)
    for mx in (-1.18, -0.90, -0.62, -0.34, -0.06):
        box("gd_gold_merloncap", 0.15, 0.12, 0.025, (mx, -1.0, 2.98),
            DM("gold", 4))


# ---------------------------------------------------------------- MARKET
def build_market(P):
    """Board 02: colonnade hall — battered ends, heavy roof slab, stall
    awnings, counters with goods, amphorae.

    The 3.15 x 2.25 plot is hard law here (judge R15-1): every pole, counter
    and pot lives inside +-1.5 / +-1.05, the stall awnings are built through
    awning() so their posts start on the plinth and stop dead under the
    cloth, and the cloth falls DOWN-and-out (it used to ramp upward and fan
    its far edge through the counters and crates).
    """
    mb1 = box("mk_stone_base", 3.15, 2.25, 0.1, (0, 0, 0), P["stone"])
    bevel(mb1, 0.02)
    mb2 = box("mk_stone_base2", 2.98, 2.08, 0.1, (0, 0, 0.1), P["stone_w"])
    bevel(mb2, 0.02)
    box("mk_stone_floor", 2.85, 1.92, 0.05, (0, 0, 0.2), P["stone"])
    FLOOR, SHELF = 0.25, 0.20   # hall floor top / plinth shelf in front of it

    # battered end + back walls. Footprints are pulled inside the stone floor
    # (was 3.15-wide: the old end walls cantilevered off the plinth) and the
    # end-wall fronts stop at the colonnade line so nothing swallows a column.
    for s in (-1, 1):
        w = frustum("mk_mud_end", 0.55, 1.54, 0.45, 1.42, 1.0,
                    (s * 1.145, 0.18, FLOOR), P["mud"])
        bevel(w, 0.02)
    bk = frustum("mk_mud_back", 2.8, 0.38, 2.7, 0.3, 1.0, (0, 0.76, FLOOR),
                 P["mud"])
    bevel(bk, 0.02)
    # store doorway in the back wall: dim warm interior, never a black hole
    recess("mk_backdoor", 0.52, 0.74, -0.12, 0.57, FLOOR, P, d=0.1)
    box("mk_stone_backlintel", 0.68, 0.13, 0.09, (-0.12, 0.55, 0.99),
        P["stone_w"])

    # colonnade: 5 pale columns with capitals, pulled clear of the end walls
    for i in range(5):
        cx = -0.76 + i * 0.38
        cyl("mk_stone_col", 0.085, 0.88, (cx, -0.5, FLOOR), P["stone_w"],
            seg=10)
        box("mk_stone_cap", 0.2, 0.2, 0.07, (cx, -0.5, 1.13), P["stone_w"])

    # heavy roof slab + cornice. Shallower than the plinth so the eave reads
    # as an eave and the stall awnings emerge from under it.
    box("mk_stone_cornice", 3.10, 1.86, 0.05, (0, 0.1, 1.2), P["stone_w"])
    roof = box("mk_mud_roofslab", 3.06, 1.80, 0.2, (0, 0.1, 1.25), P["mud_tan"])
    bevel(roof, 0.03)
    # low parapet rim strips, mitred so the runs touch instead of overlapping
    box("mk_mud_rimYf", 2.70, 0.1, 0.09, (0, -0.75, 1.45), P["mud_dk"])
    box("mk_mud_rimYb", 2.70, 0.1, 0.09, (0, 0.95, 1.45), P["mud_dk"])
    for s in (-1, 1):
        box("mk_mud_rimX", 0.1, 1.60, 0.09, (s * 1.40, 0.1, 1.45), P["mud_dk"])
    # wood joist battens: thin proud strips breaking up the slab
    for i in range(5):
        box("mk_wood_batten", 0.055, 1.55, 0.035, (-1.1 + i * 0.55, 0.1, 1.45),
            P["wood_dk"])
    # roof furniture, each parked in a gap BETWEEN battens (they used to be
    # skewered by them)
    box("mk_wood_hatchframe", 0.42, 0.42, 0.05, (0.825, 0.55, 1.45),
        P["wood_dk"])
    box("mk_dark_hatch", 0.3, 0.3, 0.045, (0.825, 0.55, 1.475), P["dark"])
    box("mk_mud_vent", 0.16, 0.16, 0.15, (-0.825, 0.60, 1.45), P["mud_tan"])
    box("mk_dark_venttop", 0.1, 0.1, 0.04, (-0.825, 0.60, 1.6), P["dark"])
    box("mk_matting_roof", 0.42, 0.34, 0.05, (0.825, -0.42, 1.45), P["thatch"])
    box("mk_matting_roof2", 0.42, 0.32, 0.05, (-0.83, -0.40, 1.45),
        P["thatch_dk"])
    cyl("mk_thatch_roofroll", 0.055, 0.44, (-0.275, -0.45, 1.45 + 0.055 - 0.22),
        P["thatch_dk"], seg=8, ry=math.radians(90))

    # stall awnings: back edge pinned on the capital / end-wall face, falling
    # down-and-out, posts solved to the canopy underside and footed on the
    # plinth shelf
    # tie rail across the colonnade so every cloth springs from real timber
    box("mk_wood_awnrail", 2.82, 0.05, 0.05, (0, -0.615, 1.055), P["wood_dk"])
    for cx, cm in ((-1.05, "cl_yel"), (-0.35, "cl_org"),
                   (0.35, "cl_yel"), (1.05, "cl_org")):
        awning("mk_cloth_awn", 0.60, 0.42, (cx, -0.64, 1.08), 21, P[cm], P,
               front_poles=(cx - 0.26, cx + 0.26), ground=SHELF,
               pole_r=0.026, inset=0.03, stripe=P["linen"], stripe_frac=0.22)

    # counters: mud blocks + textile tops + goods, seated on the hall floor
    # between the colonnade and the awning posts
    for (cx, cloth) in ((-0.70, "cl_org"), (0.70, "cl_yel")):
        box("mk_mud_counter", 0.86, 0.26, 0.44, (cx, -0.78, FLOOR), P["mud_dk"])
        box("mk_cloth_top", 0.92, 0.32, 0.05, (cx, -0.78, 0.69), P[cloth])
        basket("mk", cx - 0.26, -0.78, 0.74, P, r=0.09, fill="crop_g")
        basket("mk2", cx + 0.24, -0.76, 0.74, P, r=0.08, fill="grey")
    # stall goods between and beside the counters, on the hall floor
    amphora("mk4a", 0.0, -0.80, FLOOR, P, s=1.2)
    basket("mk4b", -0.17, -0.74, FLOOR, P, r=0.1, fill="crop_g")
    for sx in (-1.30, 1.30):
        cr = box("mk_wood_crate", 0.24, 0.24, 0.26, (sx, -0.78, FLOOR),
                 P["wood"], rz=0.18 * sx)
        bevel(cr, 0.02)
        box("mk_linen_sack", 0.2, 0.17, 0.16, (sx, -0.78, 0.51), P["linen"],
            rz=-0.3 * sx)
    # floor goods inside the hall, clear of the walls and columns
    basket("mk3", 0.10, -0.20, FLOOR, P, r=0.13, fill="crop_g")
    basket("mk4", -0.22, -0.26, FLOOR, P, r=0.1, fill="grey")
    amphora("mk", 0.70, -0.15, FLOOR, P, s=1.15)
    amphora("mk2", 0.68, 0.14, FLOOR, P, s=0.9)
    amphora("mk3", -0.70, -0.05, FLOOR, P, s=1.1)


# ---------------------------------------------------------------- EMMER FIELD
def build_emmer_field(P):
    """Riverside cultivation that SKIRTS THE BANK — the owner's note is that
    the resources a player never builds should not be tiles. So: no frame, no
    quadrant grid, no rectangular base. Soft-edged plots of eight different
    sizes and angles, a curved feeder channel taken off the river (-X) between
    two raised mud bunds, crop rows whose length is the plot's own chord so
    the planted mass frays at the edge, a worked path, and one small shed —
    a thing somebody BUILT is allowed to be square.

    Ground stack. Every level is 12+ mm clear of the one under it: a slab
    authored level with the slab below it z-fights across its whole area, and
    a slab authored INSIDE the one below it simply never renders.
      0.000-0.026  pale dry sand margin. Under the 0.04 river plane, so on the
                   water side of the plot the field's edge dissolves into it
      0.026-0.062  dark flood silt, the cultivated ground
      0.026-0.074  the shed's packed yard
      0.030-0.105  channel bunds, water surface at 0.078 between them
      0.062-0.092  the plots, wetter and darker again
    """
    import random
    rnd = random.Random(23)
    # RIPENING emmer, not marsh. On the live board the field and the reed
    # bed 3.7 units away photographed as the same green mass, because both
    # were drawing from the same three olives. The field drops the deepest
    # olive for the amber and heads every row in amber, so the two resources
    # separate by hue at board zoom instead of only by silhouette.
    greens = ("crop_lt", "crop_gr", "crop_g")

    # ---- ground: two feathered lobes, no edge that can read as a tile
    prism("ef_sand_margin",
          loop(0.02, 0.0, 1.44, n=34, wob=0.115, sq=1.02, rnd=rnd),
          0.026, 0.0, P["sand"])
    prism("ef_soil_tilled",
          loop(-0.05, 0.03, 1.27, n=32, wob=0.150, sq=1.07, rot=0.6, rnd=rnd),
          0.036, 0.026, P["soil"])

    # ---- feeder channel off the river, curving inland and narrowing. Twin
    # bunds grown off the centreline, water between them: one wide bund with
    # the water laid on top of it is just a brown ribbon with a blue stripe.
    ch = curve([(-1.46, -0.96), (-0.90, -0.58), (-0.20, -0.18),
                (0.40, 0.30), (0.80, 0.98), (0.94, 1.36)], steps=6)
    hw = [0.088 - 0.036 * (i / (len(ch) - 1.0)) for i in range(len(ch))]
    for s in (-1, 1):
        strip("ef_mud_bund", offset_path(ch, [s * (h + 0.052) for h in hw]),
              0.052, 0.075, 0.030, P["mud_dk"])
    strip("ef_water_channel", ch, hw, 0.048, 0.030, P["water"])
    for s in (-1, 1):
        box("ef_wood_sluice", 0.05, 0.26, 0.15,
            (-1.26 + s * 0.09, -0.70 + s * 0.17, 0.085), P["wood_dk"],
            rz=math.radians(32))

    # ---- plots: eight, all different, laid either side of the channel and
    # carried right down the bank so the field follows the water's edge
    beds = ((0.80, 0.62, 0.58, 0.42, 0.30, 8),
            (0.14, 1.08, 0.52, 0.30, 0.08, 6),
            (0.14, -0.80, 0.46, 0.38, -0.18, 7),
            (1.06, 0.40, 0.30, 0.40, 1.25, 5),
            (-0.60, -1.12, 0.42, 0.25, -0.45, 5),
            (-0.94, 0.52, 0.42, 0.34, 0.85, 6),
            (-0.50, 1.02, 0.33, 0.25, 0.25, 5),
            (-1.10, -0.32, 0.34, 0.30, -0.70, 5),
            (-0.42, 0.18, 0.32, 0.26, 0.55, 5))
    for bx, by, rx, ry, ang, rows in beds:
        pad = [(bx + px * rx * 1.10 * math.cos(ang)
                - py * ry * 1.10 * math.sin(ang),
                by + px * rx * 1.10 * math.sin(ang)
                + py * ry * 1.10 * math.cos(ang))
               for px, py in loop(0, 0, 1.0, n=20, wob=0.115, rnd=rnd)]
        prism("ef_mud_bed", pad, 0.030, 0.062, P["mud_dk"])
        for r in range(rows):
            v = -1.0 + 2.0 * (r + 0.5) / rows
            half = (math.sqrt(max(0.0, 1.0 - v * v)) * rx
                    * (0.84 + rnd.random() * 0.14))
            ly = v * ry * 0.88
            segs = max(2, int(half / 0.135))
            for si in range(segs):
                lx = -half + 2 * half * ((si + 0.5) / segs)
                hh = 0.110 + rnd.random() * 0.140
                gi = rnd.randrange(3) if rnd.random() > 0.3 else (r + si) % 3
                wx, wy = rot2(lx + rnd.uniform(-0.02, 0.02),
                              ly + rnd.uniform(-0.022, 0.022), ang)
                box("ef_crop_row", 2 * half / segs * 0.78,
                    ry / rows * 0.66, hh, (bx + wx, by + wy, 0.088),
                    P[greens[gi]], rz=ang + rnd.uniform(-0.11, 0.11))
                if rnd.random() > 0.16:
                    box("ef_crop_head", 2 * half / segs * 0.56,
                        ry / rows * 0.48, 0.038 + rnd.random() * 0.048,
                        (bx + wx, by + wy, 0.088 + hh), P["crop_g"])
        # volunteer emmer outside the plot line — the edge frays outward
        for _ in range(7):
            a2 = rnd.random() * math.pi * 2
            rr = 0.94 + rnd.random() * 0.30
            wx, wy = rot2(math.cos(a2) * rx * rr, math.sin(a2) * ry * rr, ang)
            box("ef_crop_tuft", 0.045 + rnd.random() * 0.045,
                0.045 + rnd.random() * 0.045, 0.07 + rnd.random() * 0.15,
                (bx + wx, by + wy, 0.070), P[greens[rnd.randrange(3)]],
                rz=rnd.random() * 1.5)

    # ---- rank grass on the levee: the untilled water edge is never bare
    for _ in range(30):
        a2 = rnd.random() * math.pi * 2
        rr = 0.98 + rnd.random() * 0.26
        gx, gy = math.cos(a2) * rr, math.sin(a2) * rr * 1.06
        if gx > 0.30:                              # dry side stays open sand
            continue
        box("ef_crop_bankgrass", 0.050 + rnd.random() * 0.050,
            0.050 + rnd.random() * 0.050, 0.06 + rnd.random() * 0.13,
            (gx, gy, 0.040), P["crop_gr"] if rnd.random() > 0.4
            else P["crop_lt"], rz=rnd.random() * 1.5)

    # ---- threshing floor on the headland between the channel and the shed:
    # swept sand, a heap of grain and the baskets it goes into. The first pass
    # left this whole middle as bare silt and the field photographed with a
    # hole in it.
    prism("ef_sand_thresh",
          loop(0.42, -0.40, 0.33, n=18, wob=0.10, sq=1.05, rot=1.7, rnd=rnd),
          0.018, 0.062, P["sand"])
    mound("ef_crop_thresh", 0.42, -0.40, 0.17, 0.20, P["crop_g"], rnd,
          z=0.080, lobes=2)
    basket("ef3", 0.70, -0.52, 0.080, P, r=0.09, fill="crop_g")
    for i in range(2):
        cyl("ef_wood_flail", 0.020, 0.44, (0.18 + i * 0.07, -0.58, 0.080),
            P["wood_dk"], seg=6, rx=math.radians(62 - i * 8),
            rz=math.radians(24 + i * 40))

    # ---- worked path from the shed door down to the bank, curving round the
    # plots instead of cutting a straight line through them
    pth = curve([(0.92, -1.22), (0.50, -1.12), (-0.10, -0.98),
                 (-0.72, -0.64), (-1.14, -0.38), (-1.36, -0.20)], steps=6)
    strip("ef_sand_path", pth, 0.110, 0.018, 0.060, P["sand"])

    # ---- shed on its own packed yard, so it sits on ground it belongs to
    # rather than hovering off the edge of the tilled lobe
    shx, shy = 0.90, -0.86
    prism("ef_mud_yard",
          loop(shx + 0.04, shy - 0.02, 0.68, n=18, wob=0.135, sq=1.05,
               rot=0.4, rnd=rnd), 0.048, 0.026, P["mud_tan"])
    frustum("ef_brick_shed", 0.84, 0.70, 0.79, 0.66, 0.70, (shx, shy, 0.074),
            P["brick"])
    for zz in (0.26, 0.48):
        box("ef_mud_band", 0.86, 0.72, 0.06, (shx, shy, zz), P["mud_tan"])
    recess("ef_door", 0.34, 0.44, shx, shy - 0.35, 0.094, P, d=0.10, ring=0.045)
    box("ef_thatch_roof", 0.92, 0.78, 0.06, (shx, shy, 0.774), P["thatch"])
    box("ef_wood_beamF", 0.95, 0.05, 0.05, (shx, shy - 0.39, 0.744), P["wood_dk"])
    box("ef_wood_beamB", 0.95, 0.05, 0.05, (shx, shy + 0.39, 0.744), P["wood_dk"])

    # ---- yard props, all on the yard slab
    mound("ef_crop_heap", shx - 0.46, shy - 0.34, 0.19, 0.26, P["crop_g"], rnd,
          z=0.074, lobes=2)
    basket("ef", shx + 0.42, shy - 0.36, 0.074, P, r=0.10, fill="crop_g")
    basket("ef2", shx + 0.28, shy - 0.50, 0.074, P, r=0.08, fill="crop_g")
    for i, (sx, sy) in enumerate(((shx + 0.50, shy + 0.24),
                                  (shx + 0.46, shy + 0.42),
                                  (shx + 0.56, shy + 0.08))):
        cyl("ef_thatch_sheaf", 0.072, 0.48, (sx, sy, 0.070), P["thatch"],
            seg=7, rx=math.radians(13 + i * 5), rz=math.radians(24 * i),
            rtop=0.05)

    # ---- windbreak: ONE broken run of rush fence along the dry edge. A fence
    # all the way round is exactly the frame the owner asked us to remove.
    fx = curve([(1.36, -0.06), (1.30, 0.48), (1.08, 0.94), (0.72, 1.24)],
               steps=4)
    for i in range(0, len(fx), 2):
        px, py = fx[i]
        box("ef_thatch_post", 0.045, 0.045, 0.28 + rnd.random() * 0.09,
            (px, py, 0.040), P["thatch_dk"], rz=rnd.random())
    for i in range(0, len(fx) - 2, 2):
        ax, ay = fx[i]
        bx2, by2 = fx[i + 2]
        for rz2 in (0.130, 0.230):
            box("ef_wood_rail", math.hypot(bx2 - ax, by2 - ay), 0.028, 0.040,
                ((ax + bx2) / 2, (ay + by2) / 2, rz2), P["wood"],
                rz=math.atan2(by2 - ay, bx2 - ax))


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
    # firing mouth: recessed into the base course with a dim warm throat
    # behind the ember bar, so it stops reading as a black slab pasted on
    recess("my_mouth", 0.40, 0.44, kx, -0.425, 0.08, P, d=0.12, ring=0.06)
    box("my_kiln_glow_mouth", 0.24, 0.04, 0.2, (kx, -0.445, 0.1), P["ember"])
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
    for mi, (mx, my_) in enumerate(((-0.7, -1.15), (0.20, -1.25))):
        box("my_matting_dry", 0.85, 0.55, 0.02, (mx, my_, 0.08), P["thatch"])
        for bi in range(6):
            bxp = mx - 0.28 + (bi % 3) * 0.28
            byp = my_ - 0.12 + (bi // 3) * 0.24
            box("my_brick_dry", 0.16, 0.1, 0.08, (bxp, byp, 0.1),
                P["brick"] if (bi + mi) % 2 else P["grey"])

    # shade canopy: moved to the open front-right (its old back-right pitch
    # buried two posts inside the kiln's base course) and its post heights are
    # solved against the tilted mat so none can pierce it (judge R15-1a)
    canopy("my_matting_canopy", 0.95, 0.80, (1.12, -1.02, 0.92), 7,
           P["thatch"], P, thick=0.045, ground=0.08, pole_r=0.03, inset=0.1)

    # clay baskets + pot
    basket("my", -1.3, -0.85, 0.08, P, r=0.13, fill="grey")
    basket("my2", -1.05, -1.1, 0.08, P, r=0.11, fill="grey")
    basket("my3", 1.10, -1.02, 0.08, P, r=0.11, fill="grey")   # under canopy
    sphere("my_grey_clay", 0.07, (-1.3, -0.85, 0.2), P["grey"], seg=7)
    amphora("my", 1.52, -0.20, 0.08, P, s=1.0)


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
    """AN EXCAVATED BOWL, not a box: an irregular cut with terraced working
    steps, tool marks on the treads, clay darkening toward the bottom, water
    standing in the deepest part, spoil tipped on the rim and bricks drying.

    ON GRADE — the one fact that shapes this whole kit. kitLoader normalises
    every kit so its LOWEST vertex sits on y = 0, so a kit cannot dig into the
    terrain by itself: authoring the floor at -0.4 would simply lift the whole
    pit 0.4 into the air. The floor is therefore at z = 0 and the excavation is
    read from the ground built UP around it — which is also what a working dig
    looks like once its spoil is on the lip. Terrain support that would let it
    sit genuinely below grade is described in the report; the kit does not need
    it to read as a pit.

    SECTION, outside -> in. Each ring's bottom is exactly the previous ring's
    top, so no two walls are ever coplanar and nothing can z-fight:
      sand skirt   0.000-0.018   feathers into the desert, and passes under
                                 the river plane (y 0.04) on the water side
      outer berm   0.000-0.115
      inner berm   0.115-0.255
      RIM          0.255-0.385   <- highest ground, the lip of the cut
      terrace 1    0.125-0.255
      terrace 2    0.055-0.125
      wet floor    0.000-0.055 + a clay pan and standing water
    """
    import random
    rnd = random.Random(59)

    L0 = loop(0.0, 0.0, 1.32, n=32, wob=0.055, sq=1.03, rnd=rnd)
    L1 = inset_loop(L0, 0.20, 0.30, rot=0.7, toward=(0.10, -0.08))
    L2 = inset_loop(L1, 0.20, 0.32, rot=2.0, toward=(-0.09, 0.11))
    L3 = inset_loop(L2, 0.19, 0.34, rot=3.3, toward=(0.12, 0.05))
    L4 = inset_loop(L3, 0.19, 0.34, rot=4.5, toward=(-0.06, -0.10))
    L5 = inset_loop(L4, 0.20, 0.30, rot=5.6, toward=(0.05, 0.08))
    cx0, cy0 = _centroid(L0)
    # skirt derived FROM L0 by scaling out, so it can never fall inside the
    # berm and leave the berm's 115 mm wall standing in open sand
    skirt = [(cx0 + (x - cx0) * (1.06 + 0.055 * math.sin(4.0 * i)),
              cy0 + (y - cy0) * (1.06 + 0.055 * math.sin(4.0 * i)))
             for i, (x, y) in enumerate(L0)]

    prism("cp_sand_skirt", skirt, 0.018, 0.0, P["sand"])
    # Five materials, pale outside to dark inside: dry sand, wind-blown tan,
    # the cut face of the clay bed, wet worked clay, saturated bottom. The
    # first build ran sand/mud_tan/mud_tan down the outside and the three
    # outer levels photographed as one tone, which is a stepped mound, not a
    # cut. Every neighbour is now 25+ levels apart at source.
    ring("cp_sand_berm", L0, L1, 0.000, 0.115, P["sand"])
    ring("cp_mud_berm2", L1, L2, 0.115, 0.140, P["mud_tan"])
    ring("cp_mud_rim", L2, L3, 0.255, 0.130, P["mud"])
    ring("cp_mud_terr1", L3, L4, 0.125, 0.130, P["mud_dk"])
    ring("cp_soil_terr2", L4, L5, 0.055, 0.070, P["soil"])
    # the floor is the PRODUCT: raw grey river clay, and the only cool tone
    # in the kit, so the eye lands in the bottom of the hole
    prism("cp_grey_floor", L5, 0.055, 0.0, P["grey"])

    # wet clay pan in the bottom + the water standing in it, the surface 6 mm
    # under the pan's own rim so it reads as held, not painted on
    pan = inset_loop(L5, 0.16, 0.30, rot=1.1, toward=(0.02, -0.03))
    pool("cp_pool", pan, 0.055, 0.030, 0.018, P["mud_dk"], P["water"],
         inset=0.24)

    def on(a, b, i, t):
        """Point at parameter t across the tread between loops a and b. Every
        prop below is placed this way instead of by absolute xy: the loops
        wobble, and a basket at a hand-picked radius lands on whichever step
        the wobble happened to put there."""
        i %= len(a)
        return (a[i][0] + (b[i][0] - a[i][0]) * t,
                a[i][1] + (b[i][1] - a[i][1]) * t)

    # ---- tool marks. Spade cuts across each tread, radial and only 4 mm
    # proud: at board zoom this is a texture of short shadows on a step, which
    # is what says "worked" without touching the silhouette.
    for lo, li, lz in ((L2, L3, 0.385), (L3, L4, 0.255), (L4, L5, 0.125)):
        for _ in range(8):
            i = rnd.randrange(len(lo))
            gx, gy = on(lo, li, i, 0.24 + rnd.random() * 0.52)
            box("cp_mud_gouge", 0.048 + rnd.random() * 0.040,
                0.095 + rnd.random() * 0.085, 0.016, (gx, gy, lz - 0.012),
                P["mud_dk"], rz=math.atan2(gy - cy0, gx - cx0))
    # clay cut out of the bottom step and left on the floor
    for _ in range(7):
        i = rnd.randrange(len(L5))
        gx, gy = on(L5, pan, i, 0.15 + rnd.random() * 0.6)
        sphere("cp_grey_lump", 0.042 + rnd.random() * 0.032, (gx, gy, 0.055),
               P["grey"], seg=6)

    # ---- plank barrow run: two flights, rim -> terrace 1 -> floor. rz comes
    # from the run vector and rx from its fall, so each plank actually touches
    # both of its ends instead of hovering over the steps.
    def plank(a, b, w=0.38):
        dx, dy, dz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
        run = math.hypot(dx, dy)
        box("cp_wood_ramp", w, math.hypot(run, dz), 0.05,
            ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 - 0.025),
            P["wood"], rz=math.atan2(dy, dx) - math.pi / 2,
            rx=math.atan2(dz, run))
    iR = 22                                    # the -Y / camera-facing side
    top = on(L2, L3, iR, 0.42) + (0.385,)
    mid = on(L3, L4, iR + 1, 0.55) + (0.255,)
    bot = on(L5, pan, iR + 2, 0.30) + (0.075,)
    plank(top, mid)
    plank(mid, bot, w=0.34)

    # ---- spoil tipped on the inner berm: three different sizes, lumpy, one
    # of them spilling over the rim. A clean cone reads as a tent (judge R10).
    # Lower and darker than the first build, where 0.48-tall pale cones grew
    # off the rim and the pit photographed as a volcano.
    for i, (sr, sh, smat) in enumerate(((0.34, 0.30, P["mud"]),
                                        (0.26, 0.20, P["soil"]),
                                        (0.30, 0.24, P["mud_dk"]))):
        sx, sy = on(L1, L2, 5 + i * 11, 0.45)
        mound("cp_spoil", sx, sy, sr, sh, smat, rnd, z=0.24,
              rot=rnd.random() * 3.0)
    # shovel laid ON the berm. Struck upright into the heap it read at board
    # zoom as a hammer on a pole standing over the whole settlement.
    shx, shy = on(L1, L2, 8, 0.55)
    cyl("cp_wood_shovel", 0.020, 0.52, (shx, shy, 0.235), P["wood_dk"],
        seg=6, ry=math.radians(90), rz=math.radians(-38))
    box("cp_grey_blade", 0.055, 0.13, 0.045,
        (shx - 0.30, shy + 0.24, 0.235), P["grey"], rz=math.radians(-38))

    # ---- drying floor: green bricks laid on the outer berm in courses that
    # follow the rim's curve, plus a rack holding a second batch off the mud
    for r, t in enumerate((0.30, 0.52, 0.74)):
        for c in range(5):
            bx2, by2 = on(L0, L1, 24 + c, t)
            box("cp_brick_dry", 0.115, 0.075, 0.045,
                (bx2 + rnd.uniform(-0.02, 0.02),
                 by2 + rnd.uniform(-0.02, 0.02), 0.115), P["brick"],
                rz=math.atan2(by2 - cy0, bx2 - cx0) + rnd.uniform(-0.1, 0.1))
    rk0 = on(L0, L1, 18, 0.45)
    rk1 = on(L0, L1, 20, 0.45)
    for rk in (rk0, rk1):
        cyl("cp_wood_rackleg", 0.028, 0.40, (rk[0], rk[1], 0.115),
            P["wood_dk"], seg=7)
    rkm = ((rk0[0] + rk1[0]) / 2, (rk0[1] + rk1[1]) / 2)
    rka = math.atan2(rk1[1] - rk0[1], rk1[0] - rk0[0])
    box("cp_wood_rackrail", math.hypot(rk1[0] - rk0[0], rk1[1] - rk0[1]) + 0.12,
        0.07, 0.05, (rkm[0], rkm[1], 0.49), P["wood"], rz=rka)
    for i in range(4):
        bx2 = rkm[0] + math.cos(rka) * (-0.21 + i * 0.14)
        by2 = rkm[1] + math.sin(rka) * (-0.21 + i * 0.14)
        box("cp_brick_rack", 0.11, 0.075, 0.045, (bx2, by2, 0.54), P["brick"],
            rz=rka + rnd.uniform(-0.08, 0.08))

    # ---- tripod hoist over the pool. Feet come from the RIM ring's own tread,
    # so no leg can land on a step it was not meant to stand on.
    n2 = len(L2)
    apx, apy = _centroid(L5)
    apz = 0.385 + 0.80
    for k in range(3):
        fx2, fy2 = on(L2, L3, k * n2 // 3 + 4, 0.5)
        dx, dy, dz = apx - fx2, apy - fy2, apz - 0.385
        L = math.sqrt(dx * dx + dy * dy + dz * dz)
        cyl("cp_wood_tripod", 0.030, L,
            (fx2 + dx / 2, fy2 + dy / 2, 0.385 + dz / 2 - L / 2),
            P["wood_dk"], seg=7,
            ry=math.acos(max(-1.0, min(1.0, dz / L))), rz=math.atan2(dy, dx))
    cyl("cp_rope_lash", 0.070, 0.085, (apx, apy, apz - 0.10), P["rope"], seg=8)
    cyl("cp_rope_hoist", 0.013, 0.58, (apx, apy, apz - 0.70), P["rope"], seg=6)
    basket("cp_hang", apx, apy, apz - 0.76, P, r=0.09, h=0.11, fill="grey")

    # ---- rim clutter, all on the outer berm tread
    for i in range(3):
        px, py = on(L0, L1, 8 + i * 3, 0.35 + 0.2 * i)
        sphere(f"cp_grey_clay{i}", 0.10, (px, py, 0.115), P["grey"], seg=7)
        sphere(f"cp_grey_clay{i}b", 0.075, (px + 0.15, py - 0.08, 0.115),
               P["grey"], seg=7)
    bk = on(L0, L1, 29, 0.40)
    basket("cp", bk[0], bk[1], 0.115, P, r=0.12, fill="grey")
    bk2 = on(L0, L1, 30, 0.62)
    basket("cp2", bk2[0], bk2[1], 0.115, P, r=0.10, fill="grey")
    am = on(L0, L1, 14, 0.55)
    amphora("cp", am[0], am[1], 0.115, P, s=0.9)
    for i in (2, 13):
        px, py = on(L0, L1, i, 0.70)
        cyl("cp_wood_stake", 0.03, 0.34, (px, py, 0.115), P["wood_dk"], seg=6)


# ---------------------------------------------------------------- MARSH REED BED
def build_marsh_reed_bed(P):
    """A WETLAND FRINGE on the bank, not a bordered paddy grid: reeds thin out
    into standing water on the river side (-X) and into dry sand on the desert
    side (+X), clumped in eight drifts of very different density rather than
    one clump per quadrant, with pools held in mud rims, a cut/harvested patch
    and the bundles that came off it.

    Ground stack (FLAT is the mud flat's top; everything on the flat is placed
    off that constant, because a slab authored inside the flat never renders):
      0.000-0.030  fringe silt. Under the 0.04 river plane, so on the water
                   side the bed's edge dissolves instead of ending on a line
      0.030-FLAT   the mud flat proper
      FLAT-+0.020  the saturated lobe (-X) and the dry sand lobe (+X)
      FLAT-+0.046  pool rims, water surface 18 mm below their tops

    Mesh names must not contain 'reed': kitLoader keys a bob animation off that
    word and merge_by_material only strips it from the KIND.
    """
    import random
    rnd = random.Random(41)
    greens = ("crop_gr", "crop_dk", "crop_lt")
    FLAT = 0.078

    prism("mr_soil_fringe",
          loop(0.0, 0.0, 1.44, n=34, wob=0.135, sq=1.06, rnd=rnd),
          0.030, 0.0, P["soil"])
    prism("mr_soil_flat",
          loop(0.06, -0.02, 1.24, n=32, wob=0.150, sq=1.10, rot=0.8, rnd=rnd),
          FLAT - 0.030, 0.030, P["soil"])
    # saturated lobe on the river side, drying lobe on the desert side, sand
    # only at the very tip: the whole point of the kit is that gradient
    prism("mr_mud_wet",
          loop(-0.80, 0.06, 0.58, n=22, wob=0.22, sq=1.90, rot=1.1, rnd=rnd),
          0.020, FLAT, P["mud_dk"])
    prism("mr_mud_drying",
          loop(0.80, -0.04, 0.54, n=22, wob=0.22, sq=1.85, rot=0.4, rnd=rnd),
          0.020, FLAT, P["mud_tan"])
    prism("mr_sand_dry",
          loop(1.12, -0.10, 0.30, n=18, wob=0.24, sq=1.70, rot=2.2, rnd=rnd),
          0.014, FLAT + 0.020, P["sand"])

    # ---- standing water, four pockets, all different. pool() puts the water
    # through a HOLE in its rim; a rim prism with the water laid on top buries
    # the water inside the rim solid and it never renders at all.
    for pi, (px, py, pr, ps, prot) in enumerate((
            (-0.86, -0.62, 0.34, 1.30, 0.5),
            (-1.00, 0.66, 0.28, 1.35, 1.9),
            (-0.34, 1.00, 0.22, 1.05, 3.0),
            (-0.26, -1.06, 0.19, 0.95, 4.2))):
        pool(f"mr_pool{pi}",
             loop(px, py, pr, n=18, wob=0.19, sq=ps, rot=prot, rnd=rnd),
             FLAT, 0.046, 0.028, P["mud_dk"], P["water"], inset=0.24)

    # ---- drifts. cx, cy, rx, ry, rot, stalk count, height scale. Count and
    # height fall off toward the dry side: that gradient IS the wetland.
    drifts = ((-0.74, -0.10, 0.50, 0.34, 0.5, 26, 1.00),
              (-0.48, 0.62, 0.44, 0.30, 1.4, 21, 0.96),
              (-0.94, 1.02, 0.32, 0.23, 0.2, 15, 0.90),
              (-0.60, -1.14, 0.30, 0.20, -0.3, 12, 0.88),
              (0.04, -0.60, 0.44, 0.31, -0.6, 17, 0.90),
              (0.30, 0.84, 0.36, 0.25, 0.9, 11, 0.80),
              (0.72, 0.08, 0.32, 0.21, 2.1, 7, 0.70),
              (0.94, -0.56, 0.24, 0.17, 1.2, 4, 0.60))
    for di, (cx, cy, rx, ry, rot, nst, hs) in enumerate(drifts):
        for mi in range(2):
            f = 1.0 - mi * 0.32
            pl = [(cx + ax * rx * f * math.cos(rot) - ay * ry * f * math.sin(rot),
                   cy + ax * rx * f * math.sin(rot) + ay * ry * f * math.cos(rot))
                  for ax, ay in loop(0, 0, 1.0, n=14, wob=0.22, rnd=rnd)]
            prism("mr_mass", pl, 0.10 * hs, FLAT + mi * 0.082 * hs,
                  P[greens[(di + mi) % 3]], taper=0.16)
        for _ in range(nst):
            a2 = rnd.random() * math.pi * 2
            rr = math.sqrt(rnd.random()) * 1.18
            wx, wy = rot2(math.cos(a2) * rx * rr, math.sin(a2) * ry * rr, rot)
            th = (0.30 + rnd.random() * 0.34) * hs
            cyl("mr_stalk", 0.013 + rnd.random() * 0.008, th,
                (cx + wx, cy + wy, FLAT - 0.010),
                P[greens[rnd.randrange(3)]], seg=5,
                rx=rnd.uniform(-0.13, 0.13), ry=rnd.uniform(-0.13, 0.13))
            if rnd.random() > 0.5:
                box("mr_crop_head", 0.034, 0.034, 0.062,
                    (cx + wx, cy + wy, FLAT + th * 0.92), P["crop_g"])

    # ---- strays between the drifts, thinning toward the dry (+X) edge. This
    # is what turns eight clumps into one continuous bed.
    for _ in range(90):
        sx = rnd.uniform(-1.30, 1.26)
        sy = rnd.uniform(-1.34, 1.34)
        if (sx / 1.26) ** 2 + (sy / 1.38) ** 2 > 1.0:
            continue
        if rnd.random() > 0.86 - 0.62 * (sx + 1.30) / 2.56:
            continue
        th = 0.16 + rnd.random() * 0.30
        cyl("mr_stray", 0.013, th, (sx, sy, FLAT - 0.016),
            P[greens[rnd.randrange(3)]], seg=5, rx=rnd.uniform(-0.22, 0.22))

    # ---- the cut patch: stubble where a stand has been harvested, on the dry
    # side where a cutter could actually stand
    ctx, cty = 0.48, -0.96
    prism("mr_mud_cutpatch",
          loop(ctx, cty, 0.44, n=18, wob=0.19, sq=0.80, rot=0.5, rnd=rnd),
          0.018, FLAT, P["mud_tan"])
    for _ in range(34):
        a2 = rnd.random() * math.pi * 2
        rr = math.sqrt(rnd.random())
        cyl("mr_stub", 0.016, 0.048 + rnd.random() * 0.055,
            (ctx + math.cos(a2) * 0.40 * rr, cty + math.sin(a2) * 0.30 * rr,
             FLAT + 0.012), P["thatch_dk"], seg=5)

    # ---- what came off it: a bundle stack plus two stooks stood on end
    for i, (bx2, by2, bz2) in enumerate(((1.00, -0.42, FLAT + 0.020),
                                         (0.94, -0.58, FLAT + 0.020),
                                         (0.97, -0.50, FLAT + 0.162))):
        lying("mr_thatch_bundle", 0.070, 0.56, bx2, by2, bz2, P["thatch"],
              rz=math.radians(-14 + i * 9))
        lying("mr_rope_tie", 0.076, 0.034, bx2, by2, bz2, P["rope"],
              rz=math.radians(-14 + i * 9), seg=8)
    for i, (sx, sy) in enumerate(((0.22, -1.32), (0.36, -1.24))):
        cyl("mr_thatch_stook", 0.062, 0.46, (sx, sy, FLAT), P["thatch"],
            seg=7, rx=math.radians(13 - i * 24), ry=math.radians(8),
            rz=math.radians(30 * i), rtop=0.038)

    # ---- mud causeway out to the water, and the drying frame at its dry end
    cw = curve([(1.24, -0.62), (0.82, -0.32), (0.22, -0.14),
                (-0.32, -0.40), (-0.84, -0.82), (-1.14, -0.98)], steps=5)
    strip("mr_mud_causeway", cw, 0.105, 0.024, FLAT, P["mud_tan"])
    for px in (0.98, 0.54):
        cyl("mr_wood_post", 0.030, 0.50, (px, 0.60, FLAT - 0.010),
            P["wood_dk"], seg=7)
    box("mr_wood_rail", 0.50, 0.045, 0.045, (0.76, 0.60, FLAT + 0.442),
        P["wood"])
    for i in range(5):
        cyl("mr_thatch_dry", 0.026, 0.30, (0.94 - i * 0.09, 0.60, FLAT + 0.230),
            P["thatch"], seg=6, rx=math.radians(9), rz=rnd.random())
    basket("mr", 1.04, 0.22, FLAT + 0.008, P, r=0.10, fill="crop_gr")


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
    canopy("tg_matting_shade", 1.25, 1.05, (ax, ay, 1.10), 8, P["thatch"], P,
           thick=0.045, ground=0.08, pole_r=0.03, inset=0.105)
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
    """Board 09 GRANARY: the beehive silos LEAD — enlarged and pushed to the
    front-left so the silhouette is unmistakably a grain store; tall pivoting
    grain-scoop / measuring post; bakehouse hall pushed back-right with a
    PLANK roof (per-kind roof read: plank, vs mat / thatch on the other
    shop-tier kits)."""
    base = box("rh_dirt_apron", 3.0, 2.9, 0.05, (0, 0, 0), P["dirt"])
    bevel(base, 0.02)

    # ---- HERO SILHOUETTE: beehive granary silos, front-left, oversized ----
    silos = ((-0.72, -0.75, 1.75), (-0.95, 0.08, 1.35), (0.05, -1.05, 1.15))
    for i, (sx, sy, s) in enumerate(silos):
        # low mud plinth so each silo sits on a built pad
        cyl(f"rh_mud_silopad{i}", 0.34 * s, 0.07, (sx, sy, 0.05), P["mud_dk"],
            seg=8)
        # faceted body: seg 8 keeps the taper flat-shaded (no smooth gradient)
        cyl(f"rh_mud_silo{i}", 0.28 * s, 0.56 * s, (sx, sy, 0.12), P["mud_tan"],
            seg=8, rtop=0.2 * s)
        # mud banding hoops — a plain tapered mass would greybox at 3x
        for hi, t in enumerate((0.3, 0.62)):
            cyl(f"rh_mud_silohoop{i}{hi}", (0.28 - 0.08 * t) * s + 0.012,
                0.035, (sx, sy, 0.12 + t * 0.56 * s), P["mud"], seg=8)
        sphere(f"rh_mud_silocap{i}", 0.21 * s,
               (sx, sy, 0.12 + 0.56 * s - 0.17 * s), P["mud_tan"], seg=6)
        cyl(f"rh_wood_silovent{i}", 0.05 * s, 0.1 * s,
            (sx, sy, 0.12 + 0.56 * s + 0.2 * s), P["wood_dk"], seg=6)
        box(f"rh_dark_silohatch{i}", 0.085 * s, 0.05, 0.1 * s,
            (sx, sy - 0.255 * s, 0.32 * s), P["dark"])
        box(f"rh_wood_silolintel{i}", 0.12 * s, 0.05, 0.035,
            (sx, sy - 0.26 * s, 0.32 * s + 0.1 * s), P["wood_dk"])
    # loading ladder: foot planted ON the apron, head resting against the
    # silo body just BELOW the cap. It used to hang with its feet in the air
    # and its head buried inside the dome (judge R15-1d).
    lad_a, lad_len = math.radians(-15.3), 0.985
    for s_ in (-1, 1):
        cyl("rh_wood_ladrail", 0.022, lad_len,
            (-0.72 + s_ * 0.09, -1.244, 0.0325), P["wood_dk"], seg=6, rx=lad_a)
    for i in range(5):
        t = 0.15 + 0.175 * i
        box("rh_wood_ladrung", 0.2, 0.032, 0.032,
            (-0.72, -1.374 + t * 0.26, 0.05 + t * 0.95 - 0.016),
            P["wood_dk"], rx=lad_a)
    # granary court wall behind the silos (left + back returns)
    box("rh_mud_granwall", 0.16, 1.5, 0.4, (-1.36, 0.4, 0.05), P["mud"])
    box("rh_mud_granwallband", 0.19, 1.5, 0.05, (-1.36, 0.4, 0.24),
        P["mud_tan"])
    box("rh_mud_granwallcap", 0.2, 1.54, 0.05, (-1.36, 0.4, 0.45), P["mud_dk"])
    box("rh_mud_granwall2", 0.95, 0.16, 0.4, (-0.9, 1.1, 0.05), P["mud"])
    box("rh_mud_granwallband2", 0.95, 0.19, 0.05, (-0.9, 1.1, 0.24),
        P["mud_tan"])
    box("rh_mud_granwallcap2", 0.99, 0.2, 0.05, (-0.9, 1.1, 0.45), P["mud_dk"])
    # stored grain inside the court so the enclosure never reads as an
    # empty trough at board zoom
    basket("rh_gw1", -1.15, 0.85, 0.05, P, r=0.13, fill="crop_g")
    basket("rh_gw2", -1.18, 0.6, 0.05, P, r=0.11, fill="crop_g")
    sk2 = box("rh_linen_sackw", 0.26, 0.22, 0.22, (-0.6, 0.92, 0.05),
              P["linen"], rz=0.5)
    bevel(sk2, 0.04)

    # ---- HERO PROP: tall pivoting grain-scoop / measuring post ----
    gx, gy = 0.55, -0.9
    cyl("rh_wood_scooppost", 0.06, 1.46, (gx, gy, 0.05), P["wood_dk"], seg=8)
    cyl("rh_wood_scoopfoot", 0.13, 0.07, (gx, gy, 0.05), P["wood_dk"], seg=8)
    box("rh_wood_scoopbrace", 0.05, 0.05, 0.55, (gx, gy + 0.2, 0.5),
        P["wood_dk"], rx=math.radians(22))
    box("rh_wood_scoopbeam", 0.06, 0.98, 0.06, (gx, gy, 1.51), P["wood"],
        rx=math.radians(20))
    cyl("rh_rope_scooprope", 0.014, 0.42, (gx, -1.34, 0.95), P["rope"], seg=6)
    cyl("rh_wood_scoop", 0.13, 0.18, (gx, -1.34, 0.77), P["wood"], seg=8,
        rtop=0.16)
    cyl("rh_crop_scoopfill", 0.14, 0.035, (gx, -1.34, 0.93), P["crop_g"],
        seg=8)
    # rope-bound stone counterweight on the tail of the beam
    sphere("rh_mud_scoopweight", 0.13, (gx, -0.42, 1.58), P["mud_dk"], seg=7)
    cyl("rh_rope_weightband", 0.145, 0.04, (gx, -0.42, 1.69), P["rope"], seg=8)
    # graduated measuring rod stood against the post
    box("rh_wood_measurerod", 0.04, 0.04, 0.95, (gx - 0.22, gy + 0.07, 0.05),
        P["wood"], ry=math.radians(-9))
    for i in range(4):
        box("rh_char_measuremark", 0.052, 0.052, 0.025,
            (gx - 0.24 + i * 0.02, gy + 0.07, 0.22 + i * 0.2), P["char"],
            ry=math.radians(-9))

    # ---- bakehouse hall, pushed back-right so the silos lead ----
    hx, hy = 0.5, 0.55
    hall = frustum("rh_mud_hall", 1.75, 1.45, 1.55, 1.25, 1.05,
                   (hx, hy, 0.05), P["mud_tan"])
    bevel(hall, 0.025)
    box("rh_stone_string", 1.72, 1.42, 0.06, (hx, hy, 0.78), P["stone"])
    box("rh_mud_parapet", 1.62, 1.34, 0.09, (hx, hy, 1.10), P["mud_dk"])
    # PLANK ROOF: cross joists + sawn boards in alternating wood tones
    for i in range(4):
        box("rh_wood_joist", 1.5, 0.06, 0.045, (hx, 0.05 + i * 0.33, 1.10),
            P["wood_dk"])
    for i in range(7):
        box("rh_wood_roofplank", 0.19, 1.26, 0.05,
            (hx - 0.63 + i * 0.21, hy, 1.145),
            P["wood"] if i % 2 else P["wood_dk"])
    box("rh_wood_roofridge", 1.36, 0.09, 0.045, (hx, hy, 1.195), P["wood_dk"])
    # chimney stub, back-left of the hall
    box("rh_mud_chimney", 0.2, 0.2, 0.34, (-0.12, 1.02, 1.10), P["mud_tan"])
    box("rh_dark_chimtop", 0.12, 0.12, 0.05, (-0.12, 1.02, 1.44), P["dark"])
    # roof drying: mat + grain rows on the planks
    box("rh_matting_roof", 0.52, 0.42, 0.03, (hx + 0.3, hy + 0.2, 1.195),
        P["thatch"])
    for i in range(2):
        box("rh_crop_dryrow", 0.44, 0.1, 0.045,
            (hx + 0.3, hy + 0.1 + i * 0.2, 1.225), P["crop_g"],
            rz=0.05 * (i * 2 - 1))

    # arched oven mouth on the hall front face
    fy = -0.19
    cyl("rh_pot_ovenarch", 0.34, 0.1, (0.18, fy - 0.03, 0.31), P["pot"],
        seg=16, rx=math.radians(90))
    cyl("rh_dark_oventhroat", 0.24, 0.08, (0.18, fy - 0.05, 0.32),
        P["dark"], seg=14, rx=math.radians(90))
    cyl("rh_cl_ovenwarm", 0.13, 0.03, (0.18, fy - 0.115, 0.285),
        P["cl_org"], seg=10, rx=math.radians(90))
    box("rh_stone_ovenshelf", 0.66, 0.26, 0.1, (0.18, fy - 0.14, 0.05),
        P["stone"])
    box("rh_stone_ovenshelfband", 0.68, 0.06, 0.03, (0.18, fy - 0.26, 0.12),
        P["mud_dk"])
    sphere("rh_linen_bread", 0.06, (0.04, fy - 0.16, 0.17), P["linen"], seg=7)
    sphere("rh_linen_bread2", 0.05, (0.32, fy - 0.18, 0.17), P["linen"], seg=7)

    # door right of the oven — warm interior fill, not a black slot
    recess("rh_door", 0.38, 0.64, 1.05, -0.15, 0.05, P, d=0.14, ring=0.05)
    box("rh_wood_doorlintel", 0.5, 0.17, 0.09, (1.05, -0.195, 0.69),
        P["wood_dk"])

    # serving counter with awning (front-right, fully on the apron)
    cx, cy = 1.1, -0.78
    box("rh_mud_counter", 0.78, 0.4, 0.46, (cx, cy, 0.05), P["mud_dk"])
    box("rh_linen_countertop", 0.84, 0.46, 0.04, (cx, cy, 0.51), P["linen"])
    box("rh_wood_breadboard", 0.34, 0.22, 0.03, (cx - 0.16, cy - 0.02, 0.55),
        P["wood"])
    sphere("rh_crop_loaf", 0.05, (cx - 0.22, cy - 0.04, 0.58), P["crop_g"],
           seg=7)
    sphere("rh_crop_loaf2", 0.045, (cx - 0.08, cy + 0.02, 0.58), P["crop_g"],
           seg=7)
    basket("rh_c", cx + 0.22, cy + 0.04, 0.55, P, r=0.09, fill="crop_g")
    # free-standing stall canopy on four solved posts. The old cloth hung off
    # nothing at its back edge and its two poles stopped 10 cm short of the
    # underside (judge R15-3).
    awning("rh_cloth_awn", 0.78, 0.62, (cx, -0.52, 1.06), 22, P["cl_org"], P,
           front_poles=(cx - 0.36, cx + 0.36),
           back_poles=(cx - 0.36, cx + 0.36), ground=0.05, pole_r=0.026,
           stripe=P["linen"], stripe_frac=0.20)

    # grain sacks + baskets clustered at the silo feet (granary yard read)
    for i, (px, py, sc) in enumerate(((-1.2, -0.62, 1.0), (-1.05, -0.9, 0.85),
                                      (-0.28, -1.3, 0.95))):
        sk = box(f"rh_linen_sack{i}", 0.26 * sc, 0.22 * sc, 0.22 * sc,
                 (px, py, 0.05), P["linen"], rz=0.35 * (i + 1))
        bevel(sk, 0.04)
    basket("rh_g1", -0.48, -1.32, 0.05, P, r=0.13, fill="crop_g")
    basket("rh_g2", -1.25, -0.28, 0.05, P, r=0.11, fill="crop_g")
    amphora("rh_j1", 1.38, -0.15, 0.05, P, s=1.1)


# ---------------------------------------------------------------- LUXURY MATERIAL
def build_luxury_material(P):
    """Board 07 raw side: stone/ingot yard — heavy rack, white-stone block
    stacks, copper ingot piles, gem crate, rope-bound bundles, canopy,
    workbench."""
    import random as _rnd
    rr = _rnd.Random(23)
    base = box("lm_dirt_base", 2.8, 2.8, 0.08, (0, 0, 0), P["dirt"])
    bevel(base, 0.02)
    # WORKING YARD FLOOR (was a bare grey stone tray): packed earth, scuffed
    # traffic patch, scattered quarry chips, a rope coil and a leaning lever
    box("lm_earth_pad", 1.55, 1.25, 0.045, (-0.45, -0.35, 0.08), P["earth"])
    box("lm_soil_scuff", 0.92, 0.6, 0.012, (-0.42, -0.5, 0.125), P["soil"],
        rz=0.22)
    box("lm_dirt_scuff2", 0.6, 0.42, 0.012, (-0.78, -0.05, 0.125), P["dirt"],
        rz=-0.3)
    for i in range(16):
        cxp = -0.45 + (rr.random() - 0.5) * 1.34
        cyp = -0.35 + (rr.random() - 0.5) * 1.04
        ss = 0.05 + rr.random() * 0.07
        box("lm_stone_chip", ss, ss * 0.7, ss * 0.5, (cxp, cyp, 0.125),
            P["stone_wm"] if i % 3 else P["stone_gv"], rz=rr.random() * 3.1)
    torus("lm_rope_coil", 0.115, 0.03, (-0.98, -0.68, 0.125), P["rope"])
    torus("lm_rope_coil2", 0.08, 0.024, (-0.86, -0.6, 0.185), P["rope"])
    # long iron-shod lever leaning off the block stack onto the yard floor
    cyl("lm_wood_lever", 0.03, 0.86, (-0.5, -0.62, 0.32), P["wood"], seg=7,
        rx=math.radians(38), rz=math.radians(24))
    box("lm_char_leverhead", 0.05, 0.05, 0.14, (-0.63, -0.4, 0.62), P["char"],
        rx=math.radians(38), rz=math.radians(24))
    # sled runner + timber offcuts: the yard reads as a moving/cutting surface
    for i in range(2):
        box("lm_wood_runner", 0.09, 0.7, 0.05, (-0.12 + i * 0.3, -0.28, 0.125),
            P["wood_dk"], rz=0.06)

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
        sb = box("lm_stone_shelfblock", 0.32, 0.24, 0.2,
                 (-0.85 + i * 0.36, ry0, 0.46), P["stone_wm"],
                 rz=0.06 * (i - 1))
        bevel(sb, 0.03)
        box("lm_stone_shelfband", 0.33, 0.25, 0.026,
            (-0.85 + i * 0.36, ry0, 0.56), P["stone_gv"], rz=0.06 * (i - 1))
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

    # CUT LIMESTONE blocks: chamfered, warm quarry tone, with a proud banding
    # course and chisel grooves so they never read as untextured greybox
    def cut_block(nm, w, d, h, loc, rz=0.0):
        b = box(nm, w, d, h, loc, P["stone_wm"], rz=rz)
        bevel(b, 0.035)
        cc, ssn = math.cos(rz), math.sin(rz)

        def off(dx, dy):
            return (loc[0] + dx * cc - dy * ssn, loc[1] + dx * ssn + dy * cc)
        # proud banding strip round the waist (the sawn course line)
        bx, by = off(0, 0)
        box(nm + "_band", w * 1.03, d * 1.03, 0.042,
            (bx, by, loc[2] + h * 0.5), P["stone_gv"], rz=rz)
        # vertical chisel grooves on the two long faces
        for s in (-1, 1):
            gx, gy = off(s * w * 0.27, 0)
            box(nm + "_groove", 0.028, d * 1.03, h * 0.78, (gx, gy,
                loc[2] + h * 0.11), P["stone_gv"], rz=rz)
        # top face is what the iso camera sees most: a rusticated raised boss
        # plus a chiselled cross-groove, so the cap is never a flat white lid
        tx, ty = off(0, 0)
        box(nm + "_boss", w * 0.66, d * 0.62, 0.022, (tx, ty, loc[2] + h),
            P["stone_wm"], rz=rz)
        box(nm + "_topgv", w * 1.0, 0.03, 0.028, (tx, ty, loc[2] + h - 0.004),
            P["stone_gv"], rz=rz)
        for s in (-1, 1):
            gx2, gy2 = off(s * w * 0.2, 0)
            box(nm + "_topgv2", 0.026, d * 1.0, 0.028,
                (gx2, gy2, loc[2] + h - 0.004), P["stone_gv"], rz=rz)
        return b
    sx0, sy0 = -1.0, -0.15
    for c, n in ((0, 2), (1, 2)):
        for i in range(n):
            cut_block("lm_stone_block", 0.52, 0.36, 0.26,
                      (sx0 + (i - 0.5) * 0.56, sy0, 0.08 + c * 0.26),
                      rz=0.04 * (c + i))
    cut_block("lm_stone_blockcap", 0.5, 0.34, 0.24, (sx0 - 0.1, sy0 + 0.05,
              0.6), rz=0.12)
    # rough offcut wedges at the stack foot (quarry debris, not tidy boxes)
    for i, (ox, oy, ow) in enumerate(((-1.32, -0.62, 0.24), (-0.5, 0.08, 0.2),
                                      (-1.28, 0.3, 0.26))):
        frustum("lm_stone_offcut", ow, ow * 0.8, ow * 0.6, ow * 0.5, ow * 0.55,
                (ox, oy, 0.08), P["stone_wm"], rz=0.5 * i)
        box("lm_stone_offcutband", ow * 1.02, ow * 0.82, 0.022,
            (ox, oy, 0.08 + ow * 0.3), P["stone_gv"], rz=0.5 * i)

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

    # SAGGING CANVAS over the crate corner (was a flat quad tarp on 4 sticks):
    # stout poles + cross-beams + 3 angled cloth panels that dip in the middle,
    # rope lashings at every head and two guy lines pegged to the ground
    cnx = 0.9
    canpoles = ((0.5, -1.15, 1.12), (1.3, -1.15, 1.12),
                (0.5, 0.0, 0.97), (1.3, 0.0, 0.97))
    for (px, py, ph) in canpoles:
        cyl("lm_wood_canpole", 0.05, ph, (px, py, 0.08), P["wood_dk"], seg=8)
        cyl("lm_wood_canfoot", 0.085, 0.055, (px, py, 0.08), P["wood_dk"],
            seg=8)
        cyl("lm_rope_cantie", 0.062, 0.055, (px, py, 0.08 + ph - 0.12),
            P["rope"], seg=8)
    # cross-beams tying each pole pair (the canvas is slung between them)
    for (py, pz) in ((-1.15, 1.15), (0.0, 1.0)):
        box("lm_wood_canbeam", 0.94, 0.08, 0.08, (cnx, py, pz), P["wood_dk"])
    # 3 canvas panels: steep drop from the front beam, a slack belly, then
    # back up to the rear beam — a real slung sag, not a flat quad
    pan = ((-0.95, 1.005, 0.56, -43.5), (-0.585, 0.80, 0.34, -3.5),
           (-0.21, 0.925, 0.50, 30.8))
    for i, (py, pz, pd, pa) in enumerate(pan):
        box(f"lm_linen_canvas{i}", 0.92, pd, 0.035, (cnx, py, pz - 0.0175),
            P["linen"], rx=math.radians(pa))
        # woven stripe running with the panel
        box(f"lm_cl_canstripe{i}", 0.93, pd * 0.26, 0.038, (cnx, py, pz),
            P["cl_red"] if i % 2 == 0 else P["cl_org"], rx=math.radians(pa))
        # rope edge on both selvedges, following the sag line
        for s in (-1, 1):
            cyl(f"lm_rope_selvedge{i}{s}", 0.017, pd, (cnx + s * 0.47, py,
                pz - pd / 2), P["rope"], seg=6, rx=math.radians(90 + pa))
    # guy ropes pegged into the yard off the front heads
    for s, px in ((-1, 0.5), (1, 1.3)):
        cyl("lm_rope_guy", 0.014, 0.66, (px + s * 0.09, -1.24, 0.66),
            P["rope"], seg=6, rx=math.radians(22), ry=math.radians(s * 14))
        box("lm_wood_peg", 0.04, 0.04, 0.11, (px + s * 0.17, -1.32, 0.08),
            P["wood_dk"])

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

    # warm lining on the inside of the back wall so the shaded yard behind
    # the awning reads as an interior, not a black cavity (judge R15-4)
    box("lw_inner_lining", 2.0, 0.06, 1.02, (0, 0.73, 0.13), P["inner"])
    for sx in (-1, 1):
        box("lw_inner_sidelining", 0.06, 1.30, 1.00, (sx * 0.735, 0.42, 0.13),
            P["inner"])

    # striped awning slung off the CORNICE FACE over the yard. Trimmed to
    # 1.74 so it terminates inboard of the stone corner piers it used to
    # shear through, tilted down-and-out, and its poles are solved to the
    # underside instead of spearing past it (judge R15-3).
    awning("lw_cloth_awn", 1.74, 0.62, (0, -0.39, 1.26), 20, P["cl_yel"], P,
           front_poles=(-0.78, 0.78), ground=0.13, pole_r=0.028,
           stripe=P["blue"], stripe_frac=0.26)

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
    box("vs_mud_roof", 1.22, 0.92, 0.05, (-0.55, 0.65, 1.06), P["mud_dk"])
    # POT-TILE ROOF: half-round terracotta tiles (per-kind roof read: tile,
    # vs plank on ration_house and thatch on reed_basket_shop)
    for i in range(8):
        cyl(f"vs_pot_tile{i}", 0.072, 0.9, (-1.05 + i * 0.143, 0.65,
            1.12 - 0.45), P["pot"], seg=8, rx=math.radians(90))
    box("vs_pot_tileridge", 1.24, 0.14, 0.06, (-0.55, 0.65, 1.15), P["pot"])
    recess("vs_door", 0.34, 0.58, -0.55, 0.115, 0.12, P, d=0.10, ring=0.045)
    box("vs_stone_lintel", 0.46, 0.09, 0.07, (-0.55, 0.10, 0.70), P["stone_w"])

    # HERO IDENTITY PROP: oversized display amphora on a plinth beside the
    # door — unmissable at board zoom, names the shop on sight
    dax, day = -1.02, -0.16
    cyl("vs_mud_dispplinth", 0.27, 0.16, (dax, day, 0.08), P["mud_dk"], seg=9)
    cyl("vs_stone_dispcap", 0.23, 0.04, (dax, day, 0.24), P["stone"], seg=9)
    amphora("vs_disp", dax, day, 0.28, P, s=2.6)
    cyl("vs_rope_dispband", 0.15, 0.06, (dax, day, 0.5), P["rope"], seg=9)
    cyl("vs_cl_displid", 0.09, 0.05, (dax, day, 0.95), P["cl_org"], seg=8)

    # mini stepped kiln (board 03 language), back-right — TALLER so the
    # potter's kiln stack dominates the skyline of this kit
    kx, ky = 0.82, 0.78
    z = 0.08
    for w, d, h in ((1.0, 0.94, 0.42), (0.82, 0.77, 0.36),
                    (0.65, 0.61, 0.32), (0.48, 0.45, 0.28)):
        f = frustum("vs_brick_kiln", w, d, w * 0.82, d * 0.82, h, (kx, ky, z),
                    P["brick"])
        bevel(f, 0.02)
        z += h
    # proud brick banding courses so the stack never reads as a plain mass
    for bz, bw, bd in ((0.42, 0.86, 0.40), (0.84, 0.69, 0.32),
                       (1.16, 0.54, 0.25)):
        box(f"vs_mud_kilnband{int(bz*100)}", bw, 0.05, 0.05,
            (kx, ky - bd, bz), P["mud_tan"])
    box("vs_char_stain", 0.34, 0.33, 0.16, (kx, ky, z - 0.18), P["char"])
    cyl("vs_mud_crown", 0.16, 0.1, (kx, ky, z), P["mud_dk"], seg=8)
    # flared chimney stack on the crown (total kiln height ~2.0)
    cyl("vs_pot_kilnstack", 0.1, 0.42, (kx, ky, z + 0.1), P["pot"], seg=8,
        rtop=0.075)
    cyl("vs_pot_kilnflare", 0.075, 0.13, (kx, ky, z + 0.52), P["pot"], seg=8,
        rtop=0.13)
    box("vs_dark_mouth", 0.28, 0.1, 0.34, (kx, ky - 0.46, 0.08), P["dark"])
    box("vs_kiln_glow", 0.18, 0.04, 0.17, (kx, ky - 0.52, 0.1), kiln_glow)

    # HERO: tall A-FRAME amphora rack at the FRONT — 2 tiers, 13 pots, ribs
    # splayed in Y so the silhouette is a triangle, not a box
    rx0, ry0 = 0.35, -0.78
    for rxi in (rx0 - 0.65, rx0, rx0 + 0.65):
        for s_ in (-1, 1):
            box("vs_wood_rackleg", 0.06, 0.06, 1.18, (rxi + 0.0,
                ry0 + s_ * 0.30, 0.08), P["wood_dk"],
                rx=math.radians(s_ * 15))
    # ridge rail at the apex + splayed foot rails
    box("vs_wood_rackridge", 1.55, 0.07, 0.06, (rx0, ry0, 1.24), P["wood_dk"])
    for s_ in (-1, 1):
        box("vs_wood_rackfoot", 1.5, 0.05, 0.05, (rx0, ry0 + s_ * 0.42, 0.14),
            P["wood"])
    # two shelves; the upper one is narrower, following the A taper
    box("vs_wood_shelf", 1.5, 0.74, 0.05, (rx0, ry0, 0.40), P["wood"])
    box("vs_wood_shelf2", 1.5, 0.52, 0.05, (rx0, ry0, 0.82), P["wood"])
    for i in range(7):  # lower tier
        amphora(f"vs_l{i}", rx0 - 0.6 + i * 0.2, ry0 + (0.1 if i % 2 else
                -0.1), 0.45, P, s=0.95)
    for i in range(6):  # upper tier, fully exposed against the sky
        amphora(f"vs_u{i}", rx0 - 0.52 + i * 0.21, ry0, 0.87, P, s=0.85)
    # ground pots leaning by the rack (moved clear of the counter footprint)
    amphora("vs_g1", -0.32, -1.05, 0.08, P, s=1.1)
    amphora("vs_g2", -0.10, -1.02, 0.08, P, s=0.85)
    amphora("vs_g3", 1.15, -0.35, 0.08, P, s=0.95)

    # shopfront counter + awning (front-left, board 02 language)
    cx, cy = -0.9, -0.9
    box("vs_mud_counter", 0.75, 0.4, 0.44, (cx, cy, 0.08), P["mud_dk"])
    box("vs_cloth_countertop", 0.8, 0.45, 0.04, (cx, cy, 0.52), P["cl_org"])
    cyl("vs_pot_cup", 0.045, 0.08, (cx - 0.2, cy, 0.56), P["pot"], seg=8)
    cyl("vs_pot_cup2", 0.04, 0.07, (cx + 0.1, cy + 0.06, 0.56), P["pot"], seg=8)
    # free-standing shop canopy: four solved posts, all inside the 2.6 pad.
    # The old cloth ramped upward off nothing and its poles ran through it.
    awning("vs_cloth_awn", 0.76, 0.66, (cx, -0.58, 1.02), 22, P["cl_yel"], P,
           front_poles=(cx - 0.34, cx + 0.34),
           back_poles=(cx - 0.34, cx + 0.34), ground=0.08, pole_r=0.026,
           stripe=P["cl_org"])
    # clay basket + mat
    basket("vs", 1.1, 0.1, 0.08, P, r=0.11, fill="grey")
    box("vs_matting_floor", 0.55, 0.4, 0.02, (0.42, 0.05, 0.08), P["thatch"])


# ---------------------------------------------------------------- REED BASKET SHOP
def build_reed_basket_shop(P):
    """Anchors 02 shopfront + 08 reeds. Silhouette signature: a TALL stacked
    basket tower at the front corner plus a WIDE low reed-drying rack, so the
    outline can never be mistaken for the plain box of the other shop-tier
    kits. Roof is layered THATCH (vs plank on ration_house, pot-tile on
    vessel_shop). (Mesh names all contain 'basket' via kind prefix, so
    kitLoader's reed-bob stays off.)"""
    base = box("rb_dirt_base", 2.8, 2.8, 0.08, (0, 0, 0), P["dirt"])
    bevel(base, 0.02)

    # stall: mudbrick, pushed back so the hero props own the front
    stx, sty = -0.5, 0.78
    st = frustum("rb_mud_stall", 1.55, 1.15, 1.45, 1.05, 0.95,
                 (stx, sty, 0.08), P["mud"])
    bevel(st, 0.02)
    # tan course band round the stall so the wall separates tonally from the
    # straw roof and the basket stock (no single beige read)
    box("rb_mud_stallband", 1.58, 1.18, 0.09, (stx, sty, 0.52), P["mud_tan"])
    box("rb_wood_beamF", 1.6, 0.06, 0.06, (stx, sty - 0.52, 0.97), P["wood_dk"])
    box("rb_wood_beamB", 1.6, 0.06, 0.06, (stx, sty + 0.52, 0.97), P["wood_dk"])
    # LAYERED THATCH ROOF: stepped straw courses + a fat tied ridge
    for i, (ww, dd, zz) in enumerate(((1.74, 1.34, 1.03), (1.6, 1.2, 1.09),
                                      (1.42, 1.04, 1.15))):
        box(f"rb_thatch_course{i}", ww, dd, 0.07, (stx, sty, zz),
            P["thatch"] if i % 2 == 0 else P["thatch_dk"])
    box("rb_thatch_ridge", 1.46, 0.17, 0.07, (stx, sty, 1.21), P["thatch_dk"])
    for rxp in (stx - 0.5, stx, stx + 0.5):
        cyl("rb_rope_ridgetie", 0.055, 0.24, (rxp, sty, 1.15), P["rope"],
            seg=7, rx=math.radians(90))
    recess("rb_door", 0.36, 0.60, stx - 0.2, 0.20, 0.12, P, d=0.10, ring=0.045)
    # counter through the open front
    box("rb_mud_counter", 0.7, 0.4, 0.44, (stx + 0.05, -0.02, 0.08),
        P["mud_dk"])
    box("rb_thatch_countertop", 0.76, 0.46, 0.04, (stx + 0.05, -0.02, 0.52),
        P["thatch"])
    basket("rb_c1", stx - 0.1, -0.05, 0.56, P, r=0.08, fill="crop_g")
    basket("rb_c2", stx + 0.22, 0.02, 0.56, P, r=0.07, fill="grey")

    # yellow awning: back edge pinned ON the stall's front beam face (it used
    # to start 20 cm out in mid-air) with both poles solved to the underside
    awning("rb_cloth_awn", 1.5, 0.72, (stx, 0.23, 1.00), 22, P["cl_yel"], P,
           front_poles=(stx - 0.6, stx + 0.6), ground=0.08, pole_r=0.026,
           stripe=P["cl_org"], stripe_frac=0.24)

    # ---- HERO 1: TALL STACKED BASKET TOWER at the front corner ----
    twx, twy = 0.92, -0.85
    twz = 0.08
    for i, r in enumerate((0.215, 0.195, 0.205, 0.175, 0.185, 0.155)):
        hh = 0.15 + r * 0.4
        jx = 0.022 * (1 if i % 2 else -1)
        cyl(f"rb_bask_tw{i}", r, hh, (twx + jx, twy - jx * 0.6, twz),
            P["thatch"] if i % 2 == 0 else P["thatch_dk"], seg=9,
            rtop=r * 1.1, rz=0.3 * i)
        # cord binding hoop + rim: tonal break so the stack never fuses
        cyl(f"rb_wood_twband{i}", r * 1.04, 0.035,
            (twx + jx, twy - jx * 0.6, twz + hh * 0.4), P["wood_dk"], seg=9)
        cyl(f"rb_wood_twrim{i}", r * 1.13, 0.03,
            (twx + jx, twy - jx * 0.6, twz + hh - 0.03), P["wood"], seg=9)
        twz += hh + 0.012
    basket("rb_twtop", twx, twy, twz, P, r=0.15, h=0.15, fill="crop_g")
    # smaller companion stacks so the tower reads as stock, not a totem
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
    stack(1.18, -0.32, (0.13, 0.11))
    stack(0.5, -1.18, (0.13, 0.105))
    # big woven storage basket with rope band
    cyl("rb_thatch_bigbask", 0.2, 0.34, (1.15, 0.28, 0.08), P["thatch_dk"],
        seg=10, rtop=0.25)
    cyl("rb_rope_band", 0.235, 0.05, (1.15, 0.28, 0.3), P["rope"], seg=10)

    # ---- HERO 2: WIDE horizontal reed-drying rack (low + long) ----
    drx, dry = -0.35, -1.0
    for px in (drx - 0.6, drx, drx + 0.6):
        for py in (dry - 0.16, dry + 0.16):
            box("rb_wood_dryleg", 0.05, 0.05, 0.6, (px, py, 0.08), P["wood_dk"])
    for py in (dry - 0.16, dry + 0.16):
        box("rb_wood_dryrail", 1.32, 0.05, 0.05, (drx, py, 0.64), P["wood"])
    box("rb_wood_drybrace", 1.3, 0.04, 0.04, (drx, dry, 0.3), P["wood_dk"])
    dryc = ("crop_gr", "thatch", "crop_dk", "thatch_dk", "crop_gr", "thatch",
            "crop_dk")
    for i in range(7):
        cyl(f"rb_rush_dry{i}", 0.052, 0.5, (drx - 0.6 + i * 0.2, dry,
            0.69 + 0.052 - 0.25), P[dryc[i]], seg=6, rx=math.radians(90))
        cyl(f"rb_rope_drytie{i}", 0.06, 0.035, (drx - 0.6 + i * 0.2, dry,
            0.69 + 0.052 - 0.0175), P["rope"], seg=6, rx=math.radians(90))
    # cut bundles leaning against the rack front, ready for weaving
    for i in range(4):
        cyl(f"rb_rush_stack{i}", 0.055, 0.66, (drx - 0.42 + i * 0.28,
            dry - 0.3, 0.06), P["crop_gr"] if i % 2 else P["thatch"], seg=6,
            rx=math.radians(22))

    # rush bundle lean against the stall's right flank (green + dry)
    for i, mm in enumerate(("crop_gr", "thatch", "crop_gr")):
        cyl(f"rb_rush_lean{i}", 0.055, 0.8, (0.38 + i * 0.11, 0.72 - i * 0.04,
            0.06), P[mm], seg=6, rx=math.radians(14), ry=math.radians(-6))

    # weaving frame: thin lattice loom, pulled forward of the awning line so
    # its posts no longer spear the cloth
    wx, wy = -1.05, -0.62
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
    cyl("rb_thatch_spare", 0.06, 0.5, (wx + 0.30, wy + 0.32, 0.08 + 0.06 - 0.25),
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


# ---------------------------------------------------------------- DECOR: OBELISK
OB_Z0, OB_Z1 = 0.50, 2.10          # shaft foot / shoulder
OB_W0, OB_W1 = 0.36, 0.24          # shaft section at those heights


def ob_face(z):
    """-Y face plane of the battered shaft at height z. Every applied relief is
    seated off this rather than off a nominal plane: with a 33% batter an
    axis-aligned strip run the full shaft either buries itself at the foot or
    floats off the face at the shoulder."""
    t = (z - OB_Z0) / (OB_Z1 - OB_Z0)
    return -(OB_W0 + (OB_W1 - OB_W0) * t) / 2


def build_obelisk(P):
    """Aswan-granite obelisk, 2.4 tall on a 0.75 footprint. Three things carry
    it at board zoom, in order: the GOLD PYRAMIDION (a capped obelisk is the
    entire silhouette, and it terminates the shaft the way the old blunt
    granite tip never did), the plum-red granite that no longer matches the
    mudbrick shops behind it, and a real sunk inscription column down the
    front. A granite socle keeps the shaft off the sand line."""
    # local limestone footing, then two granite courses: the shaft starts at
    # 0.50, so a prop that settles a little into the terrain still shows stone
    s1 = box("ob_stone_step1", 0.75, 0.75, 0.15, (0, 0, 0), P["stone_wm"])
    bevel(s1, 0.024)
    s2 = box("ob_granite_step2", 0.60, 0.60, 0.14, (0, 0, 0.15), P["granite_dk"])
    bevel(s2, 0.02)
    soc = box("ob_granite_socle", 0.46, 0.46, 0.21, (0, 0, 0.29), P["granite"])
    bevel(soc, 0.018)

    # shaft in four short frusta: each one is near enough vertical over its own
    # 0.40 that the applied relief seats cleanly, and the joints fall under the
    # glyph rows so they never read as separate stacked drums
    for i in range(4):
        za, zb = OB_Z0 + i * 0.40, OB_Z0 + (i + 1) * 0.40
        seg = frustum(f"ob_granite_shaft{i}", -2 * ob_face(za), -2 * ob_face(za),
                      -2 * ob_face(zb), -2 * ob_face(zb), 0.40, (0, 0, za),
                      P["granite"])
        bevel(seg, 0.011)

    # inscription column, front (-Y). Glyph blocks stand 22 mm proud in the
    # shadow granite: at 24 px of shaft width the read is a dark vertical band
    # with rhythm, and the relief is deep enough that the 32-degree key throws
    # a real edge shadow down each row instead of a painted stripe.
    for i in range(8):
        z = 0.62 + i * 0.17
        fy = ob_face(z + 0.043)
        s = (-2 * fy) / OB_W0                    # keep the column in proportion
        w = (0.135, 0.088, 0.118, 0.100)[i % 4] * s
        if i == 5:
            continue                             # cartouche takes this slot
        box("ob_granite_glyph", w, 0.03, 0.085,
            (((-1) ** i) * 0.012 * s, fy - 0.007, z), P["granite_dk"])
    # cartouche: sunk oval field ringed by a proud granite border, the one spot
    # on the shaft where the relief is two levels deep
    cz, cfy = 1.47, ob_face(1.545)
    cs = (-2 * cfy) / OB_W0
    box("ob_granite_cartfield", 0.105 * cs, 0.03, 0.135, (0, cfy - 0.007, cz),
        P["granite_dk"])
    for dz, bw, bh in ((0.0, 0.155, 0.026), (0.129, 0.155, 0.026)):
        box("ob_granite_cartrail", bw * cs, 0.034, bh,
            (0, cfy - 0.011, cz + dz), P["granite"])
    for sx in (-1, 1):
        box("ob_granite_cartjamb", 0.026 * cs, 0.034, 0.155,
            (sx * 0.0645 * cs, cfy - 0.011, cz), P["granite"])

    # collar under the cap: without it the gold pyramidion sits on nothing and
    # reads as a loose bead balanced on the shaft
    frustum("ob_granite_collar", 0.278, 0.278, 0.272, 0.272, 0.05,
            (0, 0, 2.05), P["granite_dk"])
    # electrum pyramidion, same read as the shrine's flanking pair. 0.30 tall
    # so the cap holds ~24 px at board zoom; 0.014 top face keeps the apex
    # non-degenerate for the exporter.
    frustum("ob_electrum_pyramidion", 0.262, 0.262, 0.014, 0.014, 0.30,
            (0, 0, 2.10), P["electrum"])


# ------------------------------------------------------- DECOR: STANDING STATUE
def build_statue_standing(P):
    """Striding granite figure on a back pillar, 1.7 tall on a 0.55 base.

    Two rounds of judge notes shaped this. The first was that it "collapses to
    an NPC-sized silhouette" — answered by the two-stage limestone pedestal and
    by the full-height back pillar, which is the thing no villager has.

    The second was harsher and is what this pass answers: "a rounded slab —
    arms fused into the torso, no shoulder or nemes step, no kilt break, no
    forward foot". Every one of those is a NEGATIVE-space failure, so each fix
    opens a real gap rather than adding another positive mass:

      arms   — the torso used to FLARE to 0.40 at the shoulder, i.e. exactly
               the arm centreline, so arm and body shared one outline all the
               way down. Shoulders pulled in to 0.345 and the arms pushed out
               to +-0.215: they meet only at the shoulder ball and open to a
               31 mm notch at the waist, which the AO bake then darkens.
      kilt   — the shendyt hem was NARROWER than the thighs it covers, so
               there was nothing to overhang. Hem out to 0.40 (23 mm proud of
               the thigh) plus a front apron, giving a true horizontal break
               with shadow under it, and a belt that steps proud of the kilt
               top in turn.
      nemes  — widened 0.30 -> 0.36 at the brow while the back pillar stays
               0.30, so the headdress steps OUTSIDE the slab behind it from
               the front. That step is the Egyptian read at board zoom.
      foot   — the advanced foot now clears the kilt hem by 0.14 in -Y instead
               of hiding under it.

    Height contract is unchanged: crown lands exactly on 1.70 and everything
    stays inside the 0.55 x 0.55 pedestal footprint."""
    # two-stage pedestal, pale limestone: off the hardstone hue AND the sand
    # hue, so the base separates from both the figure and the desert
    b1 = box("ss_stone_base", 0.55, 0.55, 0.10, (0, 0, 0), P["tomb"])
    bevel(b1, 0.020)
    b2 = box("ss_stone_basecap", 0.50, 0.50, 0.06, (0, 0, 0.10), P["tomb_cap"])
    bevel(b2, 0.014)
    z0 = 0.16

    # striding stance. The advanced (left) foot is pushed to y-0.155 and run
    # 0.27 deep so its toe clears the kilt hem's -0.15 front face: from the
    # board's 45-degree view that projection is the whole "striding" read.
    # Legs opened to +-0.10 against 0.078 thighs leaves a 44 mm gap up the
    # centre line, where the old pair very nearly touched.
    for sx, fy, ly, fd in ((-1, -0.140, -0.085, 0.255), (1, 0.045, 0.055, 0.235)):
        f = box("ss_stone_foot", 0.125, fd, 0.063, (sx * 0.10, fy, z0),
                P["qtz"])
        bevel(f, 0.016)
        cyl("ss_stone_shin", 0.060, 0.361, (sx * 0.10, ly, 0.213),
            P["qtz"], seg=14, rtop=0.052)
        cyl("ss_stone_thigh", 0.078, 0.404, (sx * 0.10, ly, 0.545),
            P["qtz"], seg=14, rtop=0.068)
    box("ss_stone_hips", 0.27, 0.225, 0.164, (0, -0.01, 0.843), P["qtz"])
    # shendyt kilt: hem 0.40 wide against 0.178 of thigh, so it genuinely
    # OVERHANGS and the bake can put a shadow line under it. Shade tone also
    # bands the figure at the waist, separating torso mass from legs.
    k = frustum("ss_stone_kilt", 0.40, 0.30, 0.25, 0.215, 0.308,
                (0, 0, 0.795), P["qtz_dk"])
    bevel(k, 0.014)
    # front apron: the triangular panel down the centre of a shendyt. In the
    # lit tone against the shaded kilt it splits the hem into two dark wings,
    # which is what stops the lower body reading as one rounded bell.
    ap = frustum("ss_stone_apron", 0.145, 0.05, 0.085, 0.05, 0.30,
                 (0, -0.145, 0.795), P["qtz"])
    bevel(ap, 0.010)
    # belt steps proud of the kilt top (0.29 over 0.25) — second break
    bl = box("ss_stone_belt", 0.29, 0.245, 0.043, (0, 0, 1.079), P["qtz_dk"])
    bevel(bl, 0.010)

    # torso: shoulders 0.345, NOT 0.40. The arms sit at +-0.215, so the two
    # masses touch only at the shoulder ball and part below it.
    torso = frustum("ss_stone_torso", 0.26, 0.215, 0.345, 0.225, 0.327,
                    (0, 0, 1.084), P["qtz"])
    bevel(torso, 0.018)
    # broad collar tapering INTO the neck. As a flat slab it stacked a
    # rectangle on the head rectangle and the figure read robotic at board
    # zoom; the taper gives the shoulders a carved slope instead.
    frustum("ss_stone_collar", 0.355, 0.238, 0.30, 0.222, 0.072, (0, 0, 1.315),
            P["qtz_dk"])
    for sx in (-1, 1):
        sphere("ss_stone_shoulder", 0.078, (sx * 0.19, -0.005, 1.319),
               P["qtz"], seg=12)
        cyl("ss_stone_arm", 0.054, 0.51, (sx * 0.215, -0.012, 0.887),
            P["qtz"], seg=14, rtop=0.046)
        # clenched fists, the standing-figure tell. They now stand ~0.09
        # proud of the kilt at that height instead of sinking into it.
        sphere("ss_stone_fist", 0.058, (sx * 0.215, -0.035, 0.814),
               P["qtz_dk"], seg=10)
    cyl("ss_stone_neck", 0.058, 0.106, (0, 0, 1.392), P["qtz"], seg=12)

    # nemes headcloth: flared trapezoid mass, face proud of its front, lappets
    # falling over the collar. 0.36 at the brow against a 0.30 back pillar is
    # the "nemes step" the judges could not find — the head is the widest thing
    # above the shoulders, so it cannot merge into the slab behind it.
    nemes = frustum("ss_stone_nemes", 0.36, 0.25, 0.135, 0.14, 0.226,
                    (0, 0, 1.474), P["qtz"])
    bevel(nemes, 0.014)
    # face tapers to the chin so the head is a head, not another cube
    frustum("ss_stone_face", 0.115, 0.062, 0.128, 0.062, 0.130,
            (0, -0.126, 1.488), P["qtz"])
    box("ss_stone_fillet", 0.235, 0.20, 0.029, (0, 0, 1.611), P["qtz_dk"])
    # lappets: the two dark bars either side of a light face. This is the
    # single strongest Egyptian cue left at board zoom, so they run the full
    # drop to the collar rather than stopping at the jaw.
    for sx in (-1, 1):
        lp = box("ss_stone_lappet", 0.09, 0.062, 0.279,
                 (sx * 0.117, -0.116, 1.315), P["qtz_dk"])
        bevel(lp, 0.01)
    # back pillar: the monument cue. Full height to the crown, deepened to
    # 0.19 for mass, and left at 0.30 wide so the 0.36 nemes overhangs it.
    bp = frustum("ss_stone_backpillar", 0.30, 0.19, 0.26, 0.17, 1.54,
                 (0, 0.125, z0), P["qtz_dk"])
    bevel(bp, 0.016)


# --------------------------------------------------------- DECOR: SEATED STATUE
def build_statue_seated(P):
    """Enthroned granodiorite figure, 1.45 tall on a 0.6 x 0.7 base.

    Four of these flank the tomb causeway, and the judges' verdict was that the
    approach "reads as debris rather than ceremony": a near-black V65 chunky
    mass with "no internal value break between throne, legs, torso and nemes".
    Both halves of that were true and they had different causes.

    The near-black was the AO bake — see bake_ao(). A dense figure occludes
    itself everywhere, so a 0.35 floor cost the whole statue ~0.58x and buried
    an already-dark stone. The floor is now 0.58 for decor and the stone family
    starts 30-60 levels higher.

    The missing internal break is fixed here, by making the value ladder
    material rather than incidental — pale limestone plinth (V214) / lit throne
    (V168) / figure body (V140) / deep accents (V96), a 118-level spread that
    survives occlusion. Three specific reads carry it at board zoom:
      * the LAP. The kilt is a pale horizontal slab overhanging the shins by
        0.06, so the 32-degree key throws a real undercut shadow across them.
        A seated statue is read by its lap, and previously the lap, shins and
        throne were one tone with no shadow line between them.
      * the THRONE, now detached from the figure by its own dark base moulding
        and a sunk dark side panel, so it holds a clean lit rectangle behind
        and beside the darker body instead of merging with it.
      * the NEMES in the LIT tone against a MID face and DARK lappets, so the
        headdress catches light differently from the face — the judges asked
        for exactly this and it is what stops the head reading as one blob."""
    # pale limestone pedestal: off both the hardstone hue and the sand hue, and
    # bright enough to put a hard horizontal under the dark figure
    b = box("sq_stone_base", 0.6, 0.7, 0.08, (0, 0, 0), P["tomb"])
    bevel(b, 0.016)
    p = box("sq_stone_plinth", 0.52, 0.6, 0.05, (0, 0.05, 0.08), P["tomb_cap"])
    bevel(p, 0.014)

    # throne: its own dark base moulding detaches the block from the plinth, so
    # the seat reads as furniture the figure sits ON rather than as more body
    md = box("sq_stone_thronefoot", 0.48, 0.52, 0.05, (0, 0.06, 0.13),
             P["grano_dk"])
    bevel(md, 0.012)
    seat = box("sq_stone_throne", 0.46, 0.5, 0.36, (0, 0.06, 0.18),
               P["grano_lt"])
    bevel(seat, 0.018)
    back = box("sq_stone_thronebk", 0.46, 0.1, 1.13, (0, 0.26, 0.18),
               P["grano_lt"])
    bevel(back, 0.016)
    cap = box("sq_stone_thronecap", 0.49, 0.13, 0.045, (0, 0.26, 1.31),
              P["grano_dk"])
    bevel(cap, 0.012)
    # sunk side panels: the board camera sees one throne flank square on, and a
    # blank 0.46 x 0.36 slab there is the single largest featureless area on the
    # prop. A dark recessed field breaks it without touching the silhouette.
    for sx in (-1, 1):
        sp = box("sq_stone_thronepanel", 0.02, 0.34, 0.24,
                 (sx * 0.235, 0.06, 0.235), P["grano_dk"])
        bevel(sp, 0.008)

    for sx in (-1, 1):
        f = box("sq_stone_foot", 0.13, 0.2, 0.08, (sx * 0.095, -0.22, 0.13),
                P["grano"])
        bevel(f, 0.016)
        # shins pulled back to y -0.155 (front face -0.22) so the lap slab
        # above can overhang them and cast the undercut
        box("sq_stone_shin", 0.125, 0.13, 0.34, (sx * 0.095, -0.155, 0.13),
            P["grano"])
        box("sq_stone_thigh", 0.15, 0.3, 0.15, (sx * 0.095, -0.09, 0.47),
            P["grano"])
        sphere("sq_stone_knee", 0.07, (sx * 0.095, -0.2, 0.46),
               P["grano"], seg=10)
    # kilt drawn tight over the lap as a SOLID wedge; without it the space
    # between chest and knees reads as a hole punched through the figure. In
    # the LIT tone it is the horizontal plane the board camera sees most of, and
    # its front edge stands 0.06 proud of the shins so the lap terminates in a
    # shadow line instead of blending into the legs.
    lk = box("sq_stone_lapkilt", 0.36, 0.36, 0.11, (0, -0.1, 0.53),
             P["grano_lt"])
    bevel(lk, 0.012)

    torso = frustum("sq_stone_torso", 0.28, 0.25, 0.365, 0.225, 0.42,
                    (0, 0.03, 0.63), P["grano"])
    bevel(torso, 0.018)
    frustum("sq_stone_collar", 0.4, 0.24, 0.32, 0.215, 0.075, (0, 0.025, 1.05),
            P["grano_dk"])
    for sx in (-1, 1):
        sphere("sq_stone_shoulder", 0.078, (sx * 0.172, 0.02, 0.96),
               P["grano"], seg=10)
        cyl("sq_stone_arm", 0.056, 0.32, (sx * 0.172, 0.015, 0.72),
            P["grano"], seg=10, rtop=0.05)
        box("sq_stone_forearm", 0.105, 0.3, 0.1, (sx * 0.145, -0.07, 0.655),
            P["grano"])
        # hands FLAT on the knees, in the deep tone: two dark rectangles on the
        # lit knee line is the pose read that survives to board zoom
        h = box("sq_stone_hand", 0.14, 0.16, 0.065, (sx * 0.125, -0.245, 0.648),
                P["grano_dk"])
        bevel(h, 0.01)
        lp = box("sq_stone_lappet", 0.085, 0.058, 0.26,
                 (sx * 0.098, -0.095, 1.06), P["grano_dk"])
        bevel(lp, 0.01)
    cyl("sq_stone_neck", 0.055, 0.12, (0, 0.02, 1.1), P["grano"], seg=10)

    # nemes in the LIT tone against a MID face: the headdress has to catch the
    # light differently from the face or the head is one lump at board zoom
    nemes = frustum("sq_stone_nemes", 0.3, 0.24, 0.13, 0.135, 0.25,
                    (0, 0, 1.2), P["grano_lt"])
    bevel(nemes, 0.014)
    box("sq_stone_nemestail", 0.1, 0.13, 0.26, (0, 0.155, 1.1), P["grano_lt"])
    frustum("sq_stone_face", 0.105, 0.062, 0.122, 0.062, 0.135,
            (0, -0.1, 1.215), P["grano"])
    box("sq_stone_fillet", 0.2, 0.19, 0.03, (0, 0, 1.355), P["grano_dk"])


# ---------------------------------------------------------- DECOR: SMALL PYRAMID
def build_small_pyramid(P):
    """A YOUNG settlement's own tomb, not Giza: a smooth-cased limestone
    pyramid on a dark socle, 3.0 wide and 1.7 tall.

    Two judge notes killed the stepped version, and they were the same note.
    "A squat khaki-olive ziggurat, not limestone", and "the capstone is a
    triangle recessed inside a raised frame — it reads as a decal in a picture
    frame, not a pyramidion". Any stacked-course profile spends its height on
    ledges instead of on slope, so the mass ends on a wide flat deck; whatever
    cap is then centred on that deck is ringed by leftover terrace, and from a
    FIXED 45-degree board camera that ring photographs as a frame around a
    painted triangle. Rebuilding the cap did not fix it — with courses to z0.94
    and a 0.52 apex it still read as a pale triangle stuck on a plateau.

    So the courses are gone. The casing now runs unbroken from the socle to the
    tip at ~46 degrees, which is within 6 of a real pyramid, and the silhouette
    is a clean triangle at any zoom. Masonry is kept as TEXTURE rather than as
    profile: each of the four casing courses is inset 0.025 per side from the
    one below, a ~2 px line at board zoom that reads as coursing without ever
    breaking the outline. The pyramidion is the same slope family and the only
    pale stone on the mass, so it terminates the tip instead of decorating a
    deck, and the entrance pylon emerging from the lower front face gives the
    whole thing scale.

    R6: "the least-detailed object on the board — a smooth grey-mauve solid
    with a few edge creases and a flat untextured top face. No block coursing,
    no casing-stone joints, no weathering." The tomb WAS in the surfacing stage
    the whole time; it was in the wrong family. limestone_ mapped to "stone",
    whose across-course coordinate blends world z into a horizontal axis by
    |nz|, and on a 46-degree batter that compresses a 0.30 m course to 0.84 m
    of real height — the entire casing held about one and a half courses, and
    the two grooves that survived ran diagonally across the slope, which is
    what the judges read as "a few edge creases". limestone_ now has its own
    "casing" family (see _detail) whose courses are horizontal on any sloped
    face, so the mass carries a real 0.115 m bond with per-block tone and
    wind-scour weathering. Geometry changes are deliberately small — a second
    chipped corner, five spalled blocks instead of two, and a pyramidion that
    converges to 0.014 instead of ending on a 0.04 deck — because every earlier
    attempt to fix this prop with PROFILE was rejected."""
    # BASE COURSE (A5: "the pyramid still has no base and clips the dune").
    # The old socle was one 0.16 course, and measured on the live board the
    # desert under the tomb rises 0.132 across the 3.0 footprint while the prop
    # is seated at y -0.039 — so on the uphill side the whole socle was under
    # the sand and the sand line cut into the CASING, which is what reads as a
    # pyramid sliced off by a dune. The base is now a real 0.36 plinth in three
    # value steps (dark foot / mid plinth / dark cap band), which is 0.17 more
    # stone than the terrain can eat, so the batter starts clear of the sand on
    # every side and the buried part is a plinth being bedded, not a broken
    # mass. Height and footprint are unchanged — 1.70 tall, 3.0 x 3.0 — the
    # casing is shortened to pay for the base, so the apex chain still lands
    # on 1.70 and the batter is re-solved to 45.5 degrees, within half a degree
    # of the line it had before.
    p0 = frustum("sp_stone_foot", 3.0, 3.0, 2.96, 2.96, 0.12, (0, 0, 0),
                 P["tomb_dk"])
    bevel(p0, 0.020)
    p1 = frustum("sp_stone_plinth", 2.82, 2.82, 2.78, 2.78, 0.17,
                 (0, 0, 0.12), P["tomb"])
    bevel(p1, 0.018)
    # projecting cap band: the drip line that tells the eye where the plinth
    # ends and the batter begins. Dark stone, so it is a shadow, not a lip.
    p2 = box("sp_stone_plinthcap", 2.86, 2.86, 0.03, (0, 0, 0.29),
             P["tomb_dk"])
    bevel(p2, 0.010)

    # Casing: one continuous 45.5-degree batter from 2.66 at z0.32 to 0.42 at
    # z1.46, cut into four courses that each step in 0.025 per side. The taper
    # is solved on the true line so the four segments cannot drift off it.
    Z0, Z1, W0, W1 = 0.32, 1.46, 2.66, 0.42

    def face(z):                       # full width of the true casing line
        return W0 + (W1 - W0) * (z - Z0) / (Z1 - Z0)

    for i in range(4):
        za = Z0 + i * (Z1 - Z0) / 4
        zb = Z0 + (i + 1) * (Z1 - Z0) / 4
        wb = face(za) - 0.05 * i       # each course inset from the one below
        wt = face(zb) - 0.05 * i
        k = frustum(f"sp_stone_k{i}", wb, wb, wt, wt, zb - za, (0, 0, za),
                    P["tomb"])
        # Weathering is CUT, never piled: a chip keeps the batter's outline
        # crisp where a proud block would fur it. Two now, on different corners
        # and different courses, so the mass reads as eroded rather than as one
        # modelled notch. Both are off the front so the entrance stays clean.
        if i == 0:
            carve(k, [chip(-1.33, 1.33, -1, 1, 0.22, 0.32, 0.30)])
        elif i == 2:
            carve(k, [chip(0.67, 0.67, 1, 1, 0.13, 0.89, 0.15)])
        bevel(k, 0.014)

    # pyramidion: the only pale stone on the mass, and the only one whose whole
    # job is to end it. Its base is 0.46 against the casing's 0.42 top, so the
    # capstone sits fractionally PROUD of the summit — a cap that overhangs can
    # never read as a triangle recessed into a frame, which is the note this
    # prop keeps collecting. 0.24 over a 0.21 half-run is 48.8 degrees, steeper
    # than the casing the way a real capstone is.
    # 0.014 across the tip, not 0.04: at the decor crop's ~100 px/m that deck
    # was a 4 px flat quad catching the key straight on, and it is what the
    # judges called "a flat untextured top face". At 0.014 the apex converges
    # to a sub-pixel point and the cap reads as a capstone, not as a plateau.
    cap = frustum("sp_stone_pyramidion", 0.46, 0.46, 0.014, 0.014, 0.24,
                  (0, 0, 1.46), P["tomb_cap"])
    bevel(cap, 0.010)

    # entrance pylon on the front (-Y): buried in the batter at its foot and
    # standing ~0.45 proud of it by the top, so it emerges from the slope the
    # way a real chapel front does. This is the only element that gives the
    # tomb human scale at board zoom.
    # Re-seated on the new plinth (z0.32) and pulled back to y -1.12: the
    # casing is narrower now, so the same 0.45 of projection at the pylon's top
    # is solved at a different y. Measured: casing front at z0.84 is y -0.819,
    # pylon face y -1.27, so it stands 0.451 proud exactly as before.
    pylon = box("sp_stone_pylon", 0.70, 0.30, 0.52, (0, -1.12, 0.32), P["tomb"])
    bevel(pylon, 0.016)
    for sx in (-1, 1):                 # jambs standing proud of the pylon face
        j = box("sp_stone_pjamb", 0.07, 0.05, 0.34, (sx * 0.19, -1.28, 0.32),
                P["tomb_cap"])
        bevel(j, 0.010)
    lint = box("sp_stone_plintel", 0.52, 0.06, 0.05, (0, -1.28, 0.66),
               P["tomb_cap"])
    bevel(lint, 0.010)
    # dark reveal, never a punched black hole: the socle stone, not a void
    box("sp_stone_pdoor", 0.28, 0.04, 0.32, (0, -1.27, 0.32), P["tomb_dk"])

    # Casing blocks that came off the face, resting inside the 3.0 footprint —
    # weathering that does not touch the silhouette. They now sit on the two
    # LEDGES the base course opened up (the plinth cap at z0.33 and the foot
    # tread at z0.13) instead of on the sand: every one of these used to be
    # authored at z0 inside a 3.0-wide 0.16-tall socle, i.e. buried in solid
    # stone and invisible on the board. Three are on the cap ring under the
    # chipped corners they fell from; two are on the foot tread below.
    for nm, w, d, h, x, y, z, rot, mat in (
            ("f1", 0.14, 0.15, 0.11, -1.37, -0.62, 0.32, 7.0, "tomb_dk"),
            ("f2", 0.16, 0.13, 0.10, 1.37, 0.48, 0.32, -9.0, "tomb"),
            ("f3", 0.13, 0.14, 0.09, 0.36, 1.37, 0.32, 22.0, "tomb_cap"),
            ("f4", 0.13, 0.14, 0.09, -1.40, 1.10, 0.12, -31.0, "tomb_dk"),
            ("f5", 0.14, 0.12, 0.08, 1.32, -1.37, 0.12, 14.0, "tomb_cap")):
        f = box(f"sp_stone_{nm}", w, d, h, (x, y, z), P[mat],
                rz=math.radians(rot))
        bevel(f, 0.012)


# ---------------------------------------------------------------- export/render
BUILDERS = {
    "great_house": build_great_house,
    "great_house_dress": build_great_house_dress,
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

DECOR_BUILDERS = {
    "obelisk": build_obelisk,
    "statue_standing": build_statue_standing,
    "statue_seated": build_statue_seated,
    "small_pyramid": build_small_pyramid,
}
# preview framing per prop; decor is far smaller than a building pad
DECOR_PREVIEW = {"obelisk": 3.0, "statue_standing": 2.2, "statue_seated": 2.0,
                 "small_pyramid": 4.0}


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


# arris chamfer applied to everything the explicit bevel() calls missed. Every
# kit is boxes and frusta, and an unchamfered box edge is a zero-width step: it
# either catches the key or it does not, which is exactly the "paper fold" /
# "blocky low-poly" read the owner is describing. Foliage, cloth and liquids
# are excluded (a bevelled blade of emmer is only extra tris) and so is
# anything thinner than 45 mm, where a chamfer would eat the part.
NO_BEVEL = ("crop_", "channel_water", "ember_glow", "cloth_", "linen", "rug_",
            "rope_", "thatch_mat", "thatch_dark")


def auto_bevel(objs, w=0.010):
    for o in objs:
        if any(m.type == "BEVEL" for m in o.modifiers):
            continue
        mat = o.data.materials[0].name if o.data.materials else ""
        if any(mat.startswith(k) or mat == k for k in NO_BEVEL):
            continue
        d = o.dimensions
        if min(d.x, d.y, d.z) < 0.045:
            continue
        bevel(o, w, seg=1)      # cheap single chamfer; the hero edges already
        #                         carry an explicit two-segment bevel() call


def merge_by_material(kind):
    """Apply modifiers, then join objects sharing a material into one mesh.
    Joined name carries the material name so kitLoader keyword logic
    (gold/glow/kiln → night emissive; reed → bob) still works."""
    objs = grab_all()
    auto_bevel(objs)
    for o in bpy.context.scene.objects:
        o.select_set(o in objs)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.convert(target="MESH")  # applies bevels + booleans
    for c in _cutters:
        bpy.data.objects.remove(c, do_unlink=True)
    _cutters.clear()
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
# see bake_ao(): decor is dense self-occluding statuary, buildings are not
DECOR_AO_FLOOR = 0.58


def bake_ao(objs, floor=0.35):
    """MATERIALS ceiling-breaker: bake real Cycles ambient occlusion into the
    COLOR_0 vertex colors, multiplied with the existing jitter/grade. Corners,
    under-eaves and prop bases visibly darken so kits stop looking pasted.
    Headless-safe: Cycles vertex-color bake target, no lights needed.

    `floor` is the multiplier a fully occluded corner keeps. Buildings hold the
    original 0.35: they are big open facades, so only real eaves and reveals
    ever reach it. A DECOR figure is the opposite — a dense cluster of limbs,
    throne and headdress that occlude each other everywhere at once — and at
    0.35 the bake was worth ~0.58x over the whole statue, which is what turned
    an authored V110 stone into the V65 near-black lump with no internal break
    the judges rejected. Decor passes a higher floor so AO goes back to
    describing CONTACT and the form's own light-and-shade describes the figure.
    """
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
                a = floor + (1.0 - floor) * pow(a, 1.4)
            c = col.data[li].color
            col.data[li].color = (c[0] * a, c[1] * a, c[2] * a, 1.0)
        me.color_attributes.remove(me.color_attributes["AO"])
        me.color_attributes.active_color = me.color_attributes["Col"]


# ---------------------------------------------------------------- surfacing
# THE fidelity lever: until now every kit was flat colour per material times a
# baked COLOR_0 vertex AO, with no UVs and no image anywhere. That is why the
# board reads "low-poly / retro" no matter how the geometry is refined — there
# is no mudbrick, no grain, no weave, nothing at all between the silhouette and
# the flat fill.
#
# This stage gives each kit ONE 1024 atlas:
#   1. smart-project every textured mesh in the kit into a single shared UV
#      space (multi-object edit, so the pack is across the whole kit),
#   2. author a procedural Cycles pattern per material FAMILY driven by
#      world POSITION and NORMAL — never by UV — so coursing, planking and
#      fibre stay continuous across island seams and stay at real-world scale
#      whatever the unwrap did,
#   3. bake that as EMIT, bake a short-distance texel AO on top of it, and
#      multiply the two into the atlas.
#
# Two rules keep it art-directed rather than "dirty":
#   * the pattern only ever DARKENS (v = 1 - sum(amp * mask)). A clean lit
#     facet stays exactly the albedo it is today; all detail is subtraction.
#     There is no way for this stage to introduce a bright speckle.
#   * the atlas is normalised to a FIXED mean (TEX_MEAN) over its covered
#     texels, so a kit that happens to be mostly mudbrick and a kit that is
#     mostly plaster come out at the same overall exposure. The texture cannot
#     silently re-grade the settlement.
#
# COLOR_0 is untouched: the exported chain is
#     baseColorFactor  x  baseColorTexture  x  COLOR_0
# which is exactly what glTF and Babylon's PBRMaterial already multiply, so
# kitLoader/decorLoader keep working unchanged.
TEX_SIZE = 1024           # ceiling; the real size is picked per kit by area
TEX_DENSITY = 88          # texels per metre of surface (one texel ~ 11 mm)
TEX_AO_FLOOR = 0.82      # texel AO is CONTACT only; COLOR_0 still carries form
TEX_AO_DIST = 0.40
# JPEG quality for the atlases. This is a DOWNLOAD budget knob, not a quality
# knob to be trimmed by feel: texel density is left alone (the judges' standing
# complaint is that there is not enough surface detail, not too much) and the
# bytes come out of the encoder instead. See write_surface_jpeg for why the
# old scene.render.image_settings.quality line never did anything.
TEX_JPEG_Q = 74
TEX_DIR = os.path.join(OUT, "tex")
os.makedirs(TEX_DIR, exist_ok=True)


def write_surface_jpeg(v, size, path):
    """Encode the float atlas to JPEG directly instead of via Image.save().

    Two reasons.
      1. Image.save() IGNORES scene.render.image_settings.quality. Verified by
         building great_house and shrine at q82 and q70: byte-identical output,
         257 kB and 158 kB both times. The quality knob this stage documented
         was never connected to anything and every atlas shipped at Blender's
         built-in default.
      2. The map is exactly greyscale — R, G and B are all wired from the same
         scalar and the AO multiplier is scalar too, measured max channel
         deviation 0 over a whole 1024 atlas — so there is nothing for the
         encoder's chroma planes to carry.

    The transfer function is Blender's and has to stay bit-comparable or the
    whole settlement re-exposes: a float image tagged Linear Rec.709 goes to an
    8-bit format through the standard linear->sRGB curve. Measured against
    Image.save over a 64-step ramp the curve below matches to 0.0035, i.e. to
    rounding. Babylon reads baseColorTexture as sRGB and undoes it, so the
    round trip is exactly what it was."""
    from PIL import Image
    import numpy as np
    a = np.clip(v.reshape(size, size, 4)[::-1, :, :3], 0.0, 1.0)  # rows are
    #                                          bottom-up in Blender's buffer
    s = np.where(a <= 0.0031308, a * 12.92,
                 1.055 * np.power(a, 1.0 / 2.4) - 0.055)
    Image.fromarray((s * 255.0 + 0.5).astype(np.uint8)).save(
        path, "JPEG", quality=TEX_JPEG_Q, optimize=True, subsampling=2)

class _NB:
    """Throwaway node-graph builder. The patterns below are ~20 math nodes
    each and unreadable written out longhand."""

    def __init__(self, nt):
        self.nt = nt

    def n(self, kind, **kw):
        node = self.nt.nodes.new(kind)
        for k, v in kw.items():
            setattr(node, k, v)
        return node

    def _set(self, sock, v):
        if isinstance(v, bpy.types.NodeSocket):
            self.nt.links.new(v, sock)
        elif v is not None:
            sock.default_value = v

    def math(self, op, a, b=None, c=None):
        nd = self.n("ShaderNodeMath")
        nd.operation = op
        self._set(nd.inputs[0], a)
        self._set(nd.inputs[1], b)
        self._set(nd.inputs[2], c)
        return nd.outputs[0]

    def vmul(self, a, b):
        nd = self.n("ShaderNodeVectorMath")
        nd.operation = "MULTIPLY"
        self._set(nd.inputs[0], a)
        self._set(nd.inputs[1], b)
        return nd.outputs[0]

    def sep(self, vec):
        nd = self.n("ShaderNodeSeparateXYZ")
        self._set(nd.inputs[0], vec)
        return nd.outputs[0], nd.outputs[1], nd.outputs[2]

    def comb(self, x, y, z):
        nd = self.n("ShaderNodeCombineXYZ")
        self._set(nd.inputs[0], x)
        self._set(nd.inputs[1], y)
        self._set(nd.inputs[2], z)
        return nd.outputs[0]

    def ramp(self, val, f0, f1, t0=0.0, t1=1.0):
        nd = self.n("ShaderNodeMapRange")
        nd.clamp = True
        nd.interpolation_type = "SMOOTHSTEP"
        self._set(nd.inputs[0], val)
        for i, v in ((1, f0), (2, f1), (3, t0), (4, t1)):
            nd.inputs[i].default_value = v
        return nd.outputs[0]

    def noise(self, vec, scale, detail=2.0, rough=0.5):
        nd = self.n("ShaderNodeTexNoise")
        nd.noise_dimensions = "3D"
        self._set(nd.inputs["Vector"], vec)
        nd.inputs["Scale"].default_value = scale
        nd.inputs["Detail"].default_value = detail
        nd.inputs["Roughness"].default_value = rough
        return nd.outputs["Fac"]

    def wnoise(self, vec):
        nd = self.n("ShaderNodeTexWhiteNoise")
        nd.noise_dimensions = "3D"
        self._set(nd.inputs["Vector"], vec)
        return nd.outputs["Value"]

    def lines(self, coord, period, width):
        """1.0 across a face, falling to 0.0 in a groove every `period`
        metres. `width` is the groove half-width in metres."""
        f = self.math("FRACT", self.math("DIVIDE", coord, period))
        d = self.math("MINIMUM", f, self.math("SUBTRACT", 1.0, f))
        return self.ramp(self.math("MULTIPLY", d, period), 0.0, width)


def _detail(B, fam):
    """Return a scalar socket in (0, 1]: the multiplier this family applies to
    its authored albedo. Built as 1 - sum(amp * mask) so it can only darken."""
    geo = B.n("ShaderNodeNewGeometry")
    pos, nor = geo.outputs["Position"], geo.outputs["Normal"]
    px, py, pz = B.sep(pos)
    nx, ny, nz = B.sep(nor)
    ax = B.math("ABSOLUTE", nx)
    ay = B.math("ABSOLUTE", ny)
    az = B.math("ABSOLUTE", nz)
    # horizontal run coordinate that follows the face: y on X-facing walls,
    # x on Y-facing walls, and a smooth blend on battered/rotated ones, so
    # coursing never snaps or double-images along a corner.
    u = B.math("ADD", px, B.math("MULTIPLY", B.math("SUBTRACT", py, px), ax))
    # ...and the coordinate that runs ACROSS the courses. On a wall that is
    # world height; on a roof deck or a plinth top it must NOT be, because z is
    # constant over a horizontal face and the whole face then lands either
    # inside a mortar groove or outside one — a 26% flat darkening of an entire
    # roof, which is precisely the kind of "clever" change that photographs as
    # a bug. az blends z into the remaining horizontal axis, so a top face gets
    # a real 2D bond instead of one binary sample.
    w = B.math("ADD", pz, B.math("MULTIPLY", B.math("SUBTRACT", py, pz), az))
    dark = []                                   # (amplitude, mask) pairs

    def courses(h, ln, gw, amp):
        row = B.math("FLOOR", B.math("DIVIDE", w, h))
        uu = B.math("ADD", u, B.math("MULTIPLY",
                                     B.math("MODULO", row, 2.0), ln * 0.5))
        joint = B.math("MINIMUM", B.lines(w, h, gw), B.lines(uu, ln, gw))
        dark.append((amp, B.math("SUBTRACT", 1.0, joint)))
        return row, uu, ln

    if fam == "mudbrick":
        row, uu, ln = courses(0.155, 0.34, 0.015, 0.34)
        # per-brick value jitter: this is what sells "slightly irregular brick
        # sizes" without actually varying the geometry of the coursing
        dark.append((0.110, B.wnoise(B.comb(
            B.math("FLOOR", B.math("DIVIDE", uu, ln)), row, 0.0))))
        dark.append((0.070, B.noise(pos, 2.4, detail=2.0)))
        # eroded, sand-dusted lower courses: extra fine mottling that fades
        # out by knee height
        dark.append((0.100, B.math("MULTIPLY", B.ramp(pz, 0.50, 0.04),
                                   B.noise(pos, 8.0, detail=2.0))))
    elif fam == "plaster":
        dark.append((0.075, B.noise(pos, 4.0, detail=2.0)))
        dark.append((0.045, B.noise(pos, 11.0, detail=1.0)))
        vor = B.n("ShaderNodeTexVoronoi")
        vor.voronoi_dimensions = "3D"
        vor.feature = "DISTANCE_TO_EDGE"
        B._set(vor.inputs["Vector"], pos)
        vor.inputs["Scale"].default_value = 5.5
        vor.inputs["Randomness"].default_value = 1.0
        dark.append((0.15, B.ramp(vor.outputs["Distance"], 0.018, 0.0)))
    elif fam == "stone":
        courses(0.30, 0.62, 0.012, 0.22)
        dark.append((0.050, B.noise(pos, 13.0, detail=1.0)))
        wav = B.n("ShaderNodeTexWave")
        wav.wave_type = "BANDS"
        wav.bands_direction = "Z"
        B._set(wav.inputs["Vector"], pos)
        wav.inputs["Scale"].default_value = 1.4
        wav.inputs["Distortion"].default_value = 7.0
        wav.inputs["Detail"].default_value = 2.0
        dark.append((0.055, wav.outputs["Fac"]))
    elif fam == "casing":
        # DRESSED LIMESTONE ON A BATTERED FACE — the tomb, and the statue
        # plinths that share its stone.
        #
        # Why this is not just `stone` with tighter numbers. The shared `w`
        # above blends world z into a horizontal axis by |nz|, which is right
        # for a vertical wall and a flat deck and WRONG for everything between.
        # On the tomb's 46-degree casing |nz| is 0.69 and y falls as z rises,
        # so dw/dz collapses to 0.36: a 0.30 m course occupied 0.84 m of real
        # height and the entire 1.3 m of casing held about one and a half of
        # them. That is exactly what the judges photographed — "a smooth
        # grey-mauve solid with a few edge creases", the creases being the two
        # surviving grooves running DIAGONALLY across the slope.
        #
        # Casing courses are horizontal by definition, so the across-course
        # coordinate is world z on anything that is not a true deck, and only a
        # deck (|nz| > 0.9 — the ledge tops and the pyramidion's tip) falls
        # back to the 2D bond that keeps a horizontal face from landing wholly
        # inside or wholly outside one groove.
        deck = B.ramp(az, 0.90, 0.99)
        wc = B.math("ADD", pz,
                    B.math("MULTIPLY", B.math("SUBTRACT", py, pz), deck))
        # Run coordinate. `u` blends on |nx| alone, which is ambiguous on a
        # batter because |nx| and |nz| are both large there; splitting on
        # ax/(ax+ay) is exact on all four slopes of a pyramid (the +Y face gets
        # x, the +X face gets y) and degrades smoothly on a rotated block.
        fx = B.math("DIVIDE", ax, B.math("ADD", B.math("ADD", ax, ay), 1e-4))
        uc = B.math("ADD", px, B.math("MULTIPLY", B.math("SUBTRACT", py, px), fx))
        ch, cl, cg = 0.115, 0.26, 0.010          # course, block, joint (metres)
        row = B.math("FLOOR", B.math("DIVIDE", wc, ch))
        uu = B.math("ADD", uc, B.math("MULTIPLY",
                                      B.math("MODULO", row, 2.0), cl * 0.5))
        joint = B.math("MINIMUM", B.lines(wc, ch, cg), B.lines(uu, cl, cg))
        dark.append((0.26, B.math("SUBTRACT", 1.0, joint)))
        # per-block tone. Quarried casing is never one stone, and this is what
        # turns a groove grid into masonry rather than into scored plaster.
        dark.append((0.115, B.wnoise(B.comb(
            B.math("FLOOR", B.math("DIVIDE", uu, cl)), row, 0.0))))
        # weathering: wind-driven sand scours and stains the bottom third, and
        # a coarse patchiness stands in for casing that has spalled away
        dark.append((0.100, B.math("MULTIPLY", B.ramp(pz, 0.75, 0.10),
                                   B.noise(pos, 7.0, detail=2.0))))
        dark.append((0.075, B.noise(pos, 2.2, detail=3.0, rough=0.6)))
        dark.append((0.045, B.noise(pos, 16.0, detail=1.0)))
    elif fam == "timber":
        # planks run along the long axis of the piece: across a deck that is
        # X, up a post that is Z. az blends between the two.
        sc = B.math("ADD", u, B.math("MULTIPLY", B.math("SUBTRACT", py, u), az))
        dark.append((0.23, B.math("SUBTRACT", 1.0, B.lines(sc, 0.20, 0.010))))
        gv = B.vmul(pos, B.comb(
            B.math("SUBTRACT", 17.0, B.math("MULTIPLY", 14.0, az)), 17.0,
            B.math("ADD", 3.0, B.math("MULTIPLY", 14.0, az))))
        dark.append((0.100, B.noise(gv, 1.0, detail=2.0, rough=0.6)))
    elif fam == "thatch":
        sv = B.comb(20.0, B.math("SUBTRACT", 20.0, B.math("MULTIPLY", 16.0, az)),
                    B.math("ADD", 4.0, B.math("MULTIPLY", 16.0, az)))
        dark.append((0.150, B.noise(B.vmul(pos, sv), 1.0, detail=2.0, rough=0.65)))
        bc = B.math("ADD", u, B.math("MULTIPLY", B.math("SUBTRACT", px, u), az))
        dark.append((0.120, B.math("SUBTRACT", 1.0, B.lines(bc, 0.16, 0.012))))
    elif fam == "cloth":
        # woven weft. Deliberately coarse (38 mm) and shallow: a real thread
        # pitch is 2 px on this board and would alias into moire.
        dark.append((0.055, B.math("SUBTRACT", 1.0, B.lines(px, 0.038, 0.010))))
        dark.append((0.055, B.math("SUBTRACT", 1.0, B.lines(py, 0.038, 0.010))))
        dark.append((0.050, B.noise(pos, 6.5, detail=2.0)))
    elif fam == "hardstone":
        dark.append((0.090, B.wnoise(B.vmul(pos, B.comb(24.0, 24.0, 24.0)))))
        dark.append((0.065, B.noise(pos, 9.0, detail=2.0)))
        dark.append((0.050, B.noise(pos, 18.0, detail=1.0)))
    else:                                                       # ground
        dark.append((0.090, B.noise(pos, 6.0, detail=2.0)))
        dark.append((0.060, B.noise(pos, 13.0, detail=1.0)))

    v = None
    for amp, mask in dark:
        term = B.math("MULTIPLY", mask, amp)
        v = term if v is None else B.math("ADD", v, term)
    return B.math("SUBTRACT", 1.0, v)


def _mat_of(o):
    return o.data.materials[0] if o.data.materials else None


def atlas_size(objs, cap=TEX_SIZE):
    """Power-of-two atlas that holds TEX_DENSITY texels per metre of the kit's
    own surface. A shrine and a great house should photograph at the same
    texel size, not at the same file size."""
    area = sum(sum(p.area for p in o.data.polygons) for o in objs)
    want = math.sqrt(max(area, 1e-6)) * TEX_DENSITY
    n = 256
    while n < want and n < cap:
        n *= 2
    return n


def surface_bake(kind, objs, size=None):
    """UV-unwrap the kit into one atlas, bake the family patterns + a short
    texel AO into it, and rewire the materials for export. Returns a report
    dict (or None when the kit has nothing texturable)."""
    import numpy as np

    tex_objs = [o for o in objs
                if _mat_of(o) and family_of(_mat_of(o).name)]
    if not tex_objs:
        return None
    if size is None:
        size = atlas_size(tex_objs)

    # ---- one shared UV space across the whole kit (multi-object edit packs
    # every island into 0-1 together, which is what makes ONE image possible)
    for o in bpy.context.scene.objects:
        o.select_set(o in tex_objs)
    bpy.context.view_layer.objects.active = tex_objs[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.006,
                             area_weight=0.0, correct_aspect=True,
                             scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    emit_img = bpy.data.images.new(f"{kind}_emit", size, size, float_buffer=True)
    # AO bakes at FULL atlas resolution. Half res plus an upscale was tried and
    # reverted: this atlas is ~700 small islands, so at half res a large share
    # of texels average a lit face against the black interior face packed next
    # to it, and the whole kit lost 18% of its value to islands it never sees.
    ao_img = bpy.data.images.new(f"{kind}_aotex", size, size,
                                 float_buffer=True)

    mats = []
    seen = set()
    for o in tex_objs:
        m = _mat_of(o)
        if m.name in seen:
            continue
        seen.add(m.name)
        mats.append(m)

    slots = {}
    for m in mats:
        nt = m.node_tree
        B = _NB(nt)
        v = _detail(B, family_of(m.name))
        col = B.n("ShaderNodeCombineColor")
        for i in range(3):
            nt.links.new(v, col.inputs[i])
        bsdf = nt.nodes["Principled BSDF"]
        old_str = bsdf.inputs["Emission Strength"].default_value
        nt.links.new(col.outputs[0], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 1.0
        te = nt.nodes.new("ShaderNodeTexImage")
        te.image = emit_img
        ta = nt.nodes.new("ShaderNodeTexImage")
        ta.image = ao_img
        slots[m.name] = (te, ta, old_str, col)

    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.use_denoising = False
    sc.render.bake.target = "IMAGE_TEXTURES"
    sc.render.bake.use_selected_to_active = False
    sc.render.bake.use_clear = True
    sc.render.bake.margin = 3
    for o in bpy.context.scene.objects:
        o.select_set(o in tex_objs)
    bpy.context.view_layer.objects.active = tex_objs[0]

    # pattern pass: procedural + deterministic, so one sample is exact
    sc.cycles.samples = 1
    for m in mats:
        m.node_tree.nodes.active = slots[m.name][0]
    bpy.ops.object.bake(type="EMIT")

    # texel AO pass. 0.40 m rays: this is the corner/overhang contact the
    # per-vertex bake physically cannot resolve, NOT a second global gloom.
    if sc.world is None:
        sc.world = bpy.data.worlds.new("bake_world")
    sc.world.light_settings.distance = TEX_AO_DIST
    sc.cycles.samples = 48
    for m in mats:
        m.node_tree.nodes.active = slots[m.name][1]
    bpy.ops.object.bake(type="AO")

    if os.environ.get("KIT_DEBUG"):
        for im, nm in ((emit_img, "emit"), (ao_img, "ao")):
            im.file_format = "PNG"
            im.filepath_raw = os.path.join(TEX_DIR, f"dbg_{kind}_{nm}.png")
            im.save()
    n = size * size * 4
    e = np.zeros(n, dtype=np.float32)
    a = np.zeros(n, dtype=np.float32)
    emit_img.pixels.foreach_get(e)
    ao_img.pixels.foreach_get(a)
    ao = TEX_AO_FLOOR + (1.0 - TEX_AO_FLOOR) * np.clip(a, 0.0, 1.0) ** 1.3
    v = np.clip(np.clip(e, 0.0, 2.0) * ao, 0.0, 1.0)
    # Island mask. This used to read the emit ALPHA, which does not work: an
    # image made by bpy.data.images.new() starts at alpha 1 and the bake does
    # not clear it back to 0, so `cov` came out TRUE for the whole atlas, the
    # "neutral outside the islands" line below neutralised nothing, and the
    # 28% of the atlas that is empty space stayed at pure BLACK (measured on
    # marsh_reed_bed_surf.jpg: 28.1% of texels under 8/255). Every island then
    # carries a black JPEG fringe and every mip level darkens toward it.
    # The pattern itself is 1 - sum(amp*mask) and can never fall below ~0.38,
    # so its RED channel is an exact, format-independent coverage test.
    cov = e[0::4] > 0.15
    # Report the mean over texels that are actually SEEN. Half a merged kit's
    # polygons face into the inside of another box and bake to AO 0; folding
    # those into the average would pull TEX_GAIN far off and over-brighten
    # every facade to pay for surfaces no camera reaches.
    vis = cov & (a[0::4] > 0.35)
    mean = float(v[0::4][vis].mean()) if vis.any() else 1.0
    gain = TEX_GAIN
    v[3::4] = 1.0
    v.reshape(-1, 4)[~cov] = 1.0            # neutral outside the islands

    final = bpy.data.images.new(f"{kind}_surf", size, size, float_buffer=True)
    path = os.path.join(TEX_DIR, f"{kind}_surf.jpg")
    write_surface_jpeg(v, size, path)
    # hand the exporter the on-disk JPEG rather than a float datablock
    final.source = "FILE"
    final.filepath = path
    final.reload()

    # ---- rewire for export: factor x texture x COLOR_0
    for m in mats:
        nt = m.node_tree
        te, ta, old_str, col = slots[m.name]
        bsdf = nt.nodes["Principled BSDF"]
        for lk in list(bsdf.inputs["Emission Color"].links):
            nt.links.remove(lk)
        bsdf.inputs["Emission Strength"].default_value = old_str
        nt.nodes.remove(ta)
        te.image = final
        base = bsdf.inputs["Base Color"]
        mix = base.links[0].from_node if base.links else None
        if mix is None:
            nt.links.new(te.outputs["Color"], base)
            continue
        vcol = mix.inputs[7].links[0].from_socket   # RGB x VertexColor mix
        mix2 = nt.nodes.new("ShaderNodeMix")
        mix2.data_type = "RGBA"
        mix2.blend_type = "MULTIPLY"
        mix2.inputs["Factor"].default_value = 1.0
        nt.links.new(te.outputs["Color"], mix2.inputs[6])
        nt.links.new(vcol, mix2.inputs[7])
        nt.links.new(mix2.outputs[2], mix.inputs[7])

    # Every mesh in the kit must carry the SAME attribute set. Babylon merges
    # the kit's clones into one invisible silhouette proxy for the hover cue
    # (scene.ts MergeMeshes), and that throws "Cannot merge vertex data that do
    # not have the same set of attributes" the moment one primitive has UVs and
    # its neighbour does not — which silently killed building hover the first
    # time this stage shipped. Untextured meshes get a throwaway UV layer.
    for o in objs:
        if not o.data.uv_layers:
            o.data.uv_layers.new(name="UVMap")

    area = sum(sum(p.area for p in o.data.polygons) for o in tex_objs)
    bpy.data.images.remove(emit_img)
    bpy.data.images.remove(ao_img)
    return {"mats": len(mats), "meshes": len(tex_objs), "area": area, "size": size,
            "mean": mean, "gain": gain,
            "texels_per_m": (size / math.sqrt(max(area, 1e-6))),
            "kb": os.path.getsize(path) / 1024.0}


# ------------------------------------------------------------- glb payload
# Measured on the g6 library: 11.9 MB total, of which the atlases are 4.2 MB
# and the VERTEX BUFFERS are 7.3 MB. Blender writes NORMAL and TEXCOORD_0 as
# float32 and COLOR_0 as u16 — 40 bytes per vertex over ~174k vertices — so the
# download is dominated by attribute width, not by texture or by triangle
# count. Narrowing the three that can take it is the only lever here that costs
# nothing visible.
#
# POSITION IS DELIBERATELY LEFT AT FLOAT32. Quantizing it means folding a
# dequantization scale into every node's TRS, and kitLoader re-centres each kit
# by mutating mesh.position after load — that is the one attribute where a bug
# moves buildings instead of merely shading them, for the last 12% of the win.
_Q_ATTR = {                        # glTF attribute -> (componentType, dtype)
    "NORMAL": (5120, "int8"),          # ~0.5 deg; these are flat-shaded solids
    "TEXCOORD_0": (5123, "uint16"),    # 1/65535 of a 1024 atlas = 0.016 texel
    "COLOR_0": (5121, "uint8"),        # already a per-FACE constant, no ramp
}
_GLB_JSON, _GLB_BIN = 0x4E4F534A, 0x004E4942


def quantize_glb(path):
    """Rewrite an exported GLB with narrow vertex attributes. Returns
    (before, after) byte counts.

    NORMAL and TEXCOORD_0 need KHR_mesh_quantization, which Babylon registers
    from the `import "@babylonjs/loaders/glTF"` both kitLoader and decorLoader
    already do; COLOR_0 as normalized u8 is core glTF. Babylon's
    getVerticesData() runs every buffer through GetFloatData(), which
    de-normalizes, so Mesh.MergeMeshes — and therefore the hoverHalo silhouette
    proxy — sees float data exactly as before.

    Bails out unchanged on anything it does not fully understand (interleaved
    buffer views, shared views, UVs outside 0-1), because a half-converted GLB
    is worse than an unconverted one."""
    import json
    import numpy as np

    raw = open(path, "rb").read()
    js, bin_, off = None, b"", 12
    while off < len(raw):
        ln, ty = struct.unpack_from("<II", raw, off)
        off += 8
        if ty == _GLB_JSON:
            js = json.loads(raw[off:off + ln])
        elif ty == _GLB_BIN:
            bin_ = raw[off:off + ln]
        off += ln
    if js is None:
        return len(raw), len(raw)

    ctype = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16,
             5125: np.uint32, 5126: np.float32}
    ncomp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}

    want = {}
    for mesh in js.get("meshes", []):
        for prim in mesh["primitives"]:
            for attr, ai in prim["attributes"].items():
                if attr in _Q_ATTR:
                    want[ai] = _Q_ATTR[attr]

    owners = {}
    for i, acc in enumerate(js.get("accessors", [])):
        owners.setdefault(acc.get("bufferView"), []).append(i)
    for ai in list(want):
        acc = js["accessors"][ai]
        bv = js["bufferViews"][acc["bufferView"]]
        if len(owners[acc["bufferView"]]) != 1 or "byteStride" in bv:
            return len(raw), len(raw)        # interleaved/shared: not ours
        n = ncomp[acc["type"]]
        if bv["byteLength"] != acc["count"] * n * np.dtype(
                ctype[acc["componentType"]]).itemsize:
            return len(raw), len(raw)

    out = bytearray()
    for i, bv in enumerate(js["bufferViews"]):
        ai = owners.get(i, [None])[0]
        if ai is not None and ai in want:
            acc = js["accessors"][ai]
            n = ncomp[acc["type"]]
            src = np.frombuffer(bin_, dtype=ctype[acc["componentType"]],
                                count=acc["count"] * n,
                                offset=bv.get("byteOffset", 0)
                                + acc.get("byteOffset", 0)).reshape(-1, n)
            f = src.astype(np.float32)
            if acc.get("normalized"):
                f /= float(np.iinfo(src.dtype).max)
            cty, dt = want[ai]
            if dt == "int8":
                q = np.clip(np.rint(f * 127.0), -127, 127).astype(np.int8)
                # 3-byte elements are not 4-byte aligned, which the spec
                # requires of vertex attributes; pad to a stride of 4 and keep
                # the accessor VEC3.
                q = np.concatenate(
                    [q, np.zeros((len(q), 4 - n), np.int8)], axis=1)
                bv["byteStride"] = 4
            elif dt == "uint16":
                if f.min() < -1e-4 or f.max() > 1.0 + 1e-4:
                    return len(raw), len(raw)   # atlas UVs must be in 0-1
                q = np.clip(np.rint(f * 65535.0), 0, 65535).astype(np.uint16)
            else:
                q = np.clip(np.rint(f * 255.0), 0, 255).astype(np.uint8)
            data = q.tobytes()
            acc["componentType"] = cty
            acc["normalized"] = True
            acc["byteOffset"] = 0
            acc.pop("min", None)
            acc.pop("max", None)
        else:
            st = bv.get("byteOffset", 0)
            data = bin_[st:st + bv["byteLength"]]
        while len(out) % 4:
            out.append(0)
        bv["byteOffset"] = len(out)
        bv["byteLength"] = len(data)
        out += data

    js["buffers"][0]["byteLength"] = len(out)
    for key in ("extensionsUsed", "extensionsRequired"):
        used = js.setdefault(key, [])
        if "KHR_mesh_quantization" not in used:
            used.append("KHR_mesh_quantization")

    jb = json.dumps(js, separators=(",", ":")).encode()
    jb += b" " * (-len(jb) % 4)
    ob = bytes(out) + b"\0" * (-len(out) % 4)
    glb = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(jb) + 8 + len(ob))
    glb += struct.pack("<II", len(jb), _GLB_JSON) + jb
    glb += struct.pack("<II", len(ob), _GLB_BIN) + ob
    open(path, "wb").write(glb)
    return len(raw), len(glb)


for kind in KINDS:
    reset()
    P = palette()
    BUILDERS[kind](P)
    kit_objs = merge_by_material(kind)
    bake_ao(kit_objs)
    rep = surface_bake(kind, kit_objs)
    tris = sum(len(o.data.polygons) * 2 for o in kit_objs)  # rough (quads→2)
    print(f"BUILT {kind}: {len(kit_objs)} meshes ~{tris} tris")
    if rep:
        print(f"SURFACE {kind}: {rep['size']}px {rep['mats']} mats {rep['area']:.1f} m2 "
              f"{rep['texels_per_m']:.0f} texels/m mean={rep['mean']:.3f} "
              f"gain={rep['gain']:.3f} jpg={rep['kb']:.0f}kB")
    # export GLB (selection only, apply modifiers)
    for o in bpy.context.scene.objects:
        o.select_set(o in kit_objs)
    out = os.path.join(MODELS, f"{kind}.glb")
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB",
                              use_selection=True, export_apply=True,
                              export_yup=True)
    b0, b1 = quantize_glb(out)
    print(f"EXPORTED {out} bytes={b1} (raw {b0}, -{100 * (b0 - b1) / b0:.0f}%)")
    # preview render
    add_preview_rig()
    bpy.context.scene.render.filepath = os.path.join(OUT, f"new-{kind}.png")
    bpy.ops.render.render(write_still=True)

# decor props: same author -> merge -> AO bake -> GLB path, own output dir
for kind in DECOR_KINDS:
    reset()
    P = palette()
    DECOR_BUILDERS[kind](P)
    prop_objs = merge_by_material(kind)
    bake_ao(prop_objs, floor=DECOR_AO_FLOOR)
    rep = surface_bake(kind, prop_objs)
    tris = sum(len(o.data.polygons) * 2 for o in prop_objs)
    print(f"BUILT decor/{kind}: {len(prop_objs)} meshes ~{tris} tris")
    if rep:
        print(f"SURFACE decor/{kind}: {rep['size']}px {rep['mats']} mats {rep['area']:.1f} m2 "
              f"{rep['texels_per_m']:.0f} texels/m mean={rep['mean']:.3f} "
              f"gain={rep['gain']:.3f} jpg={rep['kb']:.0f}kB")
    for o in bpy.context.scene.objects:
        o.select_set(o in prop_objs)
    out = os.path.join(DECOR_MODELS, f"{kind}.glb")
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB",
                              use_selection=True, export_apply=True,
                              export_yup=True)
    b0, b1 = quantize_glb(out)
    print(f"EXPORTED {out} bytes={b1} (raw {b0}, -{100 * (b0 - b1) / b0:.0f}%)")
    add_preview_rig(size=DECOR_PREVIEW[kind])
    bpy.context.scene.render.filepath = os.path.join(OUT, f"decor-{kind}.png")
    bpy.ops.render.render(write_still=True)
print("DONE")
