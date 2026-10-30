'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const G = require('./pulley-mesh');
const S = require('./pulley-step');
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} vs ${b}`);

test('analytic curves form the same closed, tangent boundary as STL sampling for every count', () => {
  for (let n = 12; n <= 200; n++) {
    const shape = G.outline(n), curves = shape.curves;
    assert.equal(curves.length, n * 8);
    const tangent = (c, at) => {
      if (c.type === 'line') return c.end.map((v, i) => v - c.start[i]);
      const [x, y] = c[at].map((v, i) => v - c.center[i]);
      return c.ccw ? [-y, x] : [y, -x];
    };
    let exactArea = 0;
    for (let i = 0; i < curves.length; i++) {
      const c = curves[i], next = curves[(i + 1) % curves.length];
      near(c.end[0], next.start[0]); near(c.end[1], next.start[1]);
      const a = tangent(c, 'end'), b = tangent(next, 'start');
      near((a[0] * b[0] + a[1] * b[1]) / Math.hypot(...a) / Math.hypot(...b), 1);
      if (c.type === 'line') exactArea += (c.start[0] * c.end[1] - c.start[1] * c.end[0]) / 2;
      else {
        for (const p of [c.start, c.end]) near(Math.hypot(...p.map((v, i) => v - c.center[i])), c.radius);
        const start = Math.atan2(c.start[1] - c.center[1], c.start[0] - c.center[0]);
        const end = Math.atan2(c.end[1] - c.center[1], c.end[0] - c.center[0]);
        let sweep = end - start;
        if (c.ccw && sweep < 0) sweep += 2 * Math.PI;
        if (!c.ccw && sweep > 0) sweep -= 2 * Math.PI;
        exactArea += (c.center[0] * (c.end[1] - c.start[1]) - c.center[1] * (c.end[0] - c.start[0]) + c.radius ** 2 * sweep) / 2;
      }
    }
    const sampledArea = shape.points.reduce((sum, a, i) => {
      const b = shape.points[(i + 1) % shape.points.length];
      return sum + (a[0] * b[1] - a[1] * b[0]) / 2;
    }, 0);
    // Chordal strips bound the difference between curved STEP and sampled STL.
    assert.ok(Math.abs(exactArea - sampledArea) < shape.points.reduce((s, a, i) => {
      const b = shape.points[(i + 1) % shape.points.length];
      return s + Math.hypot(a[0] - b[0], a[1] - b[1]) * G.TOLERANCE;
    }, 0));
    // Every sampled point is on the analytic boundary, up to chord sampling precision.
    for (const p of shape.points.slice(0, shape.points.length / n)) {
      assert.ok(curves.slice(0, 8).some(c => c.type === 'arc'
        ? Math.abs(Math.hypot(p[0] - c.center[0], p[1] - c.center[1]) - c.radius) < 1e-8
        : Math.abs((p[0] - c.start[0]) * (c.end[1] - c.start[1]) - (p[1] - c.start[1]) * (c.end[0] - c.start[0])) < 1e-8));
    }
  }
});

test('STEP uses analytic solids, millimeters, and paired edges with no dangling references', () => {
  for (const n of [12, 16, 17, 25, 26, 80, 81, 112, 113, 192, 200]) {
    const text = S.step(n);
    assert.match(text, /^ISO-10303-21;/);
    assert.match(text, /END-ISO-10303-21;\n$/);
    assert.match(text, /MANIFOLD_SOLID_BREP/);
    assert.match(text, /SI_UNIT\(\.MILLI\.,\.METRE\.\)/);
    assert.ok(!/TRIANGULATED|FACETED|POLY_LOOP|B_SPLINE/.test(text));
    assert.equal((text.match(/=ADVANCED_FACE\(/g) || []).length, 8 * n + 2);
    assert.equal((text.match(/=CYLINDRICAL_SURFACE\(/g) || []).length, 5 * n);
    const entities = new Set([...text.matchAll(/^#(\d+)=/gm)].map(m => m[1]));
    for (const m of text.matchAll(/#(\d+)/g)) assert.ok(entities.has(m[1]), `Missing #${m[1]}`);
    const edges = new Map();
    for (const m of text.matchAll(/ORIENTED_EDGE\('',\*,\*,#(\d+),(\.T\.|\.F\.)\)/g)) {
      const e = edges.get(m[1]) || { count: 0, balance: 0 };
      e.count++; e.balance += m[2] === '.T.' ? 1 : -1; edges.set(m[1], e);
    }
    assert.equal(edges.size, 24 * n);
    for (const e of edges.values()) assert.deepEqual(e, { count: 2, balance: 0 });
  }
  for (const n of [11, 201, 112.5, NaN]) assert.throws(() => S.step(n));
  for (const width of [0, 101, NaN]) assert.throws(() => S.step(112, width));
});

test('standalone app embeds STEP and places its own button before STL', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(html.indexOf('id="downloadSTEP"') < html.indexOf('id="downloadSTL"'));
  assert.match(html, /root.PulleyStep = api/);
  assert.match(html, /Download STEP/);
  assert.ok(!/<script[^>]+src=/.test(html));
});
