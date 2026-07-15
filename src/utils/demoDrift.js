// demoDrift — deterministic, wall-clock-based drift for the illustrative demo stats.
//
// Why time-based: the value is computed from how much real time has elapsed since a fixed
// epoch, NOT from server or in-memory state. So after a restart, redeploy, or page reload it
// resumes exactly where the clock puts it — it never "reverts" to a starting number, and a
// returning visitor always sees it equal-or-higher.
//
// This is ONLY used when VITE_DEMO_MODE === "true", behind a visible "Demo preview" badge, so
// it is clearly presented as illustrative sample data — never as real platform activity.

const EPOCH = Date.UTC(2026, 6, 2); // recent anchor: drift starts ~0 now and grows from here.
                                    // Fixed date ⇒ survives restarts/redeploys AND stays near baseline.

// ── TVL: strictly monotonic, presentation-safe ──────────────────────────────
// The old version added a sine "wiggle" (±~$14k) which made the number tick DOWN and
// flicker on refresh (4.18 → 4.16 → 4.18). Removed. TVL now only ever climbs: it is a
// pure function of wall-clock time, so every refresh at a given instant shows the same
// value and any later refresh is equal-or-higher — it can never go down or reset.
const TVL_EPOCH = Date.UTC(2026, 6, 15);       // fixed recent anchor (15 Jul 2026, 00:00 UTC)
const TVL_FLOOR = 4_170_000;                    // never display below this known-good figure
const TVL_PER_3H = 10_000;                       // +$0.01M every 3 hours (tune freely)
const TVL_RATE_PER_SEC = TVL_PER_3H / (3 * 3600);// → strictly increasing creep

// Tunables (medium liveliness, modest growth). Adjust freely — labeled demo view only.
const TX_PER_SEC = 1 / 600;      // ~1 new transaction every 10 min (monotonic, ~150/day)
const USERS_PER_SEC = 1 / 3600;  // ~1 new user every hour (monotonic, ~24/day)

/**
 * @param {{tvl:number, users:number, tx:number}} base  baseline+real starting values
 * @returns {{tvl:number, users:number, tx:number}} drifted values (net-increasing over time)
 */
export function demoDrift(base, now = Date.now()) {
  const t = Math.max(0, (now - EPOCH) / 1000); // seconds since epoch

  // Transactions & users only ever climb (a tx count that ticks down looks broken).
  const txGrowth = Math.floor(t * TX_PER_SEC);
  const userGrowth = Math.floor(t * USERS_PER_SEC);

  // TVL: floor (or real, whichever is higher) + a strictly-increasing time creep.
  // No wiggle ⇒ it never decreases and never flickers between refreshes.
  const tvlT = Math.max(0, (now - TVL_EPOCH) / 1000);
  const tvl = Math.max(Number(base.tvl) || 0, TVL_FLOOR) + tvlT * TVL_RATE_PER_SEC;

  return {
    tvl,
    users: base.users + userGrowth,
    tx: base.tx + txGrowth,
  };
}