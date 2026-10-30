'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('./pulley-math');
const close = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);

test('published 20T sizing agrees within catalog rounding', () => {
  const d = M.dimensions(20);
  close(d.pd, 31.83, .005); close(d.od, 30.69, .005);
  close(d.pd - d.od, 1.143);
});
test('112 and 113 tooth nominal dimensions near seven inches', () => {
  close(M.dimensions(112).od, 177.11053626292278);
  close(M.dimensions(113).od, 178.70208569384172);
  close(M.dimensions(113).circumference, 565);
  close(M.dimensions(113).angle * 113, 360);
});
test('seven inch target shows surrounding sizes and selects nearest', () => {
  const r = M.options(177.8);
  assert.equal(r.nearest, 112);
  assert.deepEqual(r.nearby.map(d => d.n), [110,111,112,113,114,115]);
  assert.ok(r.nearby.find(d => d.n === 112).difference < 0);
  assert.ok(r.nearby.find(d => d.n === 113).difference > 0);
});
test('exact nominal targets and supported boundaries', () => {
  for (const n of [12,20,112,113,192]) {
    const r = M.options(M.dimensions(n).od);
    assert.equal(r.nearest, n);
    close(r.nearby.find(d => d.n === n).difference, 0);
    assert.ok(r.nearby.every(d => d.n >= 12 && d.n <= 192));
  }
});
test('invalid target diameters and tooth counts are rejected', () => {
  for (const v of [NaN, Infinity, 0, -1, 1, 4000]) assert.throws(() => M.options(v));
  for (const n of [NaN, Infinity, 0, -1, 11, 113.5, 2001]) assert.throws(() => M.dimensions(n));
});
test('print diagnostic distinguishes small diameter error from half-pitch drift at 18', () => {
  const r = M.diagnose(113, 177.8, 18);
  close(r.diameterError, -.9020856938417126);
  close(r.drift, -.45143136456874977);
  assert.ok(r.halfPitchIntervals > 99 && r.halfPitchIntervals < 100);
  const nominal = M.diagnose(113, M.dimensions(113).od, 18);
  close(nominal.drift, 0); assert.equal(nominal.halfPitchIntervals, Infinity);
  assert.throws(() => M.diagnose(113, 0, 18));
  assert.throws(() => M.diagnose(113, 177.8, 1.5));
});

test('12 inch target cap is enforced and every option stays within it', () => {
  const result = M.options(304.8);
  assert.equal(result.nearest, 192);
  assert.ok(result.nearby.every(d => d.od <= 304.8));
  assert.equal(result.nearby.at(-1).n, 192);
  assert.throws(() => M.options(304.800001));
  assert.throws(() => M.options(12.001 * 25.4));
});

test('unit conversion roundoff preserves supported boundaries without accepting larger errors', () => {
  for (const boundary of [M.dimensions(12).od, M.MAX_TARGET_OD]) {
    const inches = Number((boundary / 25.4).toPrecision(14));
    assert.doesNotThrow(() => M.options(inches * 25.4));
  }
  assert.throws(() => M.options(M.dimensions(12).od - 1e-8));
  assert.throws(() => M.options(M.MAX_TARGET_OD + 1e-8));
});
