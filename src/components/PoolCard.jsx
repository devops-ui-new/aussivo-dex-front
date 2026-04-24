import { Link } from "react-router-dom";

const STRATEGIES = {
  0: [
    { name: "Aave V3", pct: 40, color: "#B6509E" },
    { name: "Compound", pct: 30, color: "#00D395" },
    { name: "Reserve", pct: 30, color: "#3B82F6" },
  ],
  1: [
    { name: "Aave V3", pct: 35, color: "#B6509E" },
    { name: "Curve", pct: 25, color: "#FF6B6B" },
    { name: "GMX GLP", pct: 20, color: "#4A9EED" },
    { name: "Reserve", pct: 20, color: "#64748B" },
  ],
  2: [
    { name: "GMX GLP", pct: 30, color: "#4A9EED" },
    { name: "Curve/Convex", pct: 25, color: "#FF6B6B" },
    { name: "Funding Arb", pct: 25, color: "#F59E0B" },
    { name: "Reserve", pct: 20, color: "#64748B" },
  ],
  3: [
    { name: "Venus", pct: 40, color: "#F0B90B" },
    { name: "PancakeSwap", pct: 30, color: "#D1884F" },
    { name: "Reserve", pct: 30, color: "#3B82F6" },
  ],
  4: [
    { name: "Venus", pct: 30, color: "#F0B90B" },
    { name: "Alpaca Finance", pct: 25, color: "#6DC6B1" },
    { name: "Funding Arb", pct: 25, color: "#F59E0B" },
    { name: "Reserve", pct: 20, color: "#64748B" },
  ],
};

const INVESTORS = { 0: "2.4K", 1: "1.8K", 2: "920", 3: "1.5K", 4: "780" };
const POPULARITY = { 0: "#1", 1: "#2", 2: "#4", 3: "#3", 4: "#5" };
const DESCS = {
  0: "Flexible USDC staking across top lending protocols, weighted by TVL",
  1: "30-day locked vault with diversified DeFi lending and LP strategies",
  2: "High-yield 90-day vault targeting aggressive DeFi farming returns",
  3: "Flexible USDT staking on BSC-native protocols, weighted by yield",
  4: "60-day USDT vault combining BSC lending with funding rate arbitrage",
};

export default function PoolCard({ pool, variant = "default" }) {
  const strategies = STRATEGIES[pool.id] || STRATEGIES[0];
  const lockLabel = pool.lockDays > 0 ? `${pool.lockDays}d Lock` : "Flexible";
  const isPositive = parseFloat(pool.apy) > 0;
  const tvlNum = Number(pool.total_staked) / 1e6;
  const capNum = Number(pool.capacity) / 1e6;
  const capPct = capNum > 0 ? ((tvlNum / capNum) * 100).toFixed(2) : "0";
  const isHomeDark = variant === "home-dark";

  const cardClass = isHomeDark
    ? "block rounded-2xl border border-brand/45 p-4 bg-[linear-gradient(100deg,rgba(6,10,15,0.98)_35%,rgba(7,56,34,0.92)_100%)] shadow-[0_0_24px_rgba(0,230,118,0.12)] hover:border-brand/70 transition-all duration-300 group"
    : "block bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-brand/5 transition-all duration-300 group";
  const titleClass = isHomeDark ? "text-slate-100" : "text-gray-900 group-hover:text-brand-dark";
  const apyLabelClass = isHomeDark ? "text-slate-400" : "text-gray-400";
  const percentClass = isHomeDark ? "text-slate-300" : "text-gray-500";
  const statsClass = isHomeDark ? "text-slate-400" : "text-gray-500";
  const statsStrongClass = isHomeDark ? "text-slate-100" : "text-gray-700";
  const descClass = isHomeDark ? "text-slate-400" : "text-gray-400";
  const footerBorder = isHomeDark ? "border-brand/20" : "border-gray-100";
  const moreDetailsClass = isHomeDark ? "text-brand" : "text-brand-dark";

  return (
    <Link to={`/pool/${pool.id}`} className={cardClass}>
      {/* Header Row */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-display font-medium text-[1.7rem] leading-none transition-colors ${titleClass}`}>{pool.name}</h3>
        <div className="flex items-center gap-1.5">
          <span className={`font-display font-bold text-lg ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
            {isPositive ? "▲" : "▼"} {pool.apy}%
          </span>
          <span className={`text-sm font-medium ${apyLabelClass}`}>APY</span>
        </div>
      </div>

      {/* Strategy Icons Row */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {strategies.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: s.color }}>
              {s.name.slice(0, 2).toUpperCase()}
            </div>
            <span className={`text-sm ${percentClass}`}>{s.pct}%</span>
          </div>
        ))}
      </div>

      {/* Distribution Bar */}
      <div className="flex h-2 rounded-full overflow-hidden mb-4">
        {strategies.map((s, i) => (
          <div key={i} style={{ width: `${s.pct}%`, background: s.color }} className="first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>

      {/* Stats Row */}
      <div className={`flex items-center justify-between text-xs mb-3 ${statsClass}`}>
        <div className="flex items-center gap-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span>Investors: <strong className={statsStrongClass}>{INVESTORS[pool.id] || "500"}</strong></span>
        </div>
        <div className="flex items-center gap-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span>TVL: <strong className={statsStrongClass}>${tvlNum > 1000 ? `${(tvlNum / 1000).toFixed(1)}K` : tvlNum.toFixed(0)}</strong> ({capPct}%)</span>
        </div>
        <div className="flex items-center gap-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          <span>Popularity: <strong className={statsStrongClass}>{POPULARITY[pool.id] || "#6"}</strong></span>
        </div>
      </div>

      {/* Description */}
      <p className={`text-xs mb-3 ${descClass}`}>{DESCS[pool.id] || "Curated stablecoin yield vault"}</p>

      {/* Footer */}
      <div className={`flex items-center justify-between pt-3 border-t ${footerBorder}`}>
        <div className="flex gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium border ${isHomeDark ? "border-blue-500/50 bg-blue-500/10 text-blue-400" : pool.assetSymbol === "USDC" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
            {pool.assetSymbol}
          </span>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium border ${isHomeDark ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : pool.lockDays > 0 ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"}`}>
            {lockLabel}
          </span>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium border ${isHomeDark ? "border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-400" : "bg-purple-50 text-purple-600"}`}>
            {pool.apyMonthly}%/mo
          </span>
        </div>
        <span className={`text-sm font-semibold group-hover:translate-x-1 transition-transform ${moreDetailsClass}`}>
          More Details →
        </span>
      </div>
    </Link>
  );
}
