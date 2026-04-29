import { Link } from "react-router-dom";

export default function PoolCard({ pool, variant = "default" }) {
  const fallbackColors = ["#B6509E", "#00D395", "#3B82F6", "#F59E0B", "#FF6B6B", "#6DC6B1"];
  const strategies = (pool.strategies || []).map((s, i) => ({
    name: s.name,
    pct: Number(s.allocation ?? s.pct ?? 0),
    color: s.color || fallbackColors[i % fallbackColors.length],
  }));
  const lockLabel = pool.lockDays > 0 ? `${pool.lockDays}d Lock` : "Flexible";
  const monthlyApy = pool.apyMonthly ?? pool.displayApyMonthly ?? 0;
  const isPositive = parseFloat(pool.apy || 0) > 0;
  const tvlNum = Number(pool.total_staked ?? pool.totalStaked ?? 0) / 1e6;
  const capNum = Number(pool.capacity) / 1e6;
  const capPct = capNum > 0 ? ((tvlNum / capNum) * 100).toFixed(2) : "0";
  const isHomeDark = variant === "home-dark";

  const cardClass = isHomeDark
    ? "block rounded-2xl border border-brand/35 p-4 bg-[linear-gradient(0deg,rgba(10,10,10,0.7),rgba(10,10,10,0.7)),linear-gradient(106.04deg,rgba(0,0,0,0.3)_40.12%,rgba(56,255,126,0.09)_100%)] shadow-[0_0_18px_rgba(0,230,118,0.08)] hover:border-brand/55 transition-all duration-300 group"
    : "block bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-brand/5 transition-all duration-300 group";
  const titleClass = isHomeDark ? "text-slate-100" : "text-gray-900 group-hover:text-brand-dark";
  const apyLabelClass = isHomeDark ? "text-slate-400" : "text-gray-400";
  const percentClass = isHomeDark ? "text-slate-300" : "text-gray-500";
  const statsClass = isHomeDark ? "text-slate-400" : "text-gray-500";
  const statsStrongClass = isHomeDark ? "text-slate-100" : "text-gray-700";
  const descClass = isHomeDark ? "text-slate-400" : "text-gray-400";
  const footerBorder = isHomeDark ? "border-brand/20" : "border-gray-100";
  const moreDetailsClass = isHomeDark ? "text-brand" : "text-brand-dark";

  const investorLabel = pool.investorsLabel || (pool.totalUsers != null ? Number(pool.totalUsers).toLocaleString() : "0");
  const popularityLabel = pool.popularityRank || "—";

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
          <span>Investors: <strong className={statsStrongClass}>{investorLabel}</strong></span>
        </div>
        <div className="flex items-center gap-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span>TVL: <strong className={statsStrongClass}>${tvlNum > 1000 ? `${(tvlNum / 1000).toFixed(1)}K` : tvlNum.toFixed(0)}</strong> ({capPct}%)</span>
        </div>
        <div className="flex items-center gap-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          <span>Popularity: <strong className={statsStrongClass}>{popularityLabel}</strong></span>
        </div>
      </div>

      {/* Description */}
      <p className={`text-xs mb-3 ${descClass}`}>{pool.description || "Curated stablecoin yield vault"}</p>

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
            {monthlyApy}%/mo
          </span>
        </div>
        <span className={`text-sm font-semibold group-hover:translate-x-1 transition-transform ${moreDetailsClass}`}>
          More Details →
        </span>
      </div>
    </Link>
  );
}
