/* Original HTD 5M construction from ISO 13050:2022 Table 14 / Figure 11.
 * See references/README.md. This is a nominal prototype, not certified hardware.
 * Includes a local print-fit groove allowance; nominal OD and pitch stay fixed.
 * All coordinates are millimeters; arcs have <= 0.002 mm chordal deviation.
 */
(function (root) {
  'use strict';
  const M = typeof module !== 'undefined' && module.exports ? require('./pulley-math') : root.PulleyMath;
  const earcut = typeof module !== 'undefined' && module.exports ? require('./vendor/earcut.min') : root.earcut;
  const TOLERANCE = 0.002;
  const PRINT_RELIEF = 0.10; // Chosen from the documented print-error sensitivity study.
  const BANDS = [
    { min: 12, max: 16, depth: 1.989, x: 0.307, rootRadius: 1.265, angle: 10, tipRadius: 0.432 },
    { min: 17, max: 25, depth: 2.009, x: 0.320, rootRadius: 1.270, angle: 6, tipRadius: 0.508 },
    { min: 26, max: 80, depth: 2.052, x: 0.081, rootRadius: 1.438, angle: 2, tipRadius: 0.488 },
    { min: 81, max: 200, depth: 2.056, x: 0.028, rootRadius: 1.552, angle: 5, tipRadius: 0.569 }
  ];
  function profile(n) {
    M.dimensions(n);
    const band = BANDS.find(b => n >= b.min && n <= b.max);
    if (!band) throw new Error('STL export supports 12–200 teeth, the published H5M groove ranges.');
    return { ...band };
  }
  function arc(center, radius, start, end) {
    const count = Math.max(1, Math.ceil(Math.abs(end - start) / (2 * Math.acos(1 - TOLERANCE / radius))));
    return Array.from({ length: count + 1 }, (_, i) => {
      const a = start + (end - start) * i / count;
      return [center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)];
    });
  }
  function outline(n, relief = PRINT_RELIEF) {
    if (!Number.isFinite(relief) || relief < 0 || relief > 0.15) throw new Error('Groove relief must be from 0 to 0.15 mm.');
    const nominal = profile(n);
    // Local groove relief leaves the pitch, tooth angles, and OD lands fixed.
    // Offset root/flank surfaces into the material and reblend to the OD.
    const p = { ...nominal, depth: nominal.depth + relief,
      rootRadius: nominal.rootRadius + relief, tipRadius: nominal.tipRadius - relief };
    const radius = M.dimensions(n).od / 2;
    const phi = p.angle * Math.PI / 180;
    // Positive local x goes across a groove; positive y goes radially outward.
    // Root arcs start at +/-X and share a flat bottom at OD radius minus depth.
    const center = [p.x, radius - p.depth + p.rootRadius];
    const half = arc(center, p.rootRadius, -Math.PI / 2, -phi);
    const tangent = half[half.length - 1];
    const v = [Math.sin(phi), Math.cos(phi)];
    const base = [tangent[0] + p.tipRadius * Math.cos(phi), tangent[1] - p.tipRadius * Math.sin(phi)];
    const dot = base[0] * v[0] + base[1] * v[1];
    const discriminant = dot * dot + (radius - p.tipRadius) ** 2 - base[0] ** 2 - base[1] ** 2;
    const length = -dot + Math.sqrt(discriminant);
    if (!Number.isFinite(length) || length < -1e-8) throw new Error('Cannot construct tangent groove for this size.');
    const filletCenter = [base[0] + length * v[0], base[1] + length * v[1]];
    const fillet = arc(filletCenter, p.tipRadius, Math.PI - phi, Math.atan2(filletCenter[1], filletCenter[0]));
    half.push(...fillet); // straight flank joins the root arc to the OD blend
    const beta = Math.atan2(half[half.length - 1][0], half[half.length - 1][1]);
    const step = 2 * Math.PI / n;
    if (!(beta > 0 && beta < step / 2)) throw new Error('Grooves overlap at this tooth count.');
    const groove = [...half].reverse().concat(half.map(([x, y]) => [-x, y]));
    const land = arc([0, 0], radius, Math.PI / 2 + beta, Math.PI / 2 + step - beta);
    const sector = groove.concat(land.slice(1, -1));
    const points = [];
    for (let k = 0; k < n; k++) {
      const a = k * step, c = Math.cos(a), s = Math.sin(a);
      for (const [x, y] of sector) points.push([x * c - y * s, x * s + y * c]);
    }
    // Exact analytic boundary shared with STEP; the STL sampling above is unchanged.
    const tip = half[half.length - 1], bottom = half[0];
    const flankTip = fillet[0];
    const mirror = ([x, y]) => [-x, y];
    const line = (start, end) => ({ type: 'line', start, end });
    const circle = (start, end, center, radius, ccw) => ({ type: 'arc', start, end, center, radius, ccw });
    const curves = [];
    for (let k = 0; k < n; k++) {
      const a = k * step, c = Math.cos(a), s = Math.sin(a);
      const rotate = ([x, y]) => [x * c - y * s, x * s + y * c];
      const nextTip = [tip[0] * Math.cos(step) - tip[1] * Math.sin(step),
        tip[0] * Math.sin(step) + tip[1] * Math.cos(step)];
      const sectorCurves = [
        circle(tip, flankTip, filletCenter, p.tipRadius, true),
        line(flankTip, tangent),
        circle(tangent, bottom, center, p.rootRadius, false),
        line(bottom, mirror(bottom)),
        circle(mirror(bottom), mirror(tangent), mirror(center), p.rootRadius, false),
        line(mirror(tangent), mirror(flankTip)),
        circle(mirror(flankTip), mirror(tip), mirror(filletCenter), p.tipRadius, true),
        circle(mirror(tip), nextTip, [0, 0], radius, true)
      ];
      for (const curve of sectorCurves) curves.push({ ...curve,
        start: rotate(curve.start), end: rotate(curve.end),
        ...(curve.center ? { center: rotate(curve.center) } : {}) });
    }
    return { points, curves, band: nominal, relief, radius, root: radius - p.depth, flankLength: length, halfOpeningAngle: beta };
  }
  function validate(n, width, testRing = false) {
    if (!Number.isFinite(width) || width < 1 || width > 100) throw new Error('Belt width must be from 1 to 100 mm.');
    const shape = outline(n);
    const innerRadius = testRing ? shape.root - 3 : 0;
    if (innerRadius < 0 || innerRadius > shape.root - 1.5) throw new Error('The test ring must leave at least 1.5 mm of material below the grooves.');
    return { shape, innerRadius };
  }
  function mesh(n, width, testRing = false) {
    const { shape, innerRadius } = validate(n, width, testRing);
    const points = shape.points.map(p => p.map(Math.fround)), triangles = [];
    // Triangulate the exact coordinates that STL will store. This avoids
    // flipping very skinny cap triangles during later float32 rounding.
    const at = (p, z) => [p[0], p[1], z];
    const add = (a, b, c) => triangles.push([a, b, c]);
    const rings = [points];
    if (innerRadius > 0) {
      const count = Math.max(64, Math.ceil(Math.PI / Math.acos(1 - TOLERANCE / innerRadius)));
      rings.push(Array.from({ length: count }, (_, i) => {
        const a = 2 * Math.PI * i / count;
        return [Math.fround(innerRadius * Math.cos(a)), Math.fround(innerRadius * Math.sin(a))];
      }));
    }
    const all = rings.flat(), holes = innerRadius > 0 ? [points.length] : [];
    const indices = earcut(all.flat(), holes);
    if (indices.length === 0) throw new Error('Unable to triangulate the pulley face.');
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = indices.slice(i, i + 3).map(index => all[index]);
      add(at(a, width), at(b, width), at(c, width));
      add(at(c, 0), at(b, 0), at(a, 0));
    }
    rings.forEach((ring, index) => {
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        const a = at(ring[i], 0), b = at(ring[j], 0), A = at(ring[i], width), B = at(ring[j], width);
        if (index === 0) { add(a, b, B); add(a, B, A); }
        else { add(b, a, A); add(b, A, B); }
      }
    });
    return { ...shape, triangles, width, bore: innerRadius * 2, testRing, n };
  }
  function binarySTL(model) {
    const buffer = new ArrayBuffer(84 + 50 * model.triangles.length);
    const view = new DataView(buffer);
    const header = `HTD5M ${model.n}T ${model.width}mm; units=mm; groove+${model.relief.toFixed(2)}mm; prototype`;
    new Uint8Array(buffer, 0, 80).set(new TextEncoder().encode(header).slice(0, 80));
    view.setUint32(80, model.triangles.length, true);
    let offset = 84;
    for (const [a, b, c] of model.triangles) {
      const u = b.map((v, i) => v - a[i]), v = c.map((v, i) => v - a[i]);
      const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const length = Math.hypot(...normal);
      if (!Number.isFinite(length) || length < 1e-12) throw new Error('Degenerate STL facet.');
      for (const value of [...normal.map(v => v / length), ...a, ...b, ...c]) { view.setFloat32(offset, value, true); offset += 4; }
      view.setUint16(offset, 0, true); offset += 2;
    }
    return buffer;
  }
  const api = { profile, outline, validate, mesh, binarySTL, TOLERANCE, PRINT_RELIEF };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PulleyMesh = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
