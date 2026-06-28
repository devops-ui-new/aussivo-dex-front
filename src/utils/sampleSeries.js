/**
 * sampleSeries — ILLUSTRATIVE / SAMPLE performance data generator.
 *
 * ⚠️ This does NOT represent real returns. It produces a deterministic, good-looking
 * curve purely so the demo charts have distinct, realistic-looking shapes per
 * timeframe. The values are seeded from the vault id + timeframe so they are stable
 * across renders (no flicker) but differ between vaults and between 1D/1W/1M/3M/6M/1Y.
 *
 * Returns an array of numbers (the y-series). The component scales/animates them.
 */

// Small deterministic PRNG (mulberry32) from a string seed.
function makeRand(seedStr) {
  let h = 2166136261 >>> 0;
  const s = String(seedStr);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  let a = h || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Per-timeframe character: how many points, how choppy, how strong the uptrend.
const PROFILES = {
  "1D": { points: 26, volatility: 0.55, trend: 0.20, dip: 0.5 },
  "1W": { points: 30, volatility: 0.70, trend: 0.45, dip: 0.6 },
  "1M": { points: 32, volatility: 0.85, trend: 0.70, dip: 0.8 },
  "3M": { points: 46, volatility: 1.00, trend: 1.15, dip: 1.0 },
  "6M": { points: 60, volatility: 1.10, trend: 1.70, dip: 1.2 },
  "1Y": { points: 54, volatility: 1.25, trend: 2.40, dip: 1.5 },
};

/**
 * @param {string} seed      stable id (e.g. vault id)
 * @param {string} timeframe one of 1D/1W/1M/3M/6M/1Y
 * @param {number} apy       headline APY the final point should land near
 * @returns {number[]}
 */
export function sampleSeries(seed, timeframe, apy = 18) {
  const prof = PROFILES[timeframe] || PROFILES["1W"];
  const rand = makeRand(`${seed}|${timeframe}`);
  const target = Math.max(Number(apy) || 0, 1);
  const n = prof.points;

  // Start low, climb toward `target` with timeframe-specific noise and the
  // occasional pullback so it reads like a real performance line, not a ramp.
  const start = target * (0.06 + rand() * 0.12);
  const out = [start];
  const step = (target - start) / (n - 1);

  for (let i = 1; i < n; i++) {
    const drift = step * prof.trend;
    const noise = (rand() - 0.45) * (target / 14) * prof.volatility;
    // occasional dip
    const pull = rand() < 0.12 ? -(target / 20) * prof.dip * rand() : 0;
    let v = out[i - 1] + drift + noise + pull;
    // keep it in a sane band and monotonic-ish but not perfectly straight
    v = Math.max(target * 0.04, Math.min(target * 1.12, v));
    out.push(v);
  }

  // Land the last point on the headline number so the chart agrees with the APY shown.
  out[out.length - 1] = target;
  return out;
}