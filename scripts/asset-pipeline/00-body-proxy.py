"""
Afrodita asset pipeline - Step 00: low-poly rigged body proxy.

Builds a low-poly humanoid mannequin from capsule primitives placed on the
canonical 19-bone template (the same joint fractions used for garment rigging),
weights it with the deterministic distance-based skinning and exports a GLB.

This proxy is used at runtime to visualize the body contour and (later) as an
occlusion mesh. It shares the exact skeleton contract with garments.

Usage:
  blender --background --python 00-body-proxy.py -- \
      --out public/models/body-proxy-v2.glb \
      [--height 1.75] \
      [--template /path/to/skeleton-template.json]
"""

import bpy
import importlib.util
import sys
from pathlib import Path
from mathutils import Vector


def load_rig_module():
    """Reuse build_armature / bind / export from 02-rig.py."""
    path = Path(__file__).resolve().parent / "02-rig.py"
    spec = importlib.util.spec_from_file_location("vto_rig", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


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


def log(message: str) -> None:
    print(f"[body-proxy] {message}", flush=True)


# Capsule radius per bone, in meters for a ~1.75 m person.
CAPSULE_RADII = {
    "hips": 0.11,
    "spine": 0.12,
    "chest": 0.13,
    "neck": 0.055,
    "head": 0.1,
    "shoulder.L": 0.05,
    "upper_arm.L": 0.052,
    "forearm.L": 0.045,
    "hand.L": 0.038,
    "shoulder.R": 0.05,
    "upper_arm.R": 0.052,
    "forearm.R": 0.045,
    "hand.R": 0.038,
    "thigh.L": 0.085,
    "shin.L": 0.065,
    "foot.L": 0.05,
    "thigh.R": 0.085,
    "shin.R": 0.065,
    "foot.R": 0.05,
}

REFERENCE_HEIGHT = 1.75
CYLINDER_SEGMENTS = 12


def add_capsule(a: Vector, b: Vector, radius: float) -> list[bpy.types.Object]:
    direction = b - a
    length = direction.length
    if length < 1e-4:
        return []

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=CYLINDER_SEGMENTS,
        radius=radius,
        depth=length,
        location=tuple((a + b) * 0.5),
    )
    cylinder = bpy.context.active_object
    cylinder.rotation_mode = "QUATERNION"
    cylinder.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(
        direction.normalized()
    )

    objects = [cylinder]
    for point in (a, b):
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=CYLINDER_SEGMENTS,
            ring_count=max(6, CYLINDER_SEGMENTS // 2),
            radius=radius,
            location=tuple(point),
        )
        objects.append(bpy.context.active_object)
    return objects


def decimate_mesh(obj: bpy.types.Object, target_tris: int) -> None:
    """Collapse-decimate after voxel remesh; Blender's ratio is approximate."""
    for attempt in range(3):
        obj.data.calc_loop_triangles()
        current = len(obj.data.loop_triangles)
        if current <= target_tris:
            return
        ratio = max(0.01, target_tris / current)
        modifier = obj.modifiers.new(name=f"BodyProxy_Decimate_{attempt}", type="DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)


def main() -> None:
    args = parse_args()
    output_path = args.get("out")
    height = float(args.get("height", str(REFERENCE_HEIGHT)))

    script_dir = Path(__file__).resolve().parent
    default_template = (
        script_dir / ".." / ".." / "src" / "lib" / "vto" / "skeleton-template.json"
    ).resolve()
    template_path = args.get("template", str(default_template))

    if not output_path:
        raise SystemExit("Usage: --out public/models/body-proxy-v2.glb [--height 1.75]")

    rig = load_rig_module()
    template = rig.load_template(template_path)

    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Synthetic bounds consistent with 02-rig's body_to_world mapping:
    # z spans [0, height] (feet at 0, head top at height); x centered.
    min_v = Vector((-0.3, -0.15, 0.0))
    max_v = Vector((0.3, 0.15, height))
    scale_z = height
    scale_x = height
    coverage_top = 0.0

    radius_scale = height / REFERENCE_HEIGHT
    objects: list[bpy.types.Object] = []

    for bone in template["bones"]:
        from_point = rig.body_to_world(
            bone["from"], scale_z, scale_x, coverage_top, min_v, max_v
        )
        to_point = rig.body_to_world(
            bone["to"], scale_z, scale_x, coverage_top, min_v, max_v
        )
        radius = CAPSULE_RADII.get(bone["name"], 0.05) * radius_scale
        objects.extend(add_capsule(from_point, to_point, radius))

    if not objects:
        raise SystemExit("No geometry generated")

    for obj in bpy.context.scene.objects:
        obj.select_set(obj in objects)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()

    mesh_obj = bpy.context.view_layer.objects.active
    mesh_obj.name = "BodyProxy"

    # Fuse intersecting capsules into a single continuous body surface.
    # Without voxel remesh this is only a pile of separate cylinders/spheres.
    bpy.context.view_layer.objects.active = mesh_obj
    mesh_obj.data.remesh_voxel_size = 0.035 * radius_scale
    bpy.ops.object.voxel_remesh()

    # Light smoothing removes the hard intersections between primitive parts.
    smooth_mod = mesh_obj.modifiers.new(name="BodyProxy_Smooth", type="SMOOTH")
    smooth_mod.factor = 0.65
    smooth_mod.iterations = 3
    bpy.ops.object.modifier_apply(modifier=smooth_mod.name)

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.0005)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    decimate_mesh(mesh_obj, 6000)
    bpy.ops.object.shade_smooth()

    mesh = mesh_obj.data
    mesh.calc_loop_triangles()
    log(f"mesh: {len(mesh.loop_triangles)} tris, {len(mesh.vertices)} verts")

    arm_obj = rig.build_armature(template, scale_z, scale_x, coverage_top, min_v, max_v)
    rig.bind_mesh(mesh_obj, arm_obj, smooth=1)

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    rig.export(output_path)
    log(f"done -> {output_path}")


if __name__ == "__main__":
    main()
