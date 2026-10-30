'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const G = require('./pulley-mesh');
const M = require('./pulley-math');
const close = (a,b,tol=1e-7) => assert.ok(Math.abs(a-b)<tol, `${a} vs ${b}`);
const area = ring => ring.reduce((s,a,i)=>{const b=ring[(i+1)%ring.length];return s+(a[0]*b[1]-b[0]*a[1])/2},0);
function inspectSTL(buffer) {
 const view=new DataView(buffer), count=view.getUint32(80,true);
 assert.equal(buffer.byteLength,84+50*count);
 const edges=new Map(), bounds=[[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]];
 let volume=0;
 for(let i=0;i<count;i++) {
  const base=84+50*i;
  const vertices=Array.from({length:3},(_,j)=>Array.from({length:3},(_,k)=>view.getFloat32(base+12+12*j+4*k,true)));
  const [a,b,c]=vertices, u=b.map((v,k)=>v-a[k]), v=c.map((v,k)=>v-a[k]);
  const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  assert.ok(Math.hypot(...cross)>1e-9,'No degenerate faces after float32 serialization');
  const normal=[0,1,2].map(k=>view.getFloat32(base+4*k,true));
  assert.ok(normal.reduce((s,n,k)=>s+n*cross[k],0)>0,'Stored normals match winding');
  volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  vertices.forEach(point=>point.forEach((x,k)=>{assert.ok(Number.isFinite(x));bounds[0][k]=Math.min(bounds[0][k],x);bounds[1][k]=Math.max(bounds[1][k],x)}));
  for(let j=0;j<3;j++) {
   const a=vertices[j].join(','),b=vertices[(j+1)%3].join(',');
   const key=a<b?`${a}|${b}`:`${b}|${a}`;
   const e=edges.get(key)||{count:0,balance:0};e.count++;e.balance+=a<b?1:-1;edges.set(key,e);
  }
 }
 for(const e of edges.values()) {assert.equal(e.count,2,'Every STL edge belongs to two facets');assert.equal(e.balance,0,'Adjacent faces wind oppositely');}
 assert.ok(volume>0,'Positive enclosed volume');
 return {volume,bounds,count};
}
test('all published tooth counts construct finite tangent profiles with positive lands',()=>{
 for(let n=12;n<=200;n++) {
  const p=G.outline(n),band=G.profile(n);
  assert.ok(p.flankLength>=0);assert.ok(p.halfOpeningAngle<Math.PI/n);
  close(p.radius,M.dimensions(n).od/2);
  assert.ok(p.points.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)));
  assert.ok(area(p.points)>0);
  const radii=p.points.map(p=>Math.hypot(...p));
  assert.ok(Math.max(...radii)<=p.radius+1e-8);
  assert.ok(Math.min(...radii)>=p.root-1e-8);
  // Each tooth sector is an exact rotation of the first, not rescaled teeth.
  const count=p.points.length/n, a=2*Math.PI/n;
  for(let i=0;i<count;i++) {
   const [x,y]=p.points[i],q=p.points[count+i];
   close(q[0],x*Math.cos(a)-y*Math.sin(a));close(q[1],x*Math.sin(a)+y*Math.cos(a));
  }
  assert.ok(n>=band.min&&n<=band.max);
 }
});
test('profile parameters change at published count boundaries',()=>{
 assert.equal(G.profile(16).depth,1.989);assert.equal(G.profile(17).depth,2.009);
 assert.equal(G.profile(25).rootRadius,1.270);assert.equal(G.profile(26).rootRadius,1.438);
 assert.equal(G.profile(80).tipRadius,.488);assert.equal(G.profile(81).tipRadius,.569);
 assert.throws(()=>G.profile(201));
});
test('all 378 solid and ring STLs are closed and oriented after serialization',()=>{
 for(let n=12;n<=200;n++) {
  for(const mode of ['solid','ring']) {
   const model=G.mesh(n,9,mode==='ring');
   const {volume,bounds}=inspectSTL(G.binarySTL(model));
   close(bounds[0][2],0);close(bounds[1][2],9);
   // Cap area/volume agreement catches missing faces and faulty triangulation.
   const ideal=(area(model.points)-Math.PI*(model.bore/2)**2)*9;
   const chordBound = 2 * Math.PI * (model.bore / 2) * G.TOLERANCE * 9;
   assert.ok(volume >= ideal - Math.max(.002, ideal * 1e-6));
   assert.ok(volume <= ideal + chordBound + Math.max(.002, ideal * 1e-6));
  }
 }
});
test('width matches belt and invalid export settings are rejected',()=>{
 close(G.mesh(113,15).width,15);
 for(const w of [NaN,Infinity,0,-1,101])assert.throws(()=>G.mesh(113,w));
 assert.throws(()=>G.mesh(201,9));
});
test('standalone app embeds executable dependencies and manufacturer image',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(!/<script[^>]+src=/.test(html));
 assert.ok(!/<img[^>]+src="(?!data:)/.test(html));
 assert.match(html,/data:image\/jpeg;base64,/);
 assert.match(html,/Download STL/);
 assert.ok(!html.includes('id="beltWidth"'));
 assert.ok(!html.includes('id="printN"'));
 assert.ok(!html.includes('id="Ndraw"'));
 assert.ok(!html.includes('id="bore"'));
 assert.match(html,/data-teeth=/);
 assert.match(html,/id="downloadSTL"/);
 assert.ok(!html.includes('Δ target'));
});

test('print allowance opens grooves while retaining OD, indexing, and 9 mm width',()=>{
 assert.equal(G.PRINT_RELIEF,.10);
 for(const n of [12,16,17,25,26,80,81,112,113,192,200]) {
  const nominal=G.outline(n,0),printed=G.outline(n);
  close(printed.radius,nominal.radius);
  close(printed.root,nominal.root-.10);
  assert.ok(area(printed.points)<area(nominal.points));
  assert.ok(printed.halfOpeningAngle<Math.PI/n);
  close(G.mesh(n,9).width,9);
 }
});
