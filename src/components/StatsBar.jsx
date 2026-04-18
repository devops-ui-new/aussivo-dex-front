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
    { label: "Total Value Locked", value: `$${Number(stats.tvl).toLocaleString()}`, icon: "🔒" },
    { label: "Active Vaults", value: stats.activePools, icon: "📦" },
    { label: "Total Users", value: stats.totalUsers, icon: "👥" },
    { label: "Transactions", value: stats.totalDeposits, icon: "⚡" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item, i) => (
        <div key={i} className="glass px-5 py-4">
          <div className="text-xs text-muted mb-1.5 font-medium uppercase tracking-wider">{item.label}</div>
          <div className="text-xl font-display font-bold">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
