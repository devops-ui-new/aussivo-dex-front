import { useEffect, useRef, useState } from "react";
import { API } from "../config/api";

/**
 * usePolledAllocation — keep a vault's illustrative allocation fresh from the BACKEND.
 *
 * The backend is the source of truth: it computes the deterministic, drifting target
 * allocation (see backend helpers/allocationModel.ts) and serves it at
 * `GET /api/pools/:id/allocation`. This hook polls that small endpoint so the donut and
 * table stay alive, and exposes a locally-ticking countdown to the next rebalance.
 *
 * @param {string}  poolId
 * @param {object}  [opts]
 * @param {boolean} [opts.enabled=true]   turn polling on/off
 * @param {number}  [opts.pollMs=4000]    how often to refresh from the backend
 * @param {Array}   [opts.initial=[]]     initial strategies (e.g. pool.strategies)
 * @param {object}  [opts.initialMeta]    initial allocationMeta from the pool payload
 * @returns {{ strategies, meta, msToNextRebalance, live }}
 */
export function usePolledAllocation(poolId, opts = {}) {
  const { enabled = true, pollMs = 4000, initial = [], initialMeta = null } = opts;

  const [strategies, setStrategies] = useState(initial);
  const [meta, setMeta] = useState(initialMeta);
  const [countdown, setCountdown] = useState(initialMeta?.msToNextRebalance ?? null);
  const nextAtRef = useRef(null); // wall-clock time of the next rebalance

  // Poll the backend for the current snapshot.
  useEffect(() => {
    if (!enabled || !poolId) return undefined;
    let cancelled = false;

    const pull = async () => {
      try {
        const r = await fetch(`${API}/api/pools/${poolId}/allocation`);
        const data = await r.json();
        if (cancelled || !data) return;
        if (Array.isArray(data.strategies)) setStrategies(data.strategies);
        if (data.meta) {
          setMeta(data.meta);
          if (typeof data.meta.msToNextRebalance === "number") {
            nextAtRef.current = Date.now() + data.meta.msToNextRebalance;
            setCountdown(data.meta.msToNextRebalance);
          }
        }
      } catch {
        /* transient network error — keep last snapshot */
      }
    };

    pull();
    const iv = setInterval(pull, pollMs);
    const onVis = () => { if (!document.hidden) pull(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [enabled, poolId, pollMs]);

  // Tick the countdown down locally between polls so it reads smoothly.
  useEffect(() => {
    if (!enabled || nextAtRef.current == null) return undefined;
    const iv = setInterval(() => {
      if (nextAtRef.current == null) return;
      setCountdown(Math.max(0, nextAtRef.current - Date.now()));
    }, 1000);
    return () => clearInterval(iv);
  }, [enabled, meta]);

  return { strategies, meta, msToNextRebalance: countdown, live: !!meta?.live };
}

export default usePolledAllocation;