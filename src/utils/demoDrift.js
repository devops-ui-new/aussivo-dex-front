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

// Tunables (medium liveliness, modest growth). Adjust freely — labeled demo view only.
const TX_PER_SEC = 1 / 600;      // ~1 new transaction every 10 min (monotonic, ~150/day)
const USERS_PER_SEC = 1 / 3600;  // ~1 new user every hour (monotonic, ~24/day)
const TVL_CREEP_PER_SEC = 0.02;  // slow upward creep (~$1.7k/day)

/**
 * @param {{tvl:number, users:number, tx:number}} base  baseline+real starting values
 * @returns {{tvl:number, users:number, tx:number}} drifted values (net-increasing over time)
 */
export function demoDrift(base, now = Date.now()) {
  const t = Math.max(0, (now - EPOCH) / 1000); // seconds since epoch

  // Transactions & users only ever climb (a tx count that ticks down looks broken).
  const txGrowth = Math.floor(t * TX_PER_SEC);
  const userGrowth = Math.floor(t * USERS_PER_SEC);

  // TVL: slow upward creep + gentle up/down wiggle → visibly alive, net positive.
  const creep = t * TVL_CREEP_PER_SEC;
  const wiggle = Math.sin(t / 8) * 9000 + Math.sin(t / 29) * 5000; // ±~14k, moves the 2-dp "M" display
  const tvl = Math.max(0, base.tvl + creep + wiggle);

  return {
    tvl,
    users: base.users + userGrowth,
    tx: base.tx + txGrowth,
  };
}