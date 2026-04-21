import { API } from "../config/api";
import { useEffect, useState } from "react";
import PoolCard from "../components/PoolCard";

export default function Pools() {
  // API imported from config
  const [pools, setPools] = useState([]);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("popularity");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`${API}/api/pools`).then(r => r.json()).then(setPools).catch(() => {});
  }, []);

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
  if (sort === "tvl") filtered.sort((a, b) => Number(b.total_staked) - Number(a.total_staked));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-display font-bold text-3xl text-white mb-2">Yield Vaults</h1>
      <p className="text-gray-500 mb-8 max-w-xl">
        Expert-curated yield strategies across DeFi protocols. Each vault deploys capital into diversified, audited strategies to maximize risk-adjusted returns.
      </p>

      {/* Search */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="absolute left-3.5 top-1/2 -translate-y-1/2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vaults..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-6 mb-6 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-gray-500 font-medium">Filter By:</span>
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
                filter === f.key ? "bg-brand text-white border-brand" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-sm text-gray-500 font-medium">Sort By:</span>
          {[
            { key: "popularity", label: "Popularity" },
            { key: "apy", label: "APY" },
            { key: "tvl", label: "TVL" },
          ].map(s => (
            <button key={s.key} onClick={() => setSort(s.key)}
              className={`text-sm font-medium px-2 py-1 ${sort === s.key ? "text-brand-dark font-bold" : "text-gray-400 hover:text-gray-600"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid md:grid-cols-2 gap-5">
        {filtered.map(pool => <PoolCard key={pool.id} pool={pool} />)}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">No vaults found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
}
