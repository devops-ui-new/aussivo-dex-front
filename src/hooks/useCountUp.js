import { useEffect, useRef, useState } from "react";

/**
 * useCountUp — animate a number UP to `target`.
 *
 * On first mount it counts from 0 → target (fast, eased) so the number is visibly
 * "rolling up". On later changes (e.g. live demo drift) it animates from the previous
 * value → the new one, so it ticks smoothly without snapping back to 0.
 *
 * @param {number} target   value to animate to
 * @param {number} duration ms (default 1000 — quick & lively)
 * @returns {number} current animated value
 */
export function useCountUp(target, duration = 1000) {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);          // start the very first animation from 0
  const rafRef = useRef(null);

  useEffect(() => {
    const to = Number(target) || 0;
    const from = Number(fromRef.current) || 0;
    if (to === from) { setVal(to); return; }

    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setVal(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
        setVal(to);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return val;
}