import { API } from "../config/api";
import { useEffect, useState } from "react";
import PoolCard from "../components/PoolCard";
import ActivityFeed from "../components/ActivityFeed";
import { PoweredBy } from "../components/ProtocolIcons";

export default function Pools() {
  // API imported from config
  const [pools, setPools] = useState([]);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("popularity");
  const [search, setSearch] = useState("");

  // Demo mode: gently animate sample metrics upward so the walkthrough feels live.
  // Off by default; when on, a visible "Sample data" badge is shown (see below).
  const DEMO = import.meta.env.VITE_DEMO_MODE === "true";

  useEffect(() => {
    fetch(`${API}/api/pools`).then(r => r.json()).then(setPools).catch(() => {});
  }, []);

  useEffect(() => {
    if (!DEMO) return;
    const t = setInterval(() => {
      setPools(prev => prev.map(p => {
        // small, bounded, never-decreasing drift (illustrative only)
        const users = Number(p.totalUsers || 0) + (Math.random() < 0.5 ? Math.floor(Math.random() * 2) : 0);
        const staked = Number(p.total_staked ?? p.totalStaked ?? 0) * (1 + Math.random() * 0.0006);
        return { ...p, totalUsers: users, total_staked: staked, totalStaked: staked };
      }));
    }, 5000);
    return () => clearInterval(t);
  }, [DEMO]);

  // Refresh the illustrative allocation from the BACKEND so the card weights breathe and
  // constituents rotate, while preserving the locally-drifted TVL/investor metrics above.
  useEffect(() => {
    if (!DEMO) return;
    const pull = () => {
      fetch(`${API}/api/pools`)
        .then(r => r.json())
        .then(fresh => {
          const byId = new Map(fresh.map(f => [String(f.id), f]));
          setPools(prev => prev.map(p => {
            const f = byId.get(String(p.id));
            return f ? { ...p, strategies: f.strategies, allocationMeta: f.allocationMeta } : p;
          }));
        })
        .catch(() => {});
    };
    const t = setInterval(pull, 6000);
    return () => clearInterval(t);
  }, [DEMO]);

  let filtered = pools.filter(p => {
    if (!p.active) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "usdc") return p.assetSymbol === "USDC";
    if (filter === "usdt") return p.assetSymbol === "USDT";
    if (filter === "flexible") return p.lock_period === 0;
    if (filter === "locked") return p.lock_period > 0;
    if (filter === "top") return parseFloat(p.apy || 0) >= 12;
    return true;
  });

  if (sort === "apy") filtered.sort((a, b) => parseFloat(b.apy || 0) - parseFloat(a.apy || 0));
  if (sort === "tvl") filtered.sort((a, b) => Number(b.total_staked ?? b.totalStaked ?? 0) - Number(a.total_staked ?? a.totalStaked ?? 0));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-brand/[0.07] via-surface-1/40 to-transparent p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/[0.08] px-3 py-1 text-[11px] font-semibold text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" /> Live on-chain vaults
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-white mb-2">
            Yield <span className="bg-gradient-to-r from-brand to-emerald-300 bg-clip-text text-transparent">Vaults</span>
          </h1>
          <p className="text-slate-400 max-w-2xl">
            Expert-curated yield strategies across DeFi protocols. Each vault deploys capital into diversified, audited strategies to maximize risk-adjusted returns.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
            {[
              { t: "Non-custodial", d: "M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z" },
              { t: "On-chain verifiable", d: "M9 12l2 2 4-4M12 3l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z" },
              { t: "Audited strategies", d: "M20 6L9 17l-5-5" },
            ].map((b) => (
              <span key={b.t} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-slate-300">
                <svg className="h-3.5 w-3.5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={b.d} /></svg>
                {b.t}
              </span>
            ))}
          </div>
          {pools.length > 0 && (
            <PoweredBy strategies={pools.flatMap((p) => p.strategies || [])} size={22} className="mt-5" />
          )}
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="absolute left-3.5 top-1/2 -translate-y-1/2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vaults..."
            className="w-full bg-[#0d1324] border border-surface-4/50 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/10" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-6 mb-6 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-slate-400 font-medium">Filter By:</span>
          {[
            { key: "all", label: "All" },
            { key: "top", label: "Top Gainers" },
            { key: "usdc", label: "USDC" },
            { key: "usdt", label: "USDT" },
            { key: "flexible", label: "Flexible" },
            { key: "locked", label: "Locked" },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                filter === f.key ? "bg-brand text-[#060b18] border-brand" : "bg-[#0d1324] text-slate-300 border-surface-4/50 hover:border-brand/40"
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-sm text-slate-400 font-medium">Sort By:</span>
          {[
            { key: "popularity", label: "Popularity" },
            { key: "apy", label: "APY" },
            { key: "tvl", label: "TVL" },
          ].map(s => (
            <button key={s.key} onClick={() => setSort(s.key)}
              className={`text-sm font-medium px-2 py-1 ${sort === s.key ? "text-brand font-bold" : "text-slate-500 hover:text-slate-300"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid md:grid-cols-2 gap-5">
        {filtered.map(pool => <PoolCard key={pool.id} pool={pool} variant="home-dark" />)}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 text-slate-500">
          <p className="text-lg mb-2">No vaults found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div>
      )}

      <div className="mt-8">
        <ActivityFeed limit={8} />
      </div>
    </div>
  );
}