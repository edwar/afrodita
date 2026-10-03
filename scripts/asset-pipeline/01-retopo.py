"""
Afrodita asset pipeline - Step 01: cleanup + retopology + UV for a raw
image-to-3D garment GLB (Tripo/Meshy output).

Usage:
  blender --background --python 01-retopo.py -- \
      --in  raw.glb \
      --out retopo.glb \
      [--category camisa] \
      [--tris 12000] \
      [--weld 0.0005]

What it does:
  1. Imports the GLB, joins meshes, applies transforms.
  2. Cleans geometry: weld doubles, delete loose verts/edges, recalc normals.
  3. Decimates to the target triangle budget (planar collapse, silhouette-first).
  4. Smart UV unwraps with a small island margin.
  5. Centers the bounding box at the origin (runtime normalizes further).
  6. Exports a GLB ready for step 02 (rigging).
"""

import bpy
import sys
import math
from mathutils import Vector


def parse_args() -> dict:
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    args = {}
    i = 0
    while i < len(argv):
        if argv[i].startswith("--"):
            key = argv[i][2:]
            value = argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith("--") else "true"
            args[key] = value
            i += 2
        else:
            i += 1
    return args


def log(msg: str) -> None:
    print(f"[retopo] {msg}", flush=True)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def join_meshes() -> bpy.types.Object:
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        raise RuntimeError("No mesh objects found in input file")

    for obj in bpy.context.scene.objects:
        obj.select_set(obj in meshes)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def cleanup_geometry(obj: bpy.types.Object, weld: float) -> None:
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=weld)
    bpy.ops.mesh.delete_loose()
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")


def orient_garment_front(obj: bpy.types.Object, category: str) -> None:
    """
    Standardize the garment axes before fitting the armature:
      - Blender Z = garment vertical (already handled by the GLB importer)
      - Blender X = wearer left/right (sleeve-to-sleeve)
      - Blender Y = front/back

    Image-to-3D providers may return a shirt facing along X, with its width on
    Y. For torso/leg garments, swap X/Y when Y is clearly the larger horizontal
    dimension. This avoids binding arm bones across the garment's depth axis.
    """
    horizontal_categories = {
        "camisa", "chaqueta", "vestido", "falda", "pantalon", "short",
    }
    if category not in horizontal_categories:
        log(f"orientation: skipped for category '{category or 'unspecified'}'")
        return

    bpy.context.view_layer.update()
    coords = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    dims = Vector((
        max(c.x for c in coords) - min(c.x for c in coords),
        max(c.y for c in coords) - min(c.y for c in coords),
        max(c.z for c in coords) - min(c.z for c in coords),
    ))

    if dims.y > dims.x * 1.15:
        # glTF imports often use QUATERNION mode; writing rotation_euler while
        # that mode is active silently leaves the effective rotation unchanged.
        obj.rotation_mode = "XYZ"
        obj.rotation_euler.z -= math.pi / 2
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        bpy.context.view_layer.update()
        log(
            f"orientation: rotated -90° around Z (x={dims.x:.3f}, y={dims.y:.3f}); "
            "width aligned to X"
        )
    else:
        log(f"orientation: already aligned (x={dims.x:.3f}, y={dims.y:.3f})")


def triangle_count(obj: bpy.types.Object) -> int:
    mesh = obj.data
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def decimate_to_budget(obj: bpy.types.Object, target_tris: int) -> None:
    # Blender's collapse ratio is approximate (~5-20% overshoot); iterate until
    # the target budget is actually met (max 3 passes).
    for attempt in range(3):
        current = triangle_count(obj)
        if current <= target_tris:
            if attempt == 0:
                log(f"decimate: {current} tris already within budget ({target_tris})")
            return

        ratio = max(0.01, target_tris / current)
        log(f"decimate pass {attempt + 1}: {current} -> target {target_tris} (ratio {ratio:.3f})")
        mod = obj.modifiers.new(name=f"VTO_Decimate_{attempt}", type="DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)

    final = triangle_count(obj)
    if final > target_tris:
        log(f"warning: could not reach budget exactly, final {final} tris")


def smart_uv(obj: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")


def center_at_origin(obj: bpy.types.Object) -> None:
    bpy.context.view_layer.update()
    coords = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    min_v = Vector((min(c.x for c in coords), min(c.y for c in coords), min(c.z for c in coords)))
    max_v = Vector((max(c.x for c in coords), max(c.y for c in coords), max(c.z for c in coords)))
    center = (min_v + max_v) / 2.0
    obj.location -= center
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def main() -> None:
    args = parse_args()
    input_path = args.get("in")
    output_path = args.get("out")
    category = args.get("category", "")
    target_tris = int(args.get("tris", "12000"))
    weld = float(args.get("weld", "0.0005"))

    if not input_path or not output_path:
        raise SystemExit("Usage: --in raw.glb --out retopo.glb [--tris 12000] [--weld 0.0005]")

    reset_scene()
    log(f"importing {input_path}")
    bpy.ops.import_scene.gltf(filepath=input_path)

    obj = join_meshes()
    orient_garment_front(obj, category)
    cleanup_geometry(obj, weld)
    decimate_to_budget(obj, target_tris)
    smart_uv(obj)
    center_at_origin(obj)

    final_tris = triangle_count(obj)
    log(f"final: {final_tris} tris, {len(obj.data.vertices)} verts")

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
    )
    log(f"exported {output_path}")


if __name__ == "__main__":
    main()
