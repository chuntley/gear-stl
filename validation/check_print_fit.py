"""Assumption-based 2D HTD 5M belt/print contact sensitivity study.

Not a measured VEX belt model, FEA, or printer accuracy certification.
Dependencies: numpy, shapely, matplotlib. Run from any working directory.
"""
from pathlib import Path
import json
import math
import subprocess

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import shapely
from shapely import affinity
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(__file__).resolve().parent
PITCH, PLD = 5.0, 0.5715


def circle_arc(a, b, radius, clockwise, choose):
    a, b = np.array(a, dtype=float), np.array(b, dtype=float)
    delta = b - a
    length = np.linalg.norm(delta)
    midpoint = (a + b) / 2
    perpendicular = np.array([-delta[1], delta[0]]) / length
    height = math.sqrt(radius**2 - length**2 / 4)
    candidates = [midpoint + perpendicular * height, midpoint - perpendicular * height]
    center = choose(candidates)
    start = math.atan2(*(a - center)[::-1])
    end = math.atan2(*(b - center)[::-1])
    if clockwise:
        while end > start:
            end -= 2 * math.pi
    else:
        while end < start:
            end += 2 * math.pi
    angles = np.linspace(start, end, 81)
    return center + radius * np.column_stack([np.cos(angles), np.sin(angles)])


def nominal_tooth_proxy():
    # ISO 13050:2022 Table 9 H5M nominal points/radii. These rounded points
    # define a sensitivity proxy, not a scanned VEX-specific production tooth.
    p1, p2, p3, p4 = (-1.85, 0), (-1.44, -.42), (-1.44, -.53), (0, -2.08)
    root = circle_arc(p1, p2, .41, True, lambda c: min(c, key=lambda p: p[0]))
    tip = circle_arc(p3, p4, 1.50, False, lambda c: max(c, key=lambda p: p[0]))
    left = np.vstack([root, tip])  # straight P2-to-P3 segment between arcs
    right = left[-2::-1] * np.array([-1, 1])
    roof = np.column_stack([np.linspace(1.85, -1.85, 101)[1:-1], np.zeros(99)])
    points = np.vstack([left, right, roof])
    assert Polygon(points).is_valid
    return points


def neutral_curve(ro, sx, sy, growth):
    # Inextensible belt follows a constant normal offset from the printed
    # tooth-tip ellipse. Its tooth centers advance by 5 mm of arc length.
    theta = np.linspace(0, 2 * math.pi, 32769)
    base = np.column_stack([ro * sx * np.cos(theta), ro * sy * np.sin(theta)])
    normal = np.column_stack([np.cos(theta) / sx, np.sin(theta) / sy])
    normal /= np.linalg.norm(normal, axis=1)[:, None]
    center = base + normal * (PLD + growth)
    length = np.r_[0, np.cumsum(np.linalg.norm(np.diff(center, axis=0), axis=1))]
    return theta, center, normal, length


def transform_tooth(points, position, curve, extra_lift=0):
    theta, center, normal, length = curve
    s = (position + points[:, 0]) % length[-1]
    coords = np.column_stack([np.interp(s, length, center[:, j]) for j in range(2)])
    normals = np.column_stack([np.interp(s, length, normal[:, j]) for j in range(2)])
    return Polygon(coords + (points[:, 1] - PLD + extra_lift)[:, None] * normals)


def scenario(shape, ro, spec):
    sx = 1 + spec.get('dx', 0) / (2 * ro)
    sy = 1 + spec.get('dy', spec.get('dx', 0)) / (2 * ro)
    growth = spec.get('growth', 0)
    printed = affinity.scale(shape, xfact=sx, yfact=sy, origin=(0, 0))
    if growth:
        printed = printed.buffer(growth, quad_segs=16)
    # First-layer bulge exists only at one axial end. The rest of the belt
    # width remains seated at the main body; do not lift the entire belt to
    # conceal a collision confined to the bottom 0.4 mm of its width.
    if spec.get('foot', 0):
        printed = printed.buffer(spec['foot'], quad_segs=16)
    return printed, neutral_curve(ro, sx, sy, growth)


def evaluate(shape, ro, n, points, spec):
    printed, curve = scenario(shape, ro, spec)
    shapely.prepare(printed)
    theta, center, normal, length = curve
    teeth = max(1, int(n / 4))
    worst_area, worst_position = 0, None
    intersections = 0
    max_phase = 0
    samples = 0
    # Eight anchor locations sample ovality axes and diagonals. Check every
    # tooth in approximately 180 degrees of wrap, centered on a registered one.
    for anchor in sorted(set(round(n * i / 8) % n for i in range(8))):
        t = (math.pi / 2 + 2 * math.pi * anchor / n) % (2 * math.pi)
        start = float(np.interp(t, theta, length))
        positions = start + np.arange(-teeth, teeth + 1) * PITCH
        polygons = [transform_tooth(points, s, curve) for s in positions]
        overlaps = shapely.area(shapely.intersection(printed, polygons))
        samples += len(positions)
        intersections += int(np.sum(overlaps > 1e-5))
        k = int(np.argmax(overlaps))
        if overlaps[k] > worst_area:
            worst_area, worst_position = float(overlaps[k]), float(positions[k])
        # Compare belt arc positions to the corresponding transformed grooves.
        for offset, pos in zip(range(-teeth, teeth + 1), positions):
            target = t + offset * 2 * math.pi / n
            turns = math.floor(target / (2 * math.pi))
            arc = np.interp(target % (2 * math.pi), theta, length) + turns * length[-1]
            max_phase = max(max_phase, abs(float(pos - arc)))
    lift = 0
    if worst_area > 1e-5:
        lo, hi = 0, .8
        for _ in range(16):
            mid = (lo + hi) / 2
            tooth = transform_tooth(points, worst_position, curve, mid)
            if printed.intersection(tooth).area > 1e-5:
                lo = mid
            else:
                hi = mid
        lift = hi
    return {
        'teeth': n, 'scenario': spec['name'],
        'tested_tooth_positions': samples,
        'positions_with_proxy_overlap': intersections,
        'maximum_proxy_overlap_area_mm2': worst_area,
        'radial_lift_to_clear_worst_proxy_tooth_mm': lift,
        'lift_search_limited': lift >= .8 - 1e-5,
        'maximum_centered_wrap_pitch_mismatch_mm': max_phase,
    }


def main():
    js = """
    const G=require('./pulley-mesh'),data={};
    for(const n of [112,113,192])for(const relief of [0,.05,.1,.15])
      data[`${n}-${relief}`]=G.outline(n,relief);
    process.stdout.write(JSON.stringify(data));
    """
    profiles = json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT))
    points = nominal_tooth_proxy()
    scenarios = [
        {'name': 'Nominal'},
        {'name': 'OD +0.10 mm', 'dx': .10},
        {'name': 'OD -0.10 mm', 'dx': -.10},
        {'name': 'Oval: X +0.10, Y -0.10 mm', 'dx': .10, 'dy': -.10},
        {'name': 'Surface growth 0.05 mm', 'growth': .05},
        {'name': 'OD +0.10 and growth 0.05 mm', 'dx': .10, 'growth': .05},
        {'name': 'Combined + residual foot 0.03 mm', 'dx': .10, 'growth': .05, 'foot': .03},
        {'name': 'First-layer bulge 0.20 mm', 'foot': .20},
        {'name': 'Residual first-layer bulge 0.03 mm', 'foot': .03},
        {'name': 'Stress: OD +0.20 and growth 0.10 mm', 'dx': .20, 'growth': .10},
    ]
    rows = []
    for n in [112, 113, 192]:
        for relief in [0, .05, .1, .15]:
            profile = profiles[f'{n}-{relief}']
            shape = Polygon(profile['points'])
            assert shape.is_valid
            for spec in scenarios:
                result = evaluate(shape, profile['radius'], n, points, spec)
                result['groove_relief_mm'] = relief
                rows.append(result)
                print(n, relief, spec['name'], 'overlap area', round(result['maximum_proxy_overlap_area_mm2'],5), 'lift', round(result['radial_lift_to_clear_worst_proxy_tooth_mm'],4), flush=True)
    # Acceptance applies only to the explicitly modeled, calibrated-error
    # envelope. Severe errors are positive controls and must still fail.
    for result in rows:
        if result['groove_relief_mm'] != .1:
            continue
        severe = result['scenario'] in ['First-layer bulge 0.20 mm', 'Stress: OD +0.20 and growth 0.10 mm']
        if severe:
            assert result['maximum_proxy_overlap_area_mm2'] > .01
        else:
            assert result['maximum_proxy_overlap_area_mm2'] < 1e-5
    report = {
        'belt': 'Nominal HTD 5M, 9 mm width proxy for the identified VEX belt; no measured VEX production profile/tolerances were available',
        'assumptions': {
            'tooth_pitch_mm': PITCH, 'tooth_height_mm': 2.08, 'belt_width_mm': 9,
            'nominal_tooth_points_and_radii': 'ISO 13050:2022 Table 9; rounded coordinates connected by circular arcs and a straight flank',
            'wrap': 'Approximately 180 degrees, eight groove-aligned anchor locations',
            'printer_errors': 'Sensitivity scenarios, not manufacturer accuracy claims or measured printer errors',
            'first_layer_bulge_axial_extent_mm': .4,
            'max_lift_search_mm': .8,
            'contact': 'Rigid 2D overlap of a bent tooth proxy with the printed cross-section; no elastic rubber response, tension, wear, or force prediction',
        },
        'results': rows,
    }
    (OUT / 'print-fit-results.json').write_text(json.dumps(report, indent=2) + '\n')
    plot_results(rows)


def plot_results(rows):
    scenarios = [{'name': name} for name in dict.fromkeys(r['scenario'] for r in rows)]
    fig, ax = plt.subplots(figsize=(11, 5.4), constrained_layout=True)
    x = np.arange(len(scenarios))
    for i, relief in enumerate([0,.05,.1,.15]):
        values = [r['radial_lift_to_clear_worst_proxy_tooth_mm'] for r in rows if r['teeth']==113 and r['groove_relief_mm']==relief]
        ax.bar(x+(i-1.5)*.18, values, width=.18, label=f'{relief:.2f} mm local groove relief')
    ax.set_xticks(x, [s['name'].replace(' and ', '\n+ ').replace(': ', ':\n') for s in scenarios], rotation=30, ha='right', fontsize=8)
    ax.set(ylabel='Radial lift needed to clear worst tooth proxy (mm)', title='113T · nominal 5M belt proxy · assumed print errors\nRigid overlap sensitivity, not a physical VEX fit certification')
    ax.legend(fontsize=8)
    ax.text(.99, .98, 'Lift search capped at 0.80 mm; capped bars are lower bounds.', transform=ax.transAxes, ha='right', va='top', fontsize=7)
    fig.savefig(OUT / 'print-error-sensitivity.svg')
    fig.savefig(OUT / 'print-error-sensitivity.png', dpi=150)
    plt.close(fig)


if __name__ == '__main__':
    main()
