import { API } from "../config/api";
import { useEffect, useState } from "react";

export default function StatsBar() {
  // API imported from config
  const [stats, setStats] = useState({ tvl: "0", activePools: 0, totalUsers: 0, totalDeposits: 0 });

  useEffect(() => {
    fetch(`${API}/api/stats`).then(r => r.json()).then(setStats).catch(() => {});
    const iv = setInterval(() => {
      fetch(`${API}/api/stats`).then(r => r.json()).then(setStats).catch(() => {});
    }, 10000);
    return () => clearInterval(iv);
  }, [API]);

  const items = [
    { label: "Total Value Locked", value: `$${Number(stats.tvl).toLocaleString()}` },
    { label: "Active Vaults", value: stats.activePools },
    { label: "Active Users", value: stats.totalUsers },
    { label: "Transactions Executed", value: stats.totalDeposits },
  ];

  return (
    <div className="relative w-full bg-black/35">
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00e67640] to-transparent" />
      <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#00e67640] to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-3 bottom-3 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[#00e67630] to-transparent md:hidden" />
      <div className="pointer-events-none absolute top-1/2 left-6 right-6 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-[#00e6762a] to-transparent md:hidden" />

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
            <div className="text-3xl md:text-5xl font-display font-bold text-slate-50 leading-none">{item.value}</div>
            <div className="text-xs md:text-base text-slate-300 mt-3">{item.label}</div>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
