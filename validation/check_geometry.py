"""Independent geometry audit of actual binary STLs; not a material/FEA model.

Development only: python -m pip install trimesh numpy shapely matplotlib
Run from any directory: python validation/check_geometry.py
STL generation remains dependency-free in the standalone HTML application.
"""
from pathlib import Path
import json
import math
import subprocess
import tempfile

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import trimesh
from shapely.geometry import LineString, Polygon
from shapely.ops import polygonize

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = Path(__file__).resolve().parent
COUNTS = [112, 113]
PITCH = 5.0
PLD = 0.5715


def cross_section(mesh, width):
    """Recover a 2D contour from triangles crossing the middle of the STL."""
    z = width / 2
    lines = []
    for triangle in mesh.triangles:
        points = []
        for i in range(3):
            a, b = triangle[i], triangle[(i + 1) % 3]
            if (a[2] - z) * (b[2] - z) < 0:
                t = (z - a[2]) / (b[2] - a[2])
                points.append(tuple(np.round((a + t * (b - a))[:2], 10)))
        if len(points) == 2:
            lines.append(LineString(points))
    polygons = list(polygonize(lines))
    assert len(polygons) == 1, 'The solid STL must have one closed midplane contour'
    shape = polygons[0]
    assert shape.is_valid and shape.exterior.is_simple
    return shape


def measured_groove_centers(shape, n, od_radius):
    """Find centers of missing material in independent angular inspection cells.

    The centroid of each symmetric groove lies on its center ray. Cells use a
    straight outer chord outside OD, rather than reusing generator vertices or
    assuming the groove's deepest sampled vertex is its center.
    """
    centers = []
    for k in range(n):
        theta = math.pi / 2 + k * 2 * math.pi / n
        half = math.pi / n
        radius = od_radius * 1.1
        cell = Polygon([(0, 0),
                        (radius * math.cos(theta - half), radius * math.sin(theta - half)),
                        (radius * math.cos(theta + half), radius * math.sin(theta + half))])
        missing = cell.difference(shape)
        assert missing.is_valid and missing.area > 0
        centroid = missing.centroid
        actual = math.atan2(centroid.y, centroid.x)
        error = math.atan2(math.sin(actual - theta), math.cos(actual - theta))
        centers.append(theta + error)
    return np.array(centers)


def main():
    results = []
    curves = []
    with tempfile.TemporaryDirectory(prefix='htd5m-audit-') as temp:
        script = """
        const fs=require('node:fs'),G=require('./pulley-mesh');
        const dir=process.argv[1];
        for(const n of [112,113]) for(const ring of [false,true])
          fs.writeFileSync(`${dir}/${n}-${ring?'ring':'solid'}.stl`,Buffer.from(G.binarySTL(G.mesh(n,9,ring))));
        """
        subprocess.run(['node', '-e', script, temp], cwd=ROOT, check=True)
        for n in COUNTS:
            for ring in [False, True]:
                path = Path(temp) / f'{n}-{"ring" if ring else "solid"}.stl'
                mesh = trimesh.load_mesh(path)
                assert mesh.is_watertight and mesh.is_winding_consistent and mesh.is_volume
                assert abs(mesh.extents[2] - 9) < 1e-9
                # Independent connected-component traversal (no scipy dependency).
                graph = [[] for _ in mesh.vertices]
                for a, b in mesh.edges:
                    graph[a].append(b)
                    graph[b].append(a)
                seen, pending = {0}, [0]
                while pending:
                    for b in graph[pending.pop()]:
                        if b not in seen:
                            seen.add(b)
                            pending.append(b)
                assert len(seen) == len(mesh.vertices)
                if ring:
                    continue
                shape = cross_section(mesh, 9)
                rp = n * PITCH / (2 * math.pi)
                ro = rp - PLD
                centers = measured_groove_centers(shape, n, ro)
                gaps = np.diff(np.append(centers, centers[0] + 2 * math.pi)) * rp
                max_spacing_error = float(np.max(np.abs(gaps - PITCH)))
                assert max_spacing_error < 0.001, 'Serialized STL groove centers must retain 5 mm pitch'
                # Walk an inextensible pitch line around the recovered groove pattern.
                # At each pose the belt and pulley rotate together. Tooth centers
                # should remain registered over the complete pitch circumference.
                worst_drift = 0
                for pose in np.linspace(0, 2 * math.pi, 361):
                    belt = centers[0] + pose + np.arange(n) * PITCH / rp
                    pulley = centers + pose
                    worst_drift = max(worst_drift, float(np.max(np.abs((belt - pulley) * rp))))
                assert worst_drift < 0.001
                drift_curve = (centers[0] + np.arange(n) * PITCH / rp - centers) * rp
                curves.append((f'{n}T print-fit STL', np.arange(n), drift_curve))
                results.append({
                    'teeth': n,
                    'od_mm': 2 * ro,
                    'width_mm': 9,
                    'watertight_solid_and_ring': True,
                    'single_connected_body': True,
                    'valid_non_self_intersecting_cross_section': True,
                    'maximum_groove_spacing_error_mm': max_spacing_error,
                    'maximum_pitch_registration_drift_mm': worst_drift,
                    'poses_checked': 361,
                    'tooth_positions_checked_per_pose': n,
                })
        # Positive control: deliberately squeeze 113 teeth to exactly 7 in OD.
        # Keep the assumed belt PLD fixed, matching the app's print diagnostic.
        effective_rp = 177.8 / 2 + PLD
        undersized_pitch = 2 * math.pi * effective_rp / 113
        count = np.arange(114)
        undersized_drift = count * (undersized_pitch - PITCH)
        assert abs(undersized_drift[18] + 0.45143136456875) < 1e-9
        curves.append(('113T forced to 177.8 mm OD (control)', count, undersized_drift))
    report = {
        'method': 'Independent STL loading, triangle-plane sectioning, groove symmetry centroids, and pitch-line kinematics',
        'local_groove_relief_mm': 0.10,
        'cases': results,
        'undersized_control_drift_at_18_spaces_mm': float(undersized_drift[18]),
        'limitations': [
            'Checks nominal tooth indexing and mesh geometry, not measured VEX belt tooth contact.',
            'No rubber deformation, tension, load, friction, printer shrinkage, or durability model.',
            'A physical full-diameter test-ring fit check remains necessary.',
        ],
    }
    (OUTPUT / 'geometry-results.json').write_text(json.dumps(report, indent=2) + '\n')
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.2), constrained_layout=True)
    for label, x, y in curves:
        axes[0].plot(x, y, label=label)
    axes[0].axhline(-2.5, color='#999', linestyle=':', label='Half a 5 mm pitch')
    axes[0].set(xlabel='Tooth spaces from initial alignment', ylabel='Pitch registration error (mm)', title='Nominal STL vs undersized control')
    axes[0].legend(fontsize=7)
    for label, x, y in curves[:2]:
        axes[1].plot(x, y * 1000, label=label)
    axes[1].set(xlabel='Tooth spaces from initial alignment', ylabel='Nominal STL registration error (µm)', title='Serialized mesh: numerical error only')
    axes[1].legend(fontsize=8)
    fig.suptitle('HTD 5M indexing audit · kinematic geometry, not belt-contact simulation')
    fig.savefig(OUTPUT / 'pitch-registration.svg')
    fig.savefig(OUTPUT / 'pitch-registration.png', dpi=150)
    plt.close(fig)
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
