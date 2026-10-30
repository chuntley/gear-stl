/* HTD 5M nominal sizing. Source: references/README.md. Units: mm. */
(function (root) {
  'use strict';
  const PITCH = 5;
  const PLD = 0.5715;
  const MIN_TEETH = 12; // Supported sizing range; not a load-capacity recommendation.
  const MAX_TEETH = 2000; // Diagnostic calculation limit, not the target-size limit.
  const MAX_TARGET_OD = 304.8; // 12 inches, a hard application limit.
  const MAX_OPTION_TEETH = Math.floor((MAX_TARGET_OD + 2 * PLD) * Math.PI / PITCH);
  function dimensions(n) {
    if (!Number.isInteger(n) || n < MIN_TEETH || n > MAX_TEETH) {
      throw new Error(`Tooth count must be a whole number from ${MIN_TEETH} to ${MAX_TEETH}.`);
    }
    return { n, pd: n * PITCH / Math.PI, od: n * PITCH / Math.PI - 2 * PLD,
      circumference: n * PITCH, angle: 360 / n };
  }
  function options(target) {
    const min = dimensions(MIN_TEETH).od, max = MAX_TARGET_OD;
    // Allow only floating-point roundoff at unit-converted boundaries.
    const epsilon = 32 * Number.EPSILON * max;
    if (!Number.isFinite(target) || target < min - epsilon || target > max + epsilon) {
      throw new Error(`Enter a target outside diameter from ${min.toFixed(3)} to ${max.toFixed(3)} mm.`);
    }
    target = Math.max(min, Math.min(max, target));
    const nearest = Math.max(MIN_TEETH, Math.min(MAX_OPTION_TEETH, Math.round((target + 2 * PLD) * Math.PI / PITCH)));
    const nearby = [];
    for (let n = Math.max(MIN_TEETH, nearest - 2); n <= Math.min(MAX_OPTION_TEETH, nearest + 3); n++) {
      const d = dimensions(n);
      nearby.push({ ...d, difference: d.od - target });
    }
    return { nearest, nearby };
  }
  function diagnose(n, measuredOD, intervals) {
    const nominal = dimensions(n);
    if (!Number.isFinite(measuredOD) || measuredOD <= 0) throw new Error('Measured outside diameter must be positive.');
    if (!Number.isInteger(intervals) || intervals < 1 || intervals > MAX_TEETH) {
      throw new Error(`Check intervals must be a whole number from 1 to ${MAX_TEETH}.`);
    }
    // Estimate assumes the nominal pitch-line differential and full belt seating.
    // OD alone cannot establish the actual belt pitch line or validate groove geometry.
    const effectivePitch = Math.PI * (measuredOD + 2 * PLD) / n;
    const error = effectivePitch - PITCH;
    return { nominal, effectivePitch, error, percent: error / PITCH * 100,
      drift: error * intervals, halfPitchIntervals: Math.abs(error) < 1e-12 ? Infinity : PITCH / 2 / Math.abs(error),
      diameterError: measuredOD - nominal.od };
  }
  const api = { PITCH, PLD, MIN_TEETH, MAX_TEETH, MAX_TARGET_OD, MAX_OPTION_TEETH, dimensions, options, diagnose };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PulleyMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
