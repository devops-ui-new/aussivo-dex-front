import { useMemo } from "react";

// Deterministic hash + PRNG so each entity gets its own stable, unique generative art.
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const shortHash = (v, a = 6, b = 4) => { const s = String(v || ""); return s.length > a + b + 2 ? `${s.slice(0, a)}…${s.slice(-b)}` : s; };
export const asHash = (id) => { const s = String(id || ""); return /^0x/i.test(s) ? s : "0x" + s.replace(/[^a-f0-9]/gi, "").padEnd(24, "0").slice(0, 40); };

/**
 * GenerativeArt — unique, deterministic "generative NFT" artwork for any entity, drawn as inline
 * SVG (no network, no raster assets → can't slow load or break layout). Seeded from `seed`: a
 * gradient field + a blockchain-style node constellation + soft glow. Purely decorative.
 *
 * @param {string}  seed     stable id (deposit id, vault id, …) → determines the artwork
 * @param {string}  [glyph]  optional watermark glyph (e.g. "$" / "₮")
 * @param {boolean} [animate=true]
 */
export function GenerativeArt({ seed, glyph = "", className = "", animate = true }) {
  const art = useMemo(() => {
    const base = hashSeed(seed);
    const rng = mulberry32(base);
    const hue = base % 360;
    const h1 = hue, h2 = (hue + 38) % 360, h3 = (hue + 320) % 360;
    const nodes = Array.from({ length: 6 + Math.floor(rng() * 4) }, () => ({ x: 6 + rng() * 88, y: 10 + rng() * 78, r: 1.1 + rng() * 2.6 }));
    const links = [];
    for (let i = 0; i < nodes.length; i++) {
      const d = nodes.map((n, j) => ({ j, dist: (n.x - nodes[i].x) ** 2 + (n.y - nodes[i].y) ** 2 })).filter((o) => o.j !== i).sort((a, b) => a.dist - b.dist);
      links.push([i, d[0].j]); if (d[1] && rng() > 0.35) links.push([i, d[1].j]);
    }
    const orbs = Array.from({ length: 2 }, () => ({ x: rng() * 100, y: rng() * 88, r: 20 + rng() * 26 }));
    return { h1, h2, h3, nodes, links, orbs, uid: base.toString(36) };
  }, [seed]);

  const { h1, h2, h3, nodes, links, orbs, uid } = art;
  return (
    <svg viewBox="0 0 100 88" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${h1} 68% 20%)`} />
          <stop offset="0.55" stopColor={`hsl(${h2} 60% 16%)`} />
          <stop offset="1" stopColor={`hsl(${h3} 55% 12%)`} />
        </linearGradient>
        <radialGradient id={`orb${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={`hsl(${h2} 90% 62%)`} stopOpacity="0.55" />
          <stop offset="1" stopColor={`hsl(${h2} 90% 62%)`} stopOpacity="0" />
        </radialGradient>
        <filter id={`blur${uid}`}><feGaussianBlur stdDeviation="6" /></filter>
      </defs>

      <rect width="100" height="88" fill={`url(#bg${uid})`} />
      {orbs.map((o, i) => (
        <circle key={`o${i}`} cx={o.x} cy={o.y} r={o.r} fill={`url(#orb${uid})`} filter={`url(#blur${uid})`}>
          {animate && <animate attributeName="opacity" values="0.75;1;0.75" dur={`${5 + i * 2}s`} repeatCount="indefinite" />}
        </circle>
      ))}
      <g stroke="#fff" strokeOpacity="0.04" strokeWidth="0.3">
        {[20, 40, 60, 80].map((x) => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="88" />)}
        {[22, 44, 66].map((y) => <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} />)}
      </g>
      <g stroke={`hsl(${h2} 85% 72%)`} strokeOpacity="0.35" strokeWidth="0.4">
        {links.map(([a, b], i) => <line key={`l${i}`} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} />)}
      </g>
      {nodes.map((n, i) => (
        <circle key={`n${i}`} cx={n.x} cy={n.y} r={n.r} fill={`hsl(${h2} 90% ${70 + (i % 3) * 6}%)`} fillOpacity="0.9">
          {animate && i % 2 === 0 && <animate attributeName="r" values={`${n.r};${n.r * 1.5};${n.r}`} dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />}
        </circle>
      ))}
      {glyph && (
        <text x="92" y="80" textAnchor="end" fontSize="26" fontWeight="800" fill="#fff" fillOpacity="0.10" fontFamily="ui-sans-serif, system-ui">{glyph}</text>
      )}
    </svg>
  );
}

export default GenerativeArt;