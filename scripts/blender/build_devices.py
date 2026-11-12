"""Build and path-trace the photoreal device frames used by Onstage.

Run headless (Blender 4.2+; built with 5.3), from the repo root:

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        -P scripts/blender/build_devices.py

For every device model this builds the device from real-world dimensions
(metal frame, cover glass with a rounded edge, gasket, buttons, cutouts,
cameras), then renders it in Cycles (GPU) at every preset angle in both
orientations with the screen as a transparent hole:

  * public/devices/renders/<model>-<finish>-<orient>-<yaw>_<pitch>.webp —
    the device, once per finish (frame, buttons and back panel change colour)
  * public/devices/renders/<model>-glare-<orient>-<yaw>_<pitch>.webp — only
    the reflections on the cover glass over the screen (when it's visible)
  * public/devices/renders/<model>-shadow-<orient>-<yaw>_<pitch>.webp — a
    soft shadow the device casts on a backdrop just behind it (black + alpha)
  * src/lib/deviceRenders.json — the manifest (contract: version 2, see
    src/lib/deviceRenders.ts): finishes per model, and per render the box
    size, the pixel corners of the screen, its corner
    shape, and the files above.

Afterwards run `node scripts/make-render-thumbs.mjs` to (re)make the small
front-on copies the marketing pages use.

Narrow a run with --only iphone --angles -26_-6 --orient portrait
--finishes black (the manifest is merged, so partial runs keep the other
entries). --no-glare / --no-shadow skip those layers. ~5 s per phone render
on an M3 Max.

Models are 1 unit wide and 1/aspect tall, where aspect MUST match
MODEL_ASPECT in src/lib/deviceGeometry.ts (the app sizes frame boxes from it).
"""

import json
import math
import os
import time
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

# ── CLI ──────────────────────────────────────────────────────────────────────
argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def _arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default


RENDER_DIR = os.path.abspath(_arg("--render-dir", "public/devices/renders"))
MANIFEST = os.path.abspath(_arg("--manifest", "src/lib/deviceRenders.json"))
ONLY = _arg("--only")  # comma-separated model ids
ONLY_FINISHES = _arg("--finishes")  # comma-separated finish ids
DO_GLARE = "--no-glare" not in argv
DO_SHADOW = "--no-shadow" not in argv
TMP_DIR = os.path.abspath(_arg("--tmp-dir", os.path.join(RENDER_DIR, ".tmp")))

# ── device specs (millimetres) ───────────────────────────────────────────────
# width: real body width. aspect: from deviceGeometry.ts. depth: body thickness.
# corner: body corner radius. edge: radius of the rounding where the sides meet
# the front/back glass (≈ depth/2 → pillowy sides; small → flat band).
# bezel: body edge → active screen (side, top, bottom). buttons: (side,
# from_top, length) with side in L/R/T (T: measured from the right end of the
# top edge). back: (camera layout id, params). metal: frame material class.
# back_mat: the back panel's finish ("glass" frosted, "glossy" glass, "metal").

SPECS = {
    # iPhone 17 Pro — aluminium unibody, full-width camera plateau.
    "iphone": dict(
        squircle=True,
        width=71.9, aspect=0.476, depth=8.75, corner=12.4, edge=1.6,
        bezel=(2.55, 2.55, 2.55), screen_corner=9.6,
        cutout=("island", 21.2, 6.3, 1.7),  # w, h, gap below the screen top
        buttons=[("L", 26.5, 6.8), ("L", 41.0, 11.0), ("L", 55.5, 11.0),
                 ("R", 47.0, 17.5), ("R", 101.0, 13.0)],
        back=("plateau", {}), metal="aluminium", back_mat="glass",
    ),
    # iPhone SE (3rd gen) — iPhone 8 body, Touch ID, glossy glass back.
    "iphone-se": dict(
        squircle=True,
        width=67.3, aspect=0.49, depth=7.3, corner=9.0, edge=2.6,
        bezel=(4.5, 16.0, 17.5), screen_corner=0.6,
        cutout="se", buttons=[("L", 18.0, 6.0), ("L", 28.0, 9.0), ("L", 42.0, 9.0),
                              ("R", 33.0, 11.0)],
        back=("single", dict(x=9.5, y=9.0, r=4.5, bump=0.9, flash=8.5, fr=1.75)),
        metal="aluminium", back_mat="glossy",
    ),
    # iPad Pro 13" (M4) — flat aluminium, single wide + LiDAR module.
    "ipad": dict(
        squircle=True,
        width=215.5, aspect=0.75, depth=5.1, corner=17.5, edge=1.1,
        bezel=(8.4, 8.4, 8.4), screen_corner=10.5,
        cutout=("side_cam", 1.6), buttons=[("T", 22.0, 14.0), ("R", 22.0, 12.0), ("R", 38.0, 12.0)],
        back=("ipad", {}), metal="aluminium", back_mat="metal",
    ),
    # iPad mini (A17 Pro) — portrait-top camera, volume on the top edge.
    "ipad-mini": dict(
        squircle=True,
        width=134.8, aspect=0.7, depth=6.3, corner=12.5, edge=1.2,
        bezel=(8.6, 8.6, 8.6), screen_corner=8.0,
        cutout=("top_cam", 1.6), buttons=[("T", 14.0, 13.0), ("T", 33.0, 10.0), ("T", 45.0, 10.0)],
        back=("single", dict(x=11.0, y=11.0, r=5.5, bump=0.5, flash=10.0, fr=1.75)),
        metal="aluminium", back_mat="metal",
    ),
    # Pixel 10 — flat satin aluminium frame, glossy back, camera-bar pill.
    "pixel": dict(
        width=72.0, aspect=0.47, depth=8.6, corner=10.5, edge=1.7,
        bezel=(2.4, 2.4, 2.4), screen_corner=8.0,
        cutout=("punch", 3.2, 3.6), buttons=[("R", 40.0, 11.0), ("R", 60.0, 22.0)],
        back=("pixel", {}), metal="aluminium", back_mat="glossy",
    ),
    # Galaxy S24 Ultra — flat titanium frame, squarer corners, frosted back.
    "galaxy": dict(
        width=79.0, aspect=0.487, depth=8.6, corner=5.4, edge=1.2,
        bezel=(2.0, 2.0, 2.0), screen_corner=3.4,
        cutout=("punch", 3.0, 2.8), buttons=[("R", 36.0, 24.0), ("R", 67.0, 13.0)],
        back=("galaxy", {}), metal="titanium", back_mat="glass",
    ),
    # Galaxy A55 — aluminium frame with the raised "Key Island", glass back.
    "galaxy-a": dict(
        width=77.4, aspect=0.487, depth=8.2, corner=9.5, edge=1.8,
        bezel=(2.8, 3.4, 3.8), screen_corner=7.0,
        cutout=("punch", 3.4, 3.8), buttons=[("R", 38.0, 22.0), ("R", 67.0, 12.0)],
        key_island=(33.0, 51.0),
        back=("galaxy_a", {}), metal="aluminium", back_mat="glass",
    ),
    # Galaxy Z Fold6, unfolded — under-display inner camera (no hole), cover
    # screen on the back of the left half, cameras on the back of the right.
    "fold": dict(
        width=132.6, aspect=0.86, depth=5.6, corner=7.0, edge=1.0,
        bezel=(3.0, 3.0, 3.0), screen_corner=4.6,
        cutout=None, crease=True,
        buttons=[("R", 30.0, 24.0), ("R", 62.0, 13.0)],
        back=("fold", {}), metal="aluminium", back_mat="glass",
    ),
    # Galaxy Tab S9 — flat Armor Aluminum, landscape-top camera, metal back.
    "galaxy-tab": dict(
        width=165.8, aspect=0.625, depth=5.9, corner=10.0, edge=1.2,
        bezel=(8.0, 8.0, 8.0), screen_corner=5.5,
        cutout=("side_cam", 1.6), buttons=[("R", 22.0, 24.0), ("R", 52.0, 12.0)],
        back=("single", dict(x=11.0, y=11.0, r=6.0, bump=0.7, flash=8.0, fr=1.75)),
        metal="aluminium", back_mat="metal",
    ),
}

# ── finishes ─────────────────────────────────────────────────────────────────
# Shared ids: "black" = the darkest, "silver" = the light one, "natural" = the
# model's distinctive third colourway. (official name, frame sRGB hex, back
# sRGB hex). Order = display order; the first is the default. Models with only
# two official finishes omit "natural".
FINISHES = {
    "iphone": {"black": ("Deep Blue", "#2E3A55", "#2C3955"),
               "silver": ("Silver", "#D9DADC", "#E4E5E7"),
               "natural": ("Cosmic Orange", "#D8702E", "#DE7630")},
    "iphone-se": {"black": ("Midnight", "#232427", "#1F2023"),
                  "silver": ("Starlight", "#E4DDD0", "#E8E1D5"),
                  "natural": ("(PRODUCT)RED", "#BA0C2F", "#BC0F32")},
    "ipad": {"black": ("Space Black", "#3C3C3E", "#3A3A3C"),
             "silver": ("Silver", "#D8D9DB", "#DCDDDF")},
    "ipad-mini": {"black": ("Space Gray", "#5E5E62", "#5C5C60"),
                  "silver": ("Starlight", "#E4D9C8", "#E8DECE"),
                  "natural": ("Blue", "#A6B9D2", "#A9BCD3")},
    "pixel": {"black": ("Obsidian", "#2B2C2F", "#28292C"),
              "silver": ("Frost", "#D6DADC", "#E3E7E9"),
              "natural": ("Indigo", "#7B86B8", "#8892C4")},
    "galaxy": {"black": ("Titanium Black", "#2D2D2F", "#2B2B2D"),
               "silver": ("Titanium Gray", "#8B8B8D", "#9A9A9C"),
               "natural": ("Titanium Violet", "#6F6789", "#8C86A6")},
    "galaxy-a": {"black": ("Awesome Navy", "#2B3040", "#2E3548"),
                 "silver": ("Awesome Iceblue", "#C9D6E4", "#CFDCEA"),
                 "natural": ("Awesome Lilac", "#BDB1D6", "#C6BBDD")},
    "fold": {"black": ("Crafted Black", "#1E1E20", "#232325"),
             "silver": ("Silver Shadow", "#C3C6CB", "#CDD0D5"),
             "natural": ("Pink", "#E1B8B0", "#E8C6BF")},
    "galaxy-tab": {"black": ("Graphite", "#6A6A6E", "#6E6E72"),
                   "silver": ("Beige", "#D9D0C1", "#DFD6C8")},
}

# Frame metals. Anodised aluminium = a coloured metal under a thin clear oxide
# (the coat gives the neutral sheen that keeps dark colours readable);
# titanium = a greyer, slightly brushed bare metal.
METALS = {
    "aluminium": dict(rough=0.30, aniso=0.0, coat=0.6, coat_rough=0.22, lift=0.8),
    "titanium": dict(rough=0.27, aniso=0.35, coat=0.0, coat_rough=0.2, lift=0.85),
}
BACKS = {
    "glass": dict(metallic=0.0, rough=0.34, coat=0.0),   # frosted glass
    "glossy": dict(metallic=0.0, rough=0.06, coat=0.0),  # polished glass
    "metal": dict(metallic=1.0, rough=0.42, coat=0.35),  # bead-blasted aluminium
}


def srgb_to_linear(hexstr):
    h = hexstr.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


# ── geometry helpers (built in "app space": x right, y up, z out of screen) ──


def rrect_pts(w, h, r, seg=20, cx=0.0, cy=0.0, squircle=False):
    """CCW points of a rounded rect (viewed from +z).

    squircle=True gives Apple-style continuous-curvature corners: a
    superellipse quadrant (n=4) spanning ~1.3r, which eases into the straight
    edge instead of the visible "kink" where a circular arc meets it.
    """
    R = r * 1.3 if squircle else r
    R = max(0.0, min(R, w / 2 - 1e-5, h / 2 - 1e-5))
    n = 4.0
    pts = []
    corners = [(w / 2 - R, -h / 2 + R, -90), (w / 2 - R, h / 2 - R, 0),
               (-w / 2 + R, h / 2 - R, 90), (-w / 2 + R, -h / 2 + R, 180)]
    for (ox, oy, a0) in corners:
        if R <= 1e-6:
            pts.append((cx + ox, cy + oy))
            continue
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            c, sn = math.cos(a), math.sin(a)
            if squircle:
                c = math.copysign(abs(c) ** (2 / n), c)
                sn = math.copysign(abs(sn) ** (2 / n), sn)
            pts.append((cx + ox + R * c, cy + oy + R * sn))
    return pts


def circle_pts(r, seg=40, cx=0.0, cy=0.0):
    return [(cx + r * math.cos(2 * math.pi * i / seg), cy + r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]


class Builder:
    """Accumulates one bmesh per material-object, then emits objects."""

    def __init__(self, name):
        self.name = name
        self.objects = []
        self.mats = {}

    def mat(self, name):
        return self.mats[name]

    def emit(self, name, bm, mat_name, smooth=True, sharp_angle=None):
        # Build space (x right, y up, z out of the screen) → Blender (x, -z, y):
        # upright, screen facing the camera at -Y. A proper rotation, so face
        # winding (and thus normals) is preserved.
        for v in bm.verts:
            x, y, z = v.co
            v.co = Vector((x, -z, y))
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        for p in me.polygons:
            p.use_smooth = smooth
        if sharp_angle is not None:
            # Edges whose faces meet at more than sharp_angle stay hard.
            bm2 = bmesh.new()
            bm2.from_mesh(me)
            for e in bm2.edges:
                if len(e.link_faces) == 2:
                    ang = e.link_faces[0].normal.angle(e.link_faces[1].normal, 0.0)
                    e.smooth = ang < math.radians(sharp_angle)
            bm2.to_mesh(me)
            bm2.free()
        me.materials.append(self.mats[mat_name])
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        self.objects.append(ob)
        return ob


def flat_face(pts, z, uv=False, bounds=None):
    bm = bmesh.new()
    verts = [bm.verts.new((x, y, z)) for (x, y) in pts]
    f = bm.faces.new(verts)
    if uv:
        layer = bm.loops.layers.uv.new("UVMap")
        (x0, y0, x1, y1) = bounds
        for loop in f.loops:
            x, y, _ = loop.vert.co
            loop[layer].uv = ((x - x0) / (x1 - x0), (y - y0) / (y1 - y0))
    return bm


def extrude_prism(pts, z0, z1, bevel=0.0, segs=6, bevel_top=True, bevel_bottom=True):
    """Closed prism from a CCW outline between z0<z1, optional rounded caps."""
    bm = bmesh.new()
    bottom = [bm.verts.new((x, y, z0)) for (x, y) in pts]
    top = [bm.verts.new((x, y, z1)) for (x, y) in pts]
    n = len(pts)
    bm.faces.new(list(reversed(bottom)))
    bm.faces.new(top)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bottom[i], bottom[j], top[j], top[i]))
    bm.normal_update()
    if bevel > 0:
        cap_edges = []
        for e in bm.edges:
            fs = e.link_faces
            if len(fs) != 2:
                continue
            nz = [abs(f.normal.z) > 0.99 for f in fs]
            if nz[0] != nz[1]:
                is_top = (fs[0].normal.z if nz[0] else fs[1].normal.z) > 0
                if (is_top and bevel_top) or ((not is_top) and bevel_bottom):
                    cap_edges.append(e)
        bmesh.ops.bevel(bm, geom=cap_edges, offset=bevel, offset_type="OFFSET",
                        segments=segs, profile=0.5, affect="EDGES", clamp_overlap=True)
    bm.normal_update()
    return bm


def mark_cap_edges_sharp(bm):
    """Hard edge where the flat front/back caps meet the bevel, smooth elsewhere."""
    bm.normal_update()
    for e in bm.edges:
        fs = e.link_faces
        if len(fs) == 2:
            flat = [abs(f.normal.z) > 0.9999 for f in fs]
            e.smooth = not (flat[0] != flat[1])


def rounded_box(cx, cy, cz, sx, sy, sz, r, segs=4):
    """Rounded box centred at (cx,cy,cz) with full size (sx,sy,sz)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * sx + cx, v.co.y * sy + cy, v.co.z * sz + cz))
    r = min(r, sx / 2 * 0.98, sy / 2 * 0.98, sz / 2 * 0.98)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=r, offset_type="OFFSET",
                    segments=segs, profile=0.5, affect="EDGES", clamp_overlap=True)
    bm.normal_update()
    return bm


def cylinder(cx, cy, z0, z1, r, seg=48, bevel=0.0):
    pts = circle_pts(r, seg, cx, cy)
    return extrude_prism(pts, z0, z1, bevel=bevel, segs=3, bevel_bottom=False)


def merge(bms):
    out = bmesh.new()
    for b in bms:
        me = bpy.data.meshes.new("tmp")
        b.to_mesh(me)
        out.from_mesh(me)
        bpy.data.meshes.remove(me)
        b.free()
    return out


# ── materials ────────────────────────────────────────────────────────────────


def principled(name, color, metallic=0.0, rough=0.5, emission=None, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.05
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 1.0
    return m


def make_materials(spec):
    grey = (0.1, 0.1, 0.1)
    return {
        "Frame": principled("Frame", grey, metallic=1.0, rough=0.3),
        "Button": principled("Button", grey, metallic=1.0, rough=0.3),
        "FrontGlass": principled("FrontGlass", (0.004, 0.004, 0.005), rough=0.04, coat=1.0),
        "BackGlass": principled("BackGlass", grey, rough=0.4),
        "Screen": principled("Screen", (0.0, 0.0, 0.0), rough=0.05, emission=(1.0, 1.0, 1.0)),
        "Cutout": principled("Cutout", (0.0, 0.0, 0.0), rough=0.15),
        "Gasket": principled("Gasket", (0.006, 0.006, 0.007), rough=0.55),
        "Lens": principled("Lens", (0.01, 0.012, 0.02), rough=0.03, coat=1.0),
        "FrontLens": principled("FrontLens", (0.004, 0.005, 0.009), rough=0.08),
        "LensRing": principled("LensRing", (0.35, 0.35, 0.37), metallic=1.0, rough=0.18),
        "Flash": principled("Flash", (0.85, 0.8, 0.65), rough=0.3),
    }


# ── device builder ───────────────────────────────────────────────────────────


def build(model_id, spec):
    S = 1.0 / spec["width"]  # mm → units (device is 1 wide)
    W = 1.0
    H = W / spec["aspect"]
    D = spec["depth"] * S
    r = spec["corner"] * S
    edge = min(spec["edge"] * S, D * 0.48)
    front = D / 2
    back = -D / 2

    b = Builder(model_id)
    b.mats = make_materials(spec)

    # ── body ──
    # Built like the real thing: a metal frame slab with rounded rails, a
    # cover-glass slab seated on top (its own rounded 2.5D edge, slightly
    # proud of the frame) and a thin black gasket line between the two.
    sq = spec.get("squircle", False)
    glass_t = 0.55 * S  # glass standing above the frame's front face
    front_f = front - glass_t
    lip = spec.get("lip", min(spec["edge"], 1.0)) * S  # frame edge → glass edge
    gasket_w = 0.22 * S

    frame_body = extrude_prism(rrect_pts(W, H, r, seg=48, squircle=sq), back, front_f,
                               bevel=edge, segs=14)
    mark_cap_edges_sharp(frame_body)
    back_faces = [f.index for f in frame_body.faces if f.normal.z < -0.9999]
    me = bpy.data.meshes.new("tmp")
    frame_body.to_mesh(me)
    frame_body.free()

    def sub(indices, keep):
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.faces.ensure_lookup_table()
        idx = set(indices)
        kill = [f for f in bm.faces if (f.index in idx) != keep]
        bmesh.ops.delete(bm, geom=kill, context="FACES")
        return bm

    b.emit("Frame", sub(back_faces, keep=False), "Frame")
    b.emit("BackGlass", sub(back_faces, keep=True), "BackGlass", smooth=False)
    bpy.data.meshes.remove(me)

    gi = lip - gasket_w  # gasket outline inset
    gasket = extrude_prism(rrect_pts(W - 2 * gi, H - 2 * gi, max(r - gi, 0.001), seg=48, squircle=sq),
                           front_f - 0.3 * S, front_f + glass_t * 0.45, bevel=glass_t * 0.2, segs=3,
                           bevel_bottom=False)
    mark_cap_edges_sharp(gasket)
    b.emit("Gasket", gasket, "Gasket")

    glass = extrude_prism(rrect_pts(W - 2 * lip, H - 2 * lip, max(r - lip, 0.001), seg=48, squircle=sq),
                          front_f - 0.3 * S, front, bevel=glass_t * 0.85, segs=10, bevel_bottom=False)
    mark_cap_edges_sharp(glass)
    b.emit("FrontGlass", glass, "FrontGlass")

    # ── screen ──
    bl, bt, bb = (v * S for v in spec["bezel"])
    sw = W - 2 * bl
    sh = H - bt - bb
    scy = (bb - bt) / 2
    scr_pts = rrect_pts(sw, sh, spec["screen_corner"] * S, seg=32, cy=scy,
                        squircle=spec.get("squircle", False))
    z_scr = front + 0.0004
    scr_ob = b.emit("Screen", flat_face(scr_pts, z_scr, uv=True,
                                        bounds=(-sw / 2, scy - sh / 2, sw / 2, scy + sh / 2)),
                    "Screen", smooth=False)
    # Read back by render_all() for the manifest's corner shape.
    scr_ob["corner_radius"] = spec["screen_corner"] * S
    screen_top = scy + sh / 2

    # ── front cutouts ──
    z_cut = front + 0.0008
    cut = spec["cutout"]
    if isinstance(cut, tuple) and cut[0] == "island":
        _, iw, ih, gap = cut
        iw, ih, gap = iw * S, ih * S, gap * S
        cy = screen_top - gap - ih / 2
        b.emit("Island", flat_face(rrect_pts(iw, ih, ih / 2, seg=16, cy=cy), z_cut), "Cutout", smooth=False)
        lens = circle_pts(ih * 0.3, 32, iw / 2 - ih * 0.55, cy)
        b.emit("FrontCam", flat_face(lens, z_cut + 0.0003), "FrontLens", smooth=False)
    elif isinstance(cut, tuple) and cut[0] in ("punch", "punch_offset"):
        d, gap = cut[1] * S, cut[2] * S  # diameter, screen top → hole centre
        cx = (cut[3] - 0.5) * sw if cut[0] == "punch_offset" else 0.0
        cy = screen_top - gap
        b.emit("Punch", flat_face(circle_pts(d / 2, 40, cx, cy), z_cut), "Cutout", smooth=False)
        b.emit("FrontCam", flat_face(circle_pts(d * 0.22, 24, cx, cy), z_cut + 0.0003), "FrontLens", smooth=False)
    elif isinstance(cut, tuple) and cut[0] == "side_cam":
        d = cut[1] * S
        # Landscape-top camera of modern tablets → the right bezel in portrait.
        b.emit("FrontCam", flat_face(circle_pts(d, 32, W / 2 - bl / 2, 0.0), front + 0.0004), "FrontLens", smooth=False)
    elif isinstance(cut, tuple) and cut[0] == "top_cam":
        d = cut[1] * S
        b.emit("FrontCam", flat_face(circle_pts(d, 32, 0.0, H / 2 - bt / 2), front + 0.0004), "FrontLens", smooth=False)
    elif cut == "se":
        top_mid = H / 2 - bt / 2
        # Earpiece slot, FaceTime camera to its left, faint proximity sensor above.
        b.emit("Speaker", flat_face(rrect_pts(11.0 * S, 1.4 * S, 0.7 * S, seg=8, cy=top_mid), front + 0.0004),
               "Cutout", smooth=False)
        b.emit("FrontCam", flat_face(circle_pts(1.3 * S, 24, -9.0 * S, top_mid), front + 0.0004),
               "FrontLens", smooth=False)
        b.emit("FrontCam2", flat_face(circle_pts(0.7 * S, 20, 0.0, top_mid + 3.6 * S), front + 0.0004),
               "FrontLens", smooth=False)
        hb_y = -H / 2 + bb / 2
        ring = rrect_pts(11.0 * S, 11.0 * S, 5.5 * S, seg=24, cy=hb_y)
        inner = rrect_pts(10.0 * S, 10.0 * S, 5.0 * S, seg=24, cy=hb_y)
        b.emit("HomeRing", flat_face(ring, front + 0.0004), "Button", smooth=False)
        b.emit("HomeButton", flat_face(inner, front + 0.0008), "FrontGlass", smooth=False)

    if spec.get("crease"):
        # The fold's hinge: a faint vertical line down the inner screen.
        b.emit("Crease", flat_face(rrect_pts(0.0022, sh, 0.0, cy=scy), z_scr + 0.0002), "Cutout", smooth=False)

    # ── side buttons ──
    btn_d = D * 0.36
    proud = max(0.45 * S, 0.0025)  # how far a button stands off the rail
    btns = []
    base = 0.0
    if spec.get("key_island"):
        # Galaxy A's "Key Island": a raised plinth on the right rail that
        # the buttons sit on.
        kt, kl = (v * S for v in spec["key_island"])
        ki = proud * 0.8
        btns.append(rounded_box(W / 2 - ki * 0.5, H / 2 - kt - kl / 2, 0.0, ki * 2.0, kl, btn_d * 1.5, btn_d * 0.7))
        base = ki * 0.5
    for side, from_top, length in spec["buttons"]:
        L = length * S
        c = H / 2 - from_top * S - L / 2 if side in "LR" else None
        if side == "R":
            btns.append(rounded_box(W / 2 + base - proud * 0.6, c, 0.0, proud * 2.4, L, btn_d, btn_d * 0.5))
        elif side == "L":
            btns.append(rounded_box(-W / 2 + proud * 0.6, c, 0.0, proud * 2.4, L, btn_d, btn_d * 0.5))
        else:  # T: measured from the right end of the top edge
            cx = W / 2 - from_top * S - L / 2
            btns.append(rounded_box(cx, H / 2 - proud * 0.6, 0.0, L, proud * 2.4, btn_d, btn_d * 0.5))
    if btns:
        b.emit("Buttons", merge(btns), "Button", sharp_angle=50)

    # ── back cameras (seen at steep angles / the back view) ──
    build_back(b, spec, S, W, H, D, back, edge)

    return b


def lens_stack(parts, cx, cy, z, r, bump_h):
    """A camera lens: metal ring proud of the surface + dark glass inside."""
    parts["ring"].append(cylinder(cx, cy, z - bump_h, z - bump_h - 0.6 * r * 0.25, r, bevel=r * 0.08))
    lens_z = z - bump_h - 0.6 * r * 0.25 - 0.0004
    parts["lens"].append(flat_face_back(circle_pts(r * 0.74, 48, cx, cy), lens_z))
    # the barrel between the back and the ring, so a raised ring never floats
    parts["ring"].append(cylinder(cx, cy, z + 0.0002, z - bump_h - 0.0001, r * 0.96, seg=48))


def flat_face_back(pts, z):
    """A flat face facing -z (for the back of the device)."""
    return flat_face(list(reversed(pts)), z)


def build_back(b, spec, S, W, H, D, back, edge):
    kind, P = spec["back"]
    parts = {"ring": [], "lens": [], "plate": [], "flash": [], "plate_glass": [], "window": [],
             "cover": [], "seam": [], "hole": []}
    z = back  # back surface (faces -z); things stack toward -z
    # Coordinates: x > 0 is the button side seen from the FRONT, which is the
    # LEFT seen from the back — where cameras sit. "from the left edge (back
    # view)" = W/2 - x.

    def plate(w, h, r, cx, cy, t, mat="plate"):
        pts = rrect_pts(w, h, r, seg=20, cx=cx, cy=cy)
        parts[mat].append(extrude_prism(pts, z - t, z + 0.0005, bevel=t * 0.45, segs=4, bevel_top=False))

    def flash(cx, cy, r, zz):
        parts["flash"].append(flat_face_back(circle_pts(r, 24, cx, cy), zz - 0.0004))

    if kind == "plateau":
        # iPhone 17 Pro: a colour-matched aluminium plateau across the full
        # width of the top, lenses in a triangle on its back-left half,
        # flash + LiDAR + mic at its back-right end.
        inset = edge + 0.3 * S
        top_h = 44.0 * S
        y_cut = H / 2 - top_h
        body = rrect_pts(W - 2 * inset, H - 2 * inset, spec["corner"] * S - inset, seg=40, squircle=True)
        xr = W / 2 - inset
        outline = [(xr, y_cut)] + [p for p in body if p[1] > y_cut + 1e-6] + [(-xr, y_cut)]
        t = 1.3 * S
        parts["plate"].append(extrude_prism(outline, z - t, z + 0.0005, bevel=t * 0.5, segs=5, bevel_top=False))
        zt = z - t
        cx, cy = W / 2 - 22.5 * S, H / 2 - 22.0 * S
        rr = 7.2 * S
        for (dx, dy) in [(-8.4, 8.4), (-8.4, -8.4), (8.4, 0.0)]:
            lens_stack(parts, cx - dx * S, cy + dy * S, zt, rr, 1.2 * S)
        fx = -W / 2 + 11.0 * S
        flash(fx, cy + 7.5 * S, 2.6 * S, zt)
        parts["lens"].append(flat_face_back(circle_pts(2.5 * S, 24, fx, cy - 7.5 * S), zt - 0.0004))
        parts["hole"].append(flat_face_back(circle_pts(0.55 * S, 12, fx + 6.5 * S, cy + 7.5 * S), zt - 0.0004))
    elif kind == "single":
        cx, cy = W / 2 - P["x"] * S, H / 2 - P["y"] * S
        lens_stack(parts, cx, cy, z, P["r"] * S, P["bump"] * S)
        flash(cx - P["flash"] * S, cy, P["fr"] * S, z)
    elif kind == "ipad":
        # iPad Pro M4: rounded-square glass module, one wide lens, LiDAR, flash.
        s = 31.0 * S
        cx, cy = W / 2 - 6.0 * S - s / 2, H / 2 - 6.0 * S - s / 2
        t = 0.9 * S
        plate(s, s, 8.5 * S, cx, cy, t, "plate_glass")
        lens_stack(parts, cx + 6.5 * S, cy + 6.5 * S, z - t, 8.0 * S, 0.8 * S)
        parts["lens"].append(flat_face_back(circle_pts(2.6 * S, 28, cx + 6.5 * S, cy - 8.0 * S), z - t - 0.0004))
        flash(cx - 8.0 * S, cy + 7.5 * S, 2.0 * S, z - t)
        parts["hole"].append(flat_face_back(circle_pts(0.6 * S, 12, cx - 8.0 * S, cy - 2.0 * S), z - t - 0.0004))
    elif kind == "pixel":
        # Pixel 10: a pill-shaped metal camera bar (inset from the rails) with
        # a black glass window: three lenses in a row, then flash + sensor.
        bw, bh = W - 11.0 * S, 19.0 * S
        cy = H / 2 - 11.0 * S - bh / 2
        t = 1.8 * S
        plate(bw, bh, bh / 2, 0.0, cy, t, "plate")
        wz = z - t - 0.0003
        parts["window"].append(flat_face_back(rrect_pts(bw - 3.2 * S, bh - 3.2 * S, (bh - 3.2 * S) / 2, seg=24, cy=cy), wz))
        for x, rr in [(20.5, 6.2), (7.6, 5.6), (-4.6, 5.1)]:
            lens_stack(parts, x * S, cy, wz, rr * S, 0.4 * S)
        flash(-16.0 * S, cy, 1.8 * S, wz)
        parts["lens"].append(flat_face_back(circle_pts(1.2 * S, 20, -21.5 * S, cy), wz - 0.0004))
    elif kind == "galaxy":
        # S24 Ultra: no island — three big lenses in a column, the 5x
        # periscope beside the top one, laser AF and flash below it.
        cx = W / 2 - 12.5 * S
        for dy, rr in [(13.0, 5.6), (27.0, 5.4), (41.0, 5.2)]:
            lens_stack(parts, cx, H / 2 - dy * S, z, rr * S, 1.3 * S)
        lens_stack(parts, cx - 13.0 * S, H / 2 - 13.0 * S, z, 4.0 * S, 1.0 * S)
        parts["lens"].append(flat_face_back(circle_pts(1.4 * S, 20, cx - 13.0 * S, H / 2 - 23.5 * S), z - 0.0004))
        flash(cx - 13.0 * S, H / 2 - 29.5 * S, 1.7 * S, z)
    elif kind == "galaxy_a":
        # A55: three separate lenses in a column, flash beside the lowest.
        cx = W / 2 - 11.5 * S
        for dy, rr in [(12.0, 4.75), (26.5, 4.75), (41.0, 4.25)]:
            lens_stack(parts, cx, H / 2 - dy * S, z, rr * S, 0.8 * S)
        flash(cx - 9.5 * S, H / 2 - 41.0 * S, 1.75 * S, z)
    elif kind == "fold":
        # Fold6 unfolded: the right half's back carries the camera column;
        # the left half's back is the cover screen; a seam marks the hinge.
        cx = W / 2 - 11.5 * S
        for dy, rr in [(13.0, 5.5), (28.0, 4.75), (43.0, 4.75)]:
            lens_stack(parts, cx, H / 2 - dy * S, z, rr * S, 1.1 * S)
        flash(cx - 9.5 * S, H / 2 - 13.0 * S, 1.75 * S, z)
        ins = edge + 0.6 * S
        cw, ch = W / 2 - ins - 1.2 * S, H - 2 * ins
        ccx = -W / 2 + ins + cw / 2
        parts["cover"].append(flat_face_back(rrect_pts(cw, ch, 6.0 * S, seg=24, cx=ccx), z - 0.0004))
        parts["hole"].append(flat_face_back(circle_pts(1.4 * S, 28, ccx, H / 2 - ins - 4.5 * S), z - 0.0008))
        parts["seam"].append(flat_face_back(rrect_pts(0.5 * S, H - 2 * edge, 0.0, cx=0.0), z - 0.0003))

    if parts["plate_glass"]:
        b.emit("CameraPlate", merge(parts["plate_glass"]), "BackGlass", sharp_angle=40)
    if parts["plate"]:
        b.emit("CameraBar", merge(parts["plate"]), "Frame", sharp_angle=40)
    if parts["window"]:
        b.emit("CameraWindow", merge(parts["window"]), "FrontGlass", smooth=False)
    if parts["cover"]:
        b.emit("CoverScreen", merge(parts["cover"]), "FrontGlass", smooth=False)
    if parts["seam"]:
        b.emit("Seam", merge(parts["seam"]), "Gasket", smooth=False)
    if parts["ring"]:
        b.emit("LensRings", merge(parts["ring"]), "LensRing", sharp_angle=40)
    if parts["lens"]:
        b.emit("Lenses", merge(parts["lens"]), "Lens", sharp_angle=40)
    if parts["hole"]:
        b.emit("Holes", merge(parts["hole"]), "Cutout", smooth=False)
    if parts["flash"]:
        b.emit("Flash", merge(parts["flash"]), "Flash", smooth=False)


# ── scene / export ───────────────────────────────────────────────────────────


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ── photoreal renders ────────────────────────────────────────────────────────
# Each (model, orientation, preset angle) is path-traced in Cycles with the
# screen as a HOLDOUT (a transparent, anti-aliased hole) once per finish, and
# its screen's four corners are projected to image pixels. The app warps the
# user's screenshot into that quad (a homography — exact for a planar screen)
# and draws the render on top, the same pipeline pro mockup tools use. Two
# finish-independent layers go with it: the glare on the screen's glass and
# the shadow the device casts.

# Must match PERSPECTIVE_PRESETS in src/lib/editorDoc.ts (plus front-on).
# (yaw, pitch): HERO = (-34, -12). Only screen-side views: the app always
# shows the user's screenshot, so a back view would have nothing to show.
ANGLES = [(0, 0), (-26, -6), (26, -6), (-15, -4), (-34, -12)]
# Render width (px) of the portrait frame box per model (landscape: the same
# long edge); big enough that a full-size store export never upscales it.
RENDER_WIDTH = {"ipad": 2400, "ipad-mini": 2000, "galaxy-tab": 2200, "fold": 1900}
RENDER_WIDTH_DEFAULT = 1300
MARGIN = 1.08  # breathing room around an angled device inside its frame box
FOV = 20.0
SAMPLES = int(_arg("--samples", "192"))

# Glare: reflected radiance R (linear) → display value v = sRGB(1-e^(-kR)) * s,
# drawn as alpha = v, colour = v/max(v): i.e. a "screen" blend over the
# screenshot, which is what a reflection on glass is.
GLARE_GAIN = float(_arg("--glare-gain", "1.0"))
GLARE_STRENGTH = float(_arg("--glare-strength", "0.75"))
GLARE_CARD = float(_arg("--glare-card", "0.9"))  # emission of the glare pass's sheen card
# Shadow: the catcher's opacity × this, then softened.
SHADOW_STRENGTH = float(_arg("--shadow-strength", "0.5"))
SHADOW_FLOOR = 0.02  # catcher opacity below this is dropped (keeps the far tail finite)
SHADOW_PAD = 0.45  # extra canvas around the box for the shadow pass (× long edge)
SHADOW_SCALE = 50  # shadow pass resolution, % (it's soft; the app scales it up)


def set_principled(mat, **vals):
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    for k, v in vals.items():
        if k in bsdf.inputs:
            bsdf.inputs[k].default_value = (*v, 1.0) if k.endswith("Color") and len(v) == 3 else v
    return bsdf


def holdout(mat):
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    hold = nt.nodes.new("ShaderNodeHoldout")
    nt.links.new(hold.outputs[0], out.inputs["Surface"])


def render_materials(b, spec):
    """Physically tuned Cycles materials (the builder only sets base values)."""
    m = b.mats
    # Cover glass over an "off" black panel: near-black, mirror-smooth.
    set_principled(m["FrontGlass"], **{"Base Color": (0.0015, 0.0015, 0.002), "Roughness": 0.012,
                                       "IOR": 1.52, "Specular IOR Level": 0.5, "Coat Weight": 0.0})
    set_principled(m["Gasket"], **{"Base Color": (0.004, 0.004, 0.005), "Roughness": 0.5})
    # The island/punch hole: deep black under the cover glass.
    set_principled(m["Cutout"], **{"Base Color": (0.0, 0.0, 0.0), "Roughness": 0.2,
                                   "Specular IOR Level": 0.15, "Coat Weight": 0.0})
    set_principled(m["FrontLens"], **{"Base Color": (0.002, 0.003, 0.006), "Roughness": 0.06,
                                      "Specular IOR Level": 0.35})
    set_principled(m["Lens"], **{"Base Color": (0.002, 0.002, 0.004), "Roughness": 0.02,
                                 "Coat Weight": 1.0, "Thin Film Thickness": 380.0, "Thin Film IOR": 1.38})
    set_principled(m["LensRing"], **{"Base Color": (0.5, 0.5, 0.52), "Metallic": 1.0, "Roughness": 0.14})
    # The screen: a holdout = fully transparent, anti-aliased hole.
    holdout(m["Screen"])
    # For the glare pass: the screen as glossy black cover glass (an "off"
    # panel), so all it shows is what the glass reflects.
    g = bpy.data.materials.new("GlareGlass")
    g.use_nodes = True
    set_principled(g, **{"Base Color": (0.0, 0.0, 0.0), "Roughness": 0.03, "IOR": 1.52,
                         "Specular IOR Level": 0.5})
    m["GlareGlass"] = g


def apply_finish(b, spec, finish):
    """Frame, buttons and back panel take the finish's colours/materials."""
    _, frame_hex, back_hex = finish
    m = b.mats
    metal = METALS[spec["metal"]]
    fc = tuple(c ** metal["lift"] for c in srgb_to_linear(frame_hex))
    for name, dr in (("Frame", 0.0), ("Button", -0.03)):
        set_principled(m[name], **{"Base Color": fc, "Metallic": 1.0, "Roughness": metal["rough"] + dr,
                                   "Anisotropic": metal["aniso"] if name == "Frame" else 0.0,
                                   "Coat Weight": metal["coat"], "Coat Roughness": metal["coat_rough"]})
    bk = BACKS[spec["back_mat"]]
    bc = srgb_to_linear(back_hex)
    if bk["metallic"]:
        bc = tuple(c ** metal["lift"] for c in bc)
    set_principled(m["BackGlass"], **{"Base Color": bc, "Metallic": bk["metallic"], "Roughness": bk["rough"],
                                      "Specular IOR Level": 0.5, "Coat Weight": bk["coat"],
                                      "Coat Roughness": 0.25})


def softbox(scene, name, size, loc, strength, color=(1, 1, 1), soft=0.45):
    """An emissive card, invisible to the camera, seen only in reflections.
    Bright flat core with a soft falloff toward its edges, like a diffused
    studio softbox — the source of the graded highlight bands on metal."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    uv = bm.loops.layers.uv.new()
    for f in bm.faces:
        for lp in f.loops:
            lp[uv].uv = (lp.vert.co.x + 0.5, lp.vert.co.y + 0.5)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.scale = (size[0], size[1], 1)
    ob.location = loc
    d = Vector((0, 0, 0)) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("Z", "Y").to_euler()  # +Z faces the device
    ob.visible_camera = False
    ob.visible_shadow = False
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["UV"], sep.inputs[0])

    # falloff = smoothstep over each axis → soft-edged rectangle
    def edge(axis):
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.interpolation_type = "SMOOTHERSTEP"
        mr.inputs["From Min"].default_value = 0.0
        mr.inputs["From Max"].default_value = soft
        nt.links.new(sep.outputs[axis], mr.inputs["Value"])
        inv = nt.nodes.new("ShaderNodeMath")
        inv.operation = "SUBTRACT"
        inv.inputs[0].default_value = 1.0
        nt.links.new(sep.outputs[axis], inv.inputs[1])
        mr2 = nt.nodes.new("ShaderNodeMapRange")
        mr2.interpolation_type = "SMOOTHERSTEP"
        mr2.inputs["From Min"].default_value = 0.0
        mr2.inputs["From Max"].default_value = soft
        nt.links.new(inv.outputs[0], mr2.inputs["Value"])
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        nt.links.new(mr.outputs[0], mul.inputs[0])
        nt.links.new(mr2.outputs[0], mul.inputs[1])
        return mul

    ex, ey = edge(0), edge(1)
    f = nt.nodes.new("ShaderNodeMath")
    f.operation = "MULTIPLY"
    nt.links.new(ex.outputs[0], f.inputs[0])
    nt.links.new(ey.outputs[0], f.inputs[1])
    s = nt.nodes.new("ShaderNodeMath")
    s.operation = "MULTIPLY"
    s.inputs[1].default_value = strength
    nt.links.new(f.outputs[0], s.inputs[0])
    nt.links.new(s.outputs[0], em.inputs["Strength"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    me.materials.append(mat)
    scene.collection.objects.link(ob)
    return ob


def setup_studio(scene, L):
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type == "METAL"
        scene.cycles.device = "GPU"
    except Exception:
        scene.cycles.device = "CPU"
    scene.cycles.samples = SAMPLES
    scene.cycles.adaptive_threshold = 0.006
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.max_bounces = 12
    scene.cycles.glossy_bounces = 8
    scene.cycles.transmission_bounces = 8
    scene.cycles.blur_glossy = 0.5
    scene.cycles.sample_clamp_indirect = 8.0
    scene.render.film_transparent = True
    scene.render.filter_size = 1.2
    scene.render.use_persistent_data = True
    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    scene.view_settings.exposure = float(_arg("--exposure", "0.0"))

    # Dark studio: a faint top-lit gradient so dark surfaces never go dead flat.
    world = bpy.data.worlds.new("studio")
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes["Background"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -1
    mr.inputs["From Max"].default_value = 1
    nt.links.new(sep.outputs[2], mr.inputs["Value"])
    nt.links.new(mr.outputs[0], ramp.inputs["Fac"])
    ramp.color_ramp.elements[0].color = (0.01, 0.01, 0.012, 1)
    ramp.color_ramp.elements[1].color = (0.16, 0.165, 0.18, 1)
    ramp.color_ramp.elements.new(0.5).color = (0.035, 0.036, 0.04, 1)
    nt.links.new(ramp.outputs[0], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0
    scene.world = world

    # Lights. Camera is at -Y looking +Y; +Z is up; the screen faces -Y.
    # Mirror geometry: at ±26° yaw a side rail reflects what is BEHIND and to
    # that side of the device, so the rail strips sit back there; the front
    # glass reflects front-left/up, where the key softbox sits.
    boxes = [
        softbox(scene, "Key", (2.4 * L, 1.6 * L), (-2.0 * L, -2.0 * L, 1.9 * L), 6.0),
        softbox(scene, "StripR", (0.45 * L, 2.8 * L), (2.1 * L, 1.5 * L, 0.3 * L), 11.0, soft=0.28),
        softbox(scene, "StripL", (0.45 * L, 2.8 * L), (-2.1 * L, 1.5 * L, 0.3 * L), 8.0, soft=0.28),
        softbox(scene, "SideR", (1.2 * L, 2.4 * L), (2.6 * L, -0.6 * L, 0.6 * L), 4.0),
        softbox(scene, "SideL", (1.2 * L, 2.4 * L), (-2.6 * L, -0.6 * L, 0.6 * L), 3.0),
        # Overhead strip → highlight along the top edge / camera bump.
        softbox(scene, "Top", (2.6 * L, 0.5 * L), (0.0, 0.4 * L, 2.7 * L), 12.0, soft=0.3),
        # Low front fill so the near rail doesn't fall to black.
        softbox(scene, "Fill", (2.8 * L, 0.9 * L), (0.4 * L, -2.6 * L, -1.6 * L), 2.5),
        # Back rim for steep angles / the camera module.
        softbox(scene, "Rim", (1.2 * L, 2.6 * L), (-1.0 * L, 2.6 * L, 1.0 * L), 8.0, soft=0.35),
    ]
    return world, boxes


def setup_shadow_rig(scene, L):
    """Shadow pass: a camera-facing shadow-catcher backdrop just behind the
    device, lit by one big soft key from the front and above (so the shadow
    falls a little down and to the right) plus soft ambient for contact."""
    me = bpy.data.meshes.new("Backdrop")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    bm.to_mesh(me)
    bm.free()
    plane = bpy.data.objects.new("Backdrop", me)
    plane.scale = (40 * L, 40 * L, 1)
    plane.rotation_euler = (math.radians(90), 0, 0)  # normal +Z → -Y (faces the camera)
    plane.is_shadow_catcher = True
    mat = bpy.data.materials.new("Backdrop")
    mat.use_nodes = True
    set_principled(mat, **{"Base Color": (0.8, 0.8, 0.8), "Roughness": 1.0, "Specular IOR Level": 0.0})
    me.materials.append(mat)
    scene.collection.objects.link(plane)

    ld = bpy.data.lights.new("ShadowKey", "AREA")
    ld.shape = "DISK"
    ld.size = 4.0 * L
    ld.energy = 2000.0 * L * L
    light = bpy.data.objects.new("ShadowKey", ld)
    light.location = (-0.4 * L, -4.2 * L, 2.0 * L)
    light.rotation_euler = (Vector((0, 0, 0)) - light.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(light)

    w = bpy.data.worlds.new("shadow_ambient")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.12
    return plane, light, w


def setup_glare_card(scene, L, strength):
    """Glare pass only: a big soft card between the camera and the device,
    invisible to the camera, that the screen glass reflects — a studio
    "window" whose emission fades from the upper-left toward the centre, so
    the glass shows a gentle diagonal sheen (Fresnel does the rest: stronger
    at grazing angles). It sits close to the device so even the front-on
    orthographic view picks up a spatial gradient, not a flat tint."""
    me = bpy.data.meshes.new("GlareCard")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("GlareCard", me)
    ob.scale = (4.0 * L, 4.0 * L, 1)
    ob.location = (0, -0.9 * L, 0)
    ob.rotation_euler = (math.radians(-90), 0, 0)  # normal +Z → +Y (faces the device)
    ob.visible_camera = False
    ob.visible_shadow = False
    ob.visible_diffuse = False
    mat = bpy.data.materials.new("GlareCard")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    # local x = world x, local y = -world z; (-x - y) grows toward upper-left
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "ADD"
    nt.links.new(sep.outputs[0], add.inputs[0])
    nt.links.new(sep.outputs[1], add.inputs[1])
    # a soft diagonal band (rise × fall), not a ramp: past the band the glass
    # goes back to reflecting the dark studio, so no angle gets a flat wash
    def ramp(a, b_):
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.interpolation_type = "SMOOTHERSTEP"
        mr.inputs["From Min"].default_value = a
        mr.inputs["From Max"].default_value = b_
        nt.links.new(add.outputs[0], mr.inputs["Value"])
        return mr
    rise, fall = ramp(-0.04, -0.2), ramp(-0.5, -0.26)
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    nt.links.new(rise.outputs[0], mul.inputs[0])
    nt.links.new(fall.outputs[0], mul.inputs[1])
    k = nt.nodes.new("ShaderNodeMath")
    k.operation = "MULTIPLY"
    k.inputs[1].default_value = strength
    nt.links.new(mul.outputs[0], k.inputs[0])
    nt.links.new(k.outputs[0], em.inputs["Strength"])
    em.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1)
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    me.materials.append(mat)
    scene.collection.objects.link(ob)
    ob.hide_render = True
    return ob


def world_verts(objs):
    pts = []
    for ob in objs:
        mw = ob.matrix_world
        pts.extend(mw @ v.co for v in ob.data.vertices)
    return pts


# ── image helpers (numpy; Blender pixel rows run bottom-up) ──────────────────


def render_exr(scene, path):
    s = scene.render.image_settings
    s.file_format = "OPEN_EXR"
    s.color_mode = "RGBA"
    s.color_depth = "32"
    s.exr_codec = "ZIP"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    w, h = img.size
    a = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    os.remove(path)
    return a.reshape(h, w, 4)


def save_webp(path, rgba, quality=90):
    """rgba: (h, w, 4) float, straight alpha, display-referred, rows bottom-up."""
    h, w, _ = rgba.shape
    img = bpy.data.images.new("out", w, h, alpha=True)
    img.pixels.foreach_set(np.clip(rgba, 0, 1).astype(np.float32).ravel())
    img.file_format = "WEBP"
    img.filepath_raw = path
    img.save(quality=quality)
    bpy.data.images.remove(img)


def srgb_encode(x):
    x = np.clip(x, 0, None)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def blur(a, r):
    """Separable box blur ×3 (≈ gaussian) of a 2-D array, radius r px."""
    if r < 1:
        return a
    k = 2 * r + 1
    for _ in range(3):
        for ax in (0, 1):
            p = np.pad(a, [(r, r) if i == ax else (0, 0) for i in range(2)], mode="edge")
            c = np.cumsum(p, axis=ax, dtype=np.float64)
            c = np.concatenate([np.zeros_like(np.take(c, [0], axis=ax)), c], axis=ax)
            a = ((np.take(c, range(k, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax] - k), axis=ax)) / k).astype(np.float32)
    return a


def glare_layer(px):
    """Linear render of the screen-as-black-glass → screen-blend glare RGBA."""
    cov = px[..., 3]
    R = px[..., :3] / np.maximum(cov, 1e-4)[..., None]  # EXR is premultiplied
    g = 1.0 - np.exp(-R * GLARE_GAIN)
    v = srgb_encode(g) * GLARE_STRENGTH
    vmax = v.max(-1)
    out = np.zeros_like(px)
    out[..., :3] = v / np.maximum(vmax, 1e-5)[..., None]
    out[..., 3] = np.clip(vmax, 0, 1) * np.clip(cov, 0, 1)
    return out


# ── the render loop ──────────────────────────────────────────────────────────


def render_all(model_id, b, out_dir, manifest, angles, orients):
    from bpy_extras.object_utils import world_to_camera_view

    spec = SPECS[model_id]
    finishes = {k: v for k, v in FINISHES[model_id].items() if not ONLY_FINISHES or k in ONLY_FINISHES.split(",")}
    scene = bpy.context.scene
    H = 1.0 / spec["aspect"]
    L = max(1.0, H)
    studio, boxes = setup_studio(scene, L)
    plane, shadow_light, shadow_world = setup_shadow_rig(scene, L)
    card = setup_glare_card(scene, L, GLARE_CARD)
    render_materials(b, spec)
    os.makedirs(TMP_DIR, exist_ok=True)

    pitch_e = bpy.data.objects.new("pivot", None)  # yaw first, then pitch
    pitch_e.rotation_mode = "ZXY"
    scene.collection.objects.link(pitch_e)
    lay_e = bpy.data.objects.new("lay", None)  # landscape: laid 90° CCW
    lay_e.parent = pitch_e
    scene.collection.objects.link(lay_e)
    for ob in b.objects:
        ob.parent = lay_e
    for ob in b.objects:
        # The fold's crease is near-invisible on the real thing; drawn as a
        # solid line over the screenshot it would read as a defect.
        if ob.name == "Crease":
            ob.hide_render = True
    device = [ob for ob in b.objects if not ob.hide_render]
    screen = next(ob for ob in b.objects if ob.name == "Screen")
    sv = [v.co for v in screen.data.vertices]
    x0, x1 = min(v.x for v in sv), max(v.x for v in sv)
    z0, z1 = min(v.z for v in sv), max(v.z for v in sv)
    ys = sv[0].y
    portrait_corners = [Vector((x0, ys, z1)), Vector((x1, ys, z1)), Vector((x1, ys, z0)), Vector((x0, ys, z0))]
    screen_r = float(screen["corner_radius"])

    cam_d = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.rotation_euler = (math.radians(90), 0, 0)
    cam_d.sensor_fit = "VERTICAL"

    def pass_device():
        scene.world = studio
        for ob in device:
            ob.visible_camera = True
        for bx in boxes:
            bx.hide_render = False
        plane.hide_render = True
        shadow_light.hide_render = True
        card.hide_render = True
        screen.data.materials[0] = b.mats["Screen"]
        scene.cycles.samples = SAMPLES
        scene.cycles.use_denoising = True

    def pass_glare():
        pass_device()
        for ob in device:
            ob.visible_camera = ob is screen
        screen.data.materials[0] = b.mats["GlareGlass"]
        card.hide_render = False
        scene.cycles.samples = max(64, SAMPLES // 2)

    def pass_shadow():
        scene.world = shadow_world
        for ob in device:
            ob.visible_camera = False
        for bx in boxes:
            bx.hide_render = True
        plane.hide_render = False
        shadow_light.hide_render = False
        screen.data.materials[0] = b.mats["Screen"]
        scene.cycles.samples = 48
        scene.cycles.use_denoising = False  # only its alpha is used (blurred)

    base_w = RENDER_WIDTH.get(model_id, RENDER_WIDTH_DEFAULT)
    for orient in orients:
        land = orient == "landscape"
        lay_e.rotation_euler = (0, math.radians(-90) if land else 0, 0)
        pw, ph = base_w, round(base_w / spec["aspect"])
        rw, rh = (ph, pw) if land else (pw, ph)
        box_aspect = rw / rh
        for (yaw, pitch) in angles:
            pitch_e.rotation_euler = (math.radians(pitch), 0, math.radians(yaw))
            bpy.context.view_layer.update()
            pts = world_verts(device)
            if yaw == 0 and pitch == 0:
                ex = max(abs(p.x) for p in pts)
                ez = max(abs(p.z) for p in pts)
                cam_d.type = "ORTHO"
                ortho = 2 * max(ez, ex / box_aspect)
                cam_d.ortho_scale = ortho
                cam.location = (0, -10, 0)
                cam_d.clip_end = 30
            else:
                cam_d.type = "PERSP"
                cam_d.angle_y = math.radians(FOV)
                tanV = math.tan(math.radians(FOV) / 2)
                tanH = tanV * box_aspect
                dist = (H if not land else 1.0) * MARGIN / 2 / tanV
                for p in pts:
                    dist = max(dist, -p.y + abs(p.z) * MARGIN / tanV, -p.y + abs(p.x) * MARGIN / tanH)
                cam.location = (0, -dist, 0)
                cam_d.clip_end = dist + 60 * L
            scene.render.resolution_x, scene.render.resolution_y = rw, rh
            scene.render.resolution_percentage = 100
            bpy.context.view_layer.update()

            key = f"{model_id}/{orient}/{yaw}_{pitch}"
            tag = f"{orient}-{yaw}_{pitch}"
            entry = manifest["renders"].get(key, {})
            files = dict(entry.get("files", {})) if ONLY_FINISHES else {}

            # Is the screen facing the camera?
            mw = screen.matrix_world
            n = (mw.to_3x3() @ Vector((0, -1, 0))).normalized()
            centre = mw @ Vector(((x0 + x1) / 2, ys, (z0 + z1) / 2))
            if n.dot(cam.location - centre) <= 0:
                raise SystemExit(f"[devices] {key}: screen faces away — ANGLES must be screen-side views")

            # ── the device, once per finish ──
            pass_device()
            s = scene.render.image_settings
            s.file_format = "WEBP"
            s.color_mode = "RGBA"
            s.quality = 90
            for fid, fin in finishes.items():
                apply_finish(b, spec, fin)
                fname = f"{model_id}-{fid}-{tag}.webp"
                scene.render.filepath = os.path.join(out_dir, fname)
                t0 = time.time()
                bpy.ops.render.render(write_still=True)
                print(f"[devices] {key} {fid} in {time.time() - t0:.1f}s")
                files[fid] = fname

            # ── glare: the screen as black cover glass, all else hidden ──
            glare = entry.get("glare") if (ONLY_FINISHES or not DO_GLARE) else None
            if DO_GLARE:
                pass_glare()
                t0 = time.time()
                px = render_exr(scene, os.path.join(TMP_DIR, "glare.exr"))
                glare = f"{model_id}-glare-{tag}.webp"
                save_webp(os.path.join(out_dir, glare), glare_layer(px), quality=92)
                print(f"[devices] {key} glare in {time.time() - t0:.1f}s")

            # ── shadow: catcher backdrop just behind the device ──
            shadow = entry.get("shadow") if (ONLY_FINISHES or not DO_SHADOW) else None
            if DO_SHADOW:
                pass_shadow()
                far = max(p.y for p in pts)
                plane.location = (0, far + 0.05 * L, 0)
                pad = int(round(SHADOW_PAD * max(rw, rh) / 2)) * 2
                sw_, sh_ = rw + 2 * pad, rh + 2 * pad
                k = sh_ / rh
                if cam_d.type == "ORTHO":
                    cam_d.ortho_scale = ortho * k
                else:
                    cam_d.angle_y = 2 * math.atan(math.tan(math.radians(FOV) / 2) * k)
                scene.render.resolution_x, scene.render.resolution_y = sw_, sh_
                scene.render.resolution_percentage = SHADOW_SCALE
                bpy.context.view_layer.update()
                t0 = time.time()
                px = render_exr(scene, os.path.join(TMP_DIR, "shadow.exr"))
                oh, ow = px.shape[:2]
                a = np.clip((px[..., 3] - SHADOW_FLOOR) / (1 - SHADOW_FLOOR), 0, 1)
                a = blur(a, max(1, round(ow / 400))) * SHADOW_STRENGTH
                ys_, xs_ = np.where(a > 1.5 / 255)
                m = 3
                r0, r1 = max(0, ys_.min() - m), min(oh, ys_.max() + m + 1)
                c0, c1 = max(0, xs_.min() - m), min(ow, xs_.max() + m + 1)
                crop = a[r0:r1, c0:c1]
                out = np.zeros(crop.shape + (4,), np.float32)
                out[..., 3] = crop
                sfile = f"{model_id}-shadow-{tag}.webp"
                save_webp(os.path.join(out_dir, sfile), out, quality=85)
                sx, sy = sw_ / ow, sh_ / oh  # shadow px → render px
                # rows are bottom-up: image top = oh - r1
                shadow = {"file": sfile, "x": round(c0 * sx - pad, 2), "y": round((oh - r1) * sy - pad, 2),
                          "w": round((c1 - c0) * sx, 2), "h": round((r1 - r0) * sy, 2)}
                if r0 == 0 or c0 == 0 or r1 == oh or c1 == ow:
                    print(f"[devices] WARNING {key} shadow touches the canvas edge")
                print(f"[devices] {key} shadow in {time.time() - t0:.1f}s")
                pass_device()

            # screen corners in render px
            corners = [portrait_corners[i] for i in ((1, 2, 3, 0) if land else (0, 1, 2, 3))]
            # (the shadow pass may have widened the camera; restore it)
            scene.render.resolution_x, scene.render.resolution_y = rw, rh
            scene.render.resolution_percentage = 100
            if cam_d.type == "ORTHO":
                cam_d.ortho_scale = ortho
            else:
                cam_d.angle_y = math.radians(FOV)
            bpy.context.view_layer.update()
            corners_px = []
            for c in corners:
                v = world_to_camera_view(scene, cam, screen.matrix_world @ c)
                corners_px.append([round(v.x * rw, 3), round((1 - v.y) * rh, 3)])
            sw_img = (z1 - z0) if land else (x1 - x0)
            e = {
                "w": rw, "h": rh, "corners": corners_px,
                # screen corner: extent as a fraction of the screen's width (image
                # orientation) and superellipse exponent (2 = circular arc; 4 =
                # Apple's continuous-curvature corner, see rrect_pts)
                "radius": round(screen_r * (1.3 if spec.get("squircle") else 1.0) / sw_img, 5),
                "n": 4 if spec.get("squircle") else 2,
                "files": {f: files[f] for f in FINISHES[model_id] if f in files},
            }
            if glare:
                e["glare"] = glare
            if shadow:
                e["shadow"] = shadow
            manifest["renders"][key] = e
            print(f"[devices] rendered {key}")


def write_manifest(manifest):
    out = {
        "version": 2,
        "models": {m: manifest["models"][m] for m in sorted(manifest["models"])},
        "renders": {k: manifest["renders"][k] for k in sorted(manifest["renders"])},
    }
    with open(MANIFEST, "w") as fh:
        json.dump(out, fh, indent=1)
        fh.write("\n")


def main():
    ids = ONLY.split(",") if ONLY else list(SPECS)
    angles = ANGLES
    if _arg("--angles"):
        angles = [tuple(int(x) for x in a.split("_")) for a in _arg("--angles").split(",")]
    orients = _arg("--orient", "portrait,landscape").split(",")
    os.makedirs(RENDER_DIR, exist_ok=True)
    manifest = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
    if manifest.get("version") != 2:
        manifest = {"version": 2, "models": {}, "renders": {}}
    t_all = time.time()
    for model_id in ids:
        reset_scene()
        b = build(model_id, SPECS[model_id])
        manifest["models"][model_id] = {"finishes": {k: v[0] for k, v in FINISHES[model_id].items()}}
        render_all(model_id, b, RENDER_DIR, manifest, angles, orients)
        write_manifest(manifest)
    try:
        os.rmdir(TMP_DIR)
    except OSError:
        pass
    print(f"[devices] done in {time.time() - t_all:.0f}s")


main()
