import { useEffect, useState } from "react";

/**
 * RollingNumber — odometer-style number. Each digit sits in a vertical reel (0–9) that
 * translates to its value, so digits visibly "scroll" into place on load and whenever the
 * value changes. Large values are abbreviated with K / L (lakh) / M / B and an optional "+".
 *
 * Props:
 *   value    number to display
 *   prefix   e.g. "$" (rendered static, not rolled)
 *   plus     append "+" for values ≥ 1000 (used for baseline-inclusive totals)
 *   decimals override decimal places for the abbreviated unit
 */

let _injected = false;
function ensureStyles() {
  if (_injected || typeof document === "undefined") return;
  _injected = true;
  const el = document.createElement("style");
  el.textContent = `
  .rn{display:inline-flex;align-items:flex-start;font-variant-numeric:tabular-nums;line-height:1;}
  .rn-d{display:inline-block;height:1em;overflow:hidden;position:relative;}
  .rn-reel{display:flex;flex-direction:column;will-change:transform;
    transition:transform .95s cubic-bezier(.22,1,.36,1);}
  .rn-c{height:1em;display:flex;align-items:center;justify-content:center;}
  .rn-s{display:inline-block;}`;
  document.head.appendChild(el);
}

function trim(v, dp) {
  return v.toFixed(dp).replace(/\.?0+$/, "");
}

export function abbreviate(n, plus = false, decimals) {
  n = Number(n) || 0;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  let out;
  if (abs < 1e3) out = String(Math.round(abs));
  else if (abs < 1e5) out = trim(abs / 1e3, decimals ?? 1) + "K";   // 1K – 99.9K
  else if (abs < 1e6) out = trim(abs / 1e5, decimals ?? 2) + "L";   // 1L – 9.99L (lakh)
  else if (abs < 1e9) out = trim(abs / 1e6, decimals ?? 2) + "M";   // 1M – 999M
  else out = trim(abs / 1e9, decimals ?? 2) + "B";
  return sign + out + (plus && abs >= 1000 ? "+" : "");
}

function Reel({ d, idx }) {
  // small cascade so higher-place digits settle a touch later
  return (
    <span className="rn-d">
      <span className="rn-reel" style={{ transform: `translateY(-${d}em)`, transitionDelay: `${idx * 0.05}s` }}>
        {Array.from({ length: 10 }, (_, i) => (
          <span className="rn-c" key={i}>{i}</span>
        ))}
      </span>
    </span>
  );
}

export default function RollingNumber({ value, prefix = "", plus = false, decimals, className = "" }) {
  ensureStyles();
  const target = (prefix || "") + abbreviate(value, plus, decimals);

  // Start every digit at 0, then roll to the real value on the next frame so the
  // reels animate on first paint (not just on later updates).
  const [shown, setShown] = useState(() => target.replace(/[0-9]/g, "0"));
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  let digitIdx = -1;
  return (
    <span className={`rn ${className}`} aria-label={target}>
      {shown.split("").map((ch, i) => {
        if (ch >= "0" && ch <= "9") {
          digitIdx++;
          return <Reel key={i} d={Number(ch)} idx={digitIdx} />;
        }
        return <span className="rn-s" key={i}>{ch}</span>;
      })}
    </span>
  );
}