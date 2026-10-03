"""
Afrodita asset pipeline - Step 02: canonical 19-bone rig + skinning.

Creates the shared VTO armature (names/hierarchy from
src/lib/vto/skeleton-template.json) fitted to the garment using per-category
human body coverage proportions, parents the mesh with automatic weights and
exports a skinned GLB.

Usage:
  blender --background --python 02-rig.py -- \
      --in  retopo.glb \
      --out rigged.glb \
      --category camisa \
      [--template /path/to/skeleton-template.json] \
      [--smooth 2]

Notes:
  * Accessories (sombrero, bolso, gorro, cinturon, collar, bufanda, gafas,
    reloj) are rigid attachments at runtime: this script skips them and simply
    re-exports the input mesh.
"""

import bpy
import json
import math
import os
import sys
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
    print(f"[rig] {msg}", flush=True)


RIGID_CATEGORIES = {
    "sombrero",
    "gorro",
    "bolso",
    "cinturon",
    "collar",
    "bufanda",
    "gafas",
    "reloj",
}

# Human proportions as fraction of total body height, from head top (0.0) to
# feet (1.0). Arms in A-pose (slightly out and down) because scanned garments
# are photographed with sleeves hanging, not in a T-pose.
JOINT_FRACTIONS = {
    "head_top": (0.0, 0.0),
    "ear_center": (0.0, 0.105),
    "neck_base": (0.0, 0.145),
    "chest_center": (0.0, 0.2),
    "spine_mid": (0.0, 0.335),
    "hip_center": (0.0, 0.47),
    "shoulder_l": (0.115, 0.18),
    "elbow_l": (0.135, 0.33),
    "wrist_l": (0.15, 0.49),
    "index_l": (0.155, 0.58),
    "shoulder_r": (-0.115, 0.18),
    "elbow_r": (-0.135, 0.33),
    "wrist_r": (-0.15, 0.49),
    "index_r": (-0.155, 0.58),
    "hip_l": (0.07, 0.47),
    "hip_r": (-0.07, 0.47),
    "knee_l": (0.075, 0.72),
    "knee_r": (-0.075, 0.72),
    "ankle_l": (0.075, 0.94),
    "ankle_r": (-0.075, 0.94),
    "foot_index_l": (0.075, 1.0),
    "foot_index_r": (-0.075, 1.0),
}

# Fraction of total body height represented by the shoulder half-width joint.
SHOULDER_HALF_FRACTION = 0.115

# Bones allowed to receive weights, per garment category. Scanned garment
# meshes have no concept of body parts, so a naive distance weighting can bind
# a shirt hem to the thigh bones running through it. Restricting the candidate
# set per category keeps weights anatomically plausible.
TORSO_AND_ARMS = {
    "hips", "spine", "chest", "neck", "head",
    "shoulder.L", "upper_arm.L", "forearm.L", "hand.L",
    "shoulder.R", "upper_arm.R", "forearm.R", "hand.R",
}
CATEGORY_ALLOWED_BONES = {
    "camisa": TORSO_AND_ARMS,
    "chaqueta": TORSO_AND_ARMS,
    "vestido": TORSO_AND_ARMS | {"thigh.L", "thigh.R", "shin.L", "shin.R"},
    "falda": {"hips", "spine", "thigh.L", "thigh.R", "shin.L", "shin.R"},
    "pantalon": {
        "hips", "spine",
        "thigh.L", "shin.L", "foot.L",
        "thigh.R", "shin.R", "foot.R",
    },
    "zapato": {"shin.L", "foot.L", "shin.R", "foot.R"},
}

# Per-category body coverage (top, bottom) as body-height fractions.
CATEGORY_COVERAGE = {
    "camisa": (0.18, 0.50),
    "chaqueta": (0.18, 0.52),
    "vestido": (0.18, 0.90),
    "falda": (0.47, 0.88),
    "pantalon": (0.47, 0.96),
    "zapato": (0.94, 1.0),
}
DEFAULT_COVERAGE = (0.18, 0.96)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load_template(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def import_mesh(path: str) -> bpy.types.Object:
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        raise RuntimeError("No mesh found in input")
    for obj in bpy.context.scene.objects:
        obj.select_set(obj in meshes)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def bbox(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    bpy.context.view_layer.update()
    coords = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    min_v = Vector((min(c.x for c in coords), min(c.y for c in coords), min(c.z for c in coords)))
    max_v = Vector((max(c.x for c in coords), max(c.y for c in coords), max(c.z for c in coords)))
    return min_v, max_v


def body_to_world(
    joint_name: str,
    scale_z: float,
    scale_x: float,
    coverage_top: float,
    min_v: Vector,
    max_v: Vector,
) -> Vector:
    x_frac, f_frac = JOINT_FRACTIONS[joint_name]
    center_x = (min_v.x + max_v.x) / 2.0
    center_y = (min_v.y + max_v.y) / 2.0
    # f = coverage_top maps to the garment top; f = coverage_bottom maps below.
    z = max_v.z - (f_frac - coverage_top) * scale_z
    return Vector((center_x + x_frac * scale_x, center_y, z))


def build_armature(
    template: dict,
    scale_z: float,
    scale_x: float,
    coverage_top: float,
    min_v: Vector,
    max_v: Vector,
) -> bpy.types.Object:
    arm_data = bpy.data.armatures.new("VTO_Armature")
    arm_obj = bpy.data.objects.new("VTO_Rig", arm_data)
    bpy.context.scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    arm_obj.select_set(True)

    bpy.ops.object.mode_set(mode="EDIT")
    edit_bones = {}

    for bone_def in template["bones"]:
        name = bone_def["name"]
        bone = arm_data.edit_bones.new(name)
        bone.head = body_to_world(
            bone_def["from"], scale_z, scale_x, coverage_top, min_v, max_v
        )
        bone.tail = body_to_world(
            bone_def["to"], scale_z, scale_x, coverage_top, min_v, max_v
        )
        if (bone.tail - bone.head).length < 1e-4:
            bone.tail = bone.head + Vector((0.0, 0.0, -0.01))
        edit_bones[name] = bone

    for bone_def in template["bones"]:
        parent_name = bone_def["parent"]
        if parent_name:
            edit_bones[bone_def["name"]].parent = edit_bones[parent_name]

    bpy.ops.object.mode_set(mode="OBJECT")
    log(f"armature: {len(edit_bones)} bones, scale_z {scale_z:.4f}, scale_x {scale_x:.4f}")
    return arm_obj


def weight_stats(mesh_obj: bpy.types.Object) -> tuple[int, int, float]:
    total = len(mesh_obj.data.vertices)
    nonzero = 0
    max_weight = 0.0
    for vertex in mesh_obj.data.vertices:
        weight = sum(group.weight for group in vertex.groups)
        if weight > 1e-6:
            nonzero += 1
        max_weight = max(max_weight, weight)
    return total, nonzero, max_weight


def point_segment_distance(p: Vector, a: Vector, b: Vector) -> float:
    ab = b - a
    length_sq = ab.length_squared
    if length_sq < 1e-12:
        return (p - a).length
    t = max(0.0, min(1.0, (p - a).dot(ab) / length_sq))
    return (p - (a + ab * t)).length


def distance_weights(
    mesh_obj: bpy.types.Object,
    arm_obj: bpy.types.Object,
    allowed_bones: set[str] | None = None,
    max_influences: int = 3,
    falloff: float = 1.5,
) -> None:
    """
    Deterministic skinning fallback: inverse-distance weights to the closest
    bone segments. Works on any mesh (no bone-heat solver required).

    `allowed_bones` restricts the candidate set (per category) so garment
    regions are never bound to anatomically unrelated bones.
    """
    for group in list(mesh_obj.vertex_groups):
        mesh_obj.vertex_groups.remove(group)

    segments = []
    for bone in arm_obj.data.bones:
        if not bone.use_deform:
            continue
        if allowed_bones is not None and bone.name not in allowed_bones:
            continue
        segments.append(
            (
                bone.name,
                arm_obj.matrix_world @ bone.head_local,
                arm_obj.matrix_world @ bone.tail_local,
            )
        )

    if not segments:
        raise RuntimeError("distance_weights: no candidate bones after filtering")

    groups = {
        name: mesh_obj.vertex_groups.new(name=name) for name, _, _ in segments
    }

    mw = mesh_obj.matrix_world
    for vertex in mesh_obj.data.vertices:
        p = mw @ vertex.co
        distances = sorted(
            (
                (point_segment_distance(p, a, b), name)
                for name, a, b in segments
            ),
            key=lambda item: item[0],
        )
        chosen = distances[:max_influences]
        weights = [
            (1.0 / (distance + 1e-4) ** falloff, name)
            for distance, name in chosen
        ]
        total = sum(weight for weight, _ in weights)
        for weight, name in weights:
            groups[name].add([vertex.index], weight / total, "REPLACE")


def normalize_weights(mesh_obj: bpy.types.Object) -> None:
    try:
        bpy.context.view_layer.objects.active = mesh_obj
        bpy.ops.object.vertex_group_normalize_all(lock_active=False)
        log("weights normalized")
    except Exception as exc:  # noqa: BLE001 - operator context can fail in background
        log(f"weight normalization skipped: {exc}")


def report_dominant_joints(
    mesh_obj: bpy.types.Object, allowed_bones: set[str] | None
) -> None:
    from collections import Counter

    group_names = {g.index: g.name for g in mesh_obj.vertex_groups}
    counts: Counter[str] = Counter()
    for vertex in mesh_obj.data.vertices:
        best_name = None
        best_weight = -1.0
        for group in vertex.groups:
            if group.weight > best_weight:
                best_weight = group.weight
                best_name = group_names.get(group.group)
        if best_name:
            counts[best_name] += 1

    total = max(1, len(mesh_obj.data.vertices))
    summary = ", ".join(
        f"{name}:{count * 100 // total}%" for name, count in counts.most_common(10)
    )
    log(f"dominant joints: {summary}")
    if allowed_bones is not None:
        disallowed = {n: c for n, c in counts.items() if n not in allowed_bones}
        if disallowed:
            log(f"WARNING: disallowed bones dominate vertices: {disallowed}")


def bind_mesh(
    mesh_obj: bpy.types.Object,
    arm_obj: bpy.types.Object,
    smooth: int,
    allowed_bones: set[str] | None = None,
) -> None:
    for obj in bpy.context.scene.objects:
        obj.select_set(False)
    mesh_obj.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")

    if allowed_bones is not None:
        removed = 0
        for group in list(mesh_obj.vertex_groups):
            if group.name not in allowed_bones:
                mesh_obj.vertex_groups.remove(group)
                removed += 1
        if removed:
            log(f"bind: removed {removed} disallowed bone groups")

    total, nonzero, max_weight = weight_stats(mesh_obj)
    log(
        f"bind: auto weights -> {nonzero}/{total} vertices weighted (max {max_weight:.3f}), "
        f"vertexGroups={len(mesh_obj.vertex_groups)}"
    )

    if nonzero < total * 0.8:
        log("bind: bone heat left most vertices unweighted, using distance-based weights")
        distance_weights(mesh_obj, arm_obj, allowed_bones=allowed_bones)
        total, nonzero, max_weight = weight_stats(mesh_obj)
        log(
            f"bind: distance weights -> {nonzero}/{total} vertices weighted (max {max_weight:.3f})"
        )

    normalize_weights(mesh_obj)

    modifiers = [m.type for m in mesh_obj.modifiers]
    if "ARMATURE" not in modifiers:
        mesh_obj.modifiers.new(name="VTO_Armature", type="ARMATURE").object = arm_obj
        log("bind: re-created missing Armature modifier")

    if smooth > 0:
        try:
            bpy.context.view_layer.objects.active = mesh_obj
            mesh_obj.select_set(True)
            arm_obj.select_set(False)
            bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
            bpy.ops.object.vertex_group_smooth(
                group_select_mode="ALL", factor=0.5, repeat=smooth
            )
            bpy.ops.object.mode_set(mode="OBJECT")
            log(f"weights smoothed ({smooth} iterations)")
            normalize_weights(mesh_obj)
        except Exception as exc:  # noqa: BLE001 - operator context can fail in background
            log(f"weight smoothing skipped: {exc}")
            if bpy.context.object and bpy.context.object.mode != "OBJECT":
                bpy.ops.object.mode_set(mode="OBJECT")

    report_dominant_joints(mesh_obj, allowed_bones)


def export(path: str) -> None:
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_apply=False,
        export_skins=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
    )
    log(f"exported {path}")


def main() -> None:
    args = parse_args()
    input_path = args.get("in")
    output_path = args.get("out")
    category = args.get("category", "camisa")
    smooth = int(args.get("smooth", "2"))

    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_template = os.path.normpath(
        os.path.join(script_dir, "..", "..", "src", "lib", "vto", "skeleton-template.json")
    )
    template_path = args.get("template", default_template)

    if not input_path or not output_path:
        raise SystemExit(
            "Usage: --in retopo.glb --out rigged.glb --category camisa [--template path]"
        )

    reset_scene()

    if category in RIGID_CATEGORIES:
        log(f"category '{category}' is a rigid attachment: passing through without rig")
        import_mesh(input_path)
        export(output_path)
        return

    template = load_template(template_path)
    if template.get("version") != "vto-skeleton-v1":
        raise SystemExit(f"Unexpected skeleton template version: {template.get('version')}")

    mesh_obj = import_mesh(input_path)
    min_v, max_v = bbox(mesh_obj)
    dims = max_v - min_v
    log(f"bbox (Z-up): x={dims.x:.3f} y={dims.y:.3f} z={dims.z:.3f}")
    garment_h = max_v.z - min_v.z
    if garment_h <= 0:
        raise SystemExit("Garment bounding box has zero height")

    coverage_top, coverage_bottom = CATEGORY_COVERAGE.get(category, DEFAULT_COVERAGE)
    scale_z = garment_h / (coverage_bottom - coverage_top)

    # Fit the skeleton horizontally to the garment: torso/shoulders should sit
    # inside the mesh. Garment bbox includes hanging sleeves, so the shoulder
    # half-width maps to ~75% of the half width; never wider than proportional.
    shoulder_half = max(dims.x, 1e-4) / 2.0 * 0.75
    scale_x = min(scale_z, shoulder_half / SHOULDER_HALF_FRACTION)

    log(
        f"category '{category}': coverage {coverage_top:.2f}-{coverage_bottom:.2f}, "
        f"garment height {garment_h:.4f}, scale_z {scale_z:.4f}, scale_x {scale_x:.4f}"
    )

    arm_obj = build_armature(template, scale_z, scale_x, coverage_top, min_v, max_v)
    allowed_bones = CATEGORY_ALLOWED_BONES.get(category)
    if allowed_bones is not None:
        log(f"allowed bones for '{category}': {len(allowed_bones)} of {len(template['bones'])}")
    bind_mesh(mesh_obj, arm_obj, smooth, allowed_bones=allowed_bones)
    export(output_path)


if __name__ == "__main__":
    main()
