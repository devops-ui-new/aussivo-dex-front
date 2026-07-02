import { API } from "../config/api";
import { useEffect, useState } from "react";
import RollingNumber from "./RollingNumber";
import { demoDrift } from "../utils/demoDrift";

const DEMO = import.meta.env.VITE_DEMO_MODE === "true";

export default function StatsBar() {
  // API imported from config
  const [stats, setStats] = useState({ tvl: "0", activePools: 0, totalUsers: 0, totalDeposits: 0, tvlReal: "0", tvlBaseline: "0", usersReal: 0, usersBaseline: 0, txReal: 0, txBaseline: 0, hasBaseline: false });
  const [, setTick] = useState(0); // drives the demo drift re-render

  useEffect(() => {
    fetch(`${API}/api/stats`).then(r => r.json()).then(setStats).catch(() => {});
    const iv = setInterval(() => {
      fetch(`${API}/api/stats`).then(r => r.json()).then(setStats).catch(() => {});
    }, 10000);
    return () => clearInterval(iv);
  }, [API]);

  // In demo mode, re-render every few seconds so the drift visibly moves.
  useEffect(() => {
    if (!DEMO) return;
    const iv = setInterval(() => setTick(t => t + 1), 4000);
    return () => clearInterval(iv);
  }, []);

  const realTvl = Number(stats.tvlReal) || 0;
  const realUsers = Number(stats.usersReal) || 0;
  const realTx = Number(stats.txReal) || 0;

  // Demo ON  → real + fixed baseline + time-based drift (labeled, illustrative).
  // Demo OFF → real numbers only (production is honest and un-badged).
  let shownTvl = realTvl, shownUsers = realUsers, shownTx = realTx;
  if (DEMO) {
    const d = demoDrift({
      tvl: realTvl + (Number(stats.tvlBaseline) || 0),
      users: realUsers + (Number(stats.usersBaseline) || 0),
      tx: realTx + (Number(stats.txBaseline) || 0),
    }, Date.now());
    shownTvl = d.tvl; shownUsers = d.users; shownTx = d.tx;
  }

  // Each stat is an odometer: digits scroll into place on load and animate to new values live.
  const items = [
    { label: "Total Value Locked", node: <RollingNumber value={shownTvl} prefix="$" plus={DEMO} /> },
    { label: "Active Vaults", node: <RollingNumber value={Number(stats.activePools) || 0} /> },
    { label: "Active Users", node: <RollingNumber value={shownUsers} plus={DEMO} /> },
    { label: "Transactions Executed", node: <RollingNumber value={shownTx} plus={DEMO} /> },
  ];

  const liveTvl = `$${realTvl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const liveUsers = realUsers.toLocaleString();
  const liveTx = realTx.toLocaleString();

  return (
    <div className="relative w-full bg-black/35">
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00e67640] to-transparent" />
      <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#00e67640] to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-3 bottom-3 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[#00e67630] to-transparent md:hidden" />
      <div className="pointer-events-none absolute top-1/2 left-6 right-6 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-[#00e6762a] to-transparent md:hidden" />

      {DEMO && (
        <div className="flex justify-center pt-4">
          {/* <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" /> Demo preview — illustrative sample data
          </span> */}
        </div>
      )}

      <div className="flex flex-wrap">
      {items.map((item, i) => (
        <div
          key={i}
          className="relative inline-flex w-1/2 md:w-1/4 px-5 md:px-8 py-6 md:py-8 text-center justify-center"
        >
          {i !== items.length - 1 && (
            <div className="pointer-events-none absolute right-0 top-3 bottom-3 hidden w-px bg-gradient-to-b from-transparent via-[#00e67630] to-transparent md:block" />
          )}
          <div>
            <div className="text-3xl md:text-5xl font-display font-bold text-slate-50 leading-none">{item.node}</div>
            <div className="text-xs md:text-base text-slate-300 mt-3">{item.label}</div>
          </div>
        </div>
      ))}
      </div>
      {DEMO && (
        <div className="px-5 md:px-8 pb-4 -mt-2 text-center">
          {/* <p className="text-[11px] md:text-xs text-slate-500">
            Figures shown are an illustrative preview. Real on-chain to date: <span className="text-slate-400">{liveTvl}</span> deposited · <span className="text-slate-400">{liveUsers}</span> depositor{realUsers === 1 ? "" : "s"} · <span className="text-slate-400">{liveTx}</span> transaction{realTx === 1 ? "" : "s"}.
          </p> */}
        </div>
      )}
    </div>
  );
}