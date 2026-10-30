/* Analytic STEP AP214 solid export. No mesh conversion or runtime dependencies. */
(function (root) {
  'use strict';
  const G = typeof module !== 'undefined' && module.exports ? require('./pulley-mesh') : root.PulleyMesh;
  function step(n, width = 9) {
    const { shape } = G.validate(n, width);
    const rows = [];
    const add = entity => { rows.push(`#${rows.length + 1}=${entity};`); return `#${rows.length}`; };
    const real = value => {
      if (!Number.isFinite(value)) throw new Error('Invalid STEP coordinate.');
      const text = (Math.abs(value) < 1e-14 ? 0 : value).toPrecision(16);
      return text.replace('e', 'E');
    };
    const list = refs => `(${refs.join(',')})`;
    const point = xyz => add(`CARTESIAN_POINT('',${list(xyz.map(real))})`);
    const direction = xyz => add(`DIRECTION('',${list(xyz.map(real))})`);
    const zAxis = direction([0, 0, 1]), xAxis = direction([1, 0, 0]);
    const axis = (xyz, normal = zAxis, reference = xAxis) => add(`AXIS2_PLACEMENT_3D('',${point(xyz)},${normal},${reference})`);
    const origin = axis([0, 0, 0]);
    const vector = (unit, length) => add(`VECTOR('',${unit},${real(length)})`);
    const vertex = xyz => {
      const p = point(xyz);
      return { point: p, ref: add(`VERTEX_POINT('',${p})`) };
    };
    const edge = (a, b, curve, forward = true) => add(`EDGE_CURVE('',${a.ref},${b.ref},${curve},${forward ? '.T.' : '.F.'})`);
    const oriented = (ref, forward = true) => add(`ORIENTED_EDGE('',*,*,${ref},${forward ? '.T.' : '.F.'})`);
    const face = (edges, surface, forward = true) => {
      const loop = add(`EDGE_LOOP('',${list(edges)})`);
      const bound = add(`FACE_OUTER_BOUND('',${loop},.T.)`);
      return add(`ADVANCED_FACE('',(${bound}),${surface},${forward ? '.T.' : '.F.'})`);
    };
    // Reuse vertices and edges at each join, including the final seam.
    const curves = shape.curves;
    const lower = curves.map(c => vertex([...c.start, 0]));
    const upper = curves.map(c => vertex([...c.start, width]));
    const vertical = curves.map((c, i) => edge(lower[i], upper[i],
      add(`LINE('',${lower[i].point},${vector(zAxis, 1)})`)));
    const lowerEdges = [], upperEdges = [], walls = [];
    curves.forEach((c, i) => {
      const j = (i + 1) % curves.length;
      let bottomCurve, topCurve, surface;
      if (c.type === 'arc') {
        const bottomAxis = axis([...c.center, 0]);
        bottomCurve = add(`CIRCLE('',${bottomAxis},${real(c.radius)})`);
        topCurve = add(`CIRCLE('',${axis([...c.center, width])},${real(c.radius)})`);
        surface = add(`CYLINDRICAL_SURFACE('',${bottomAxis},${real(c.radius)})`);
      } else {
        const dx = c.end[0] - c.start[0], dy = c.end[1] - c.start[1];
        const length = Math.hypot(dx, dy);
        const along = direction([dx / length, dy / length, 0]);
        const v = vector(along, 1);
        bottomCurve = add(`LINE('',${lower[i].point},${v})`);
        topCurve = add(`LINE('',${upper[i].point},${v})`);
        surface = add(`PLANE('',${axis([...c.start, 0], direction([dy / length, -dx / length, 0]), along)})`);
      }
      const forward = c.type === 'line' || c.ccw;
      const bottom = edge(lower[i], lower[j], bottomCurve, forward);
      const top = edge(upper[i], upper[j], topCurve, forward);
      lowerEdges.push(bottom); upperEdges.push(top);
      walls.push(face([oriented(bottom), oriented(vertical[j]), oriented(top, false), oriented(vertical[i], false)], surface, forward));
    });
    const bottomPlane = add(`PLANE('',${origin})`);
    const topPlane = add(`PLANE('',${axis([0, 0, width])})`);
    const bottom = face([...lowerEdges].reverse().map(e => oriented(e, false)), bottomPlane, false);
    const top = face(upperEdges.map(e => oriented(e)), topPlane);
    const shell = add(`CLOSED_SHELL('',${list([bottom, top, ...walls])})`);
    const name = `HTD5M ${n}T W${width}mm fit${shape.relief.toFixed(2)}mm`;
    const solid = add(`MANIFOLD_SOLID_BREP('${name}',${shell})`);
    const mm = add('(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))');
    const rad = add('(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))');
    const sterad = add('(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())');
    const uncertainty = add(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-7),${mm},'distance_accuracy_value','')`);
    const context = add(`(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((${uncertainty}))GLOBAL_UNIT_ASSIGNED_CONTEXT((${mm},${rad},${sterad}))REPRESENTATION_CONTEXT('','3D'))`);
    const representation = add(`ADVANCED_BREP_SHAPE_REPRESENTATION('${name}',(${origin},${solid}),${context})`);
    const app = add("APPLICATION_CONTEXT('automotive design')");
    add(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,${app})`);
    const productContext = add(`PRODUCT_CONTEXT('',${app},'mechanical')`);
    const product = add(`PRODUCT('${name}','${name}','',(${productContext}))`);
    const formation = add(`PRODUCT_DEFINITION_FORMATION('','',${product})`);
    const definitionContext = add(`PRODUCT_DEFINITION_CONTEXT('part definition',${app},'design')`);
    const definition = add(`PRODUCT_DEFINITION('design','',${formation},${definitionContext})`);
    const productShape = add(`PRODUCT_DEFINITION_SHAPE('','',${definition})`);
    add(`SHAPE_DEFINITION_REPRESENTATION(${productShape},${representation})`);
    return "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('Analytic HTD5M pulley solid; units=mm'),'2;1');\n" +
      `FILE_NAME('HTD5M_${n}T.step','${new Date().toISOString()}',(''),(''),'HTD5M calculator','HTD5M calculator','');\n` +
      "FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));\nENDSEC;\nDATA;\n" + rows.join('\n') + '\nENDSEC;\nEND-ISO-10303-21;\n';
  }
  const api = { step };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PulleyStep = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
