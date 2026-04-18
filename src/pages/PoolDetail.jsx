import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import toast from "react-hot-toast";

const STRATEGIES = {
  0: [ { name: "Aave V3", pct: 40, color: "#B6509E", apy: "4.2%" }, { name: "Compound", pct: 30, color: "#00D395", apy: "3.8%" }, { name: "Reserve", pct: 30, color: "#3B82F6", apy: "—" } ],
  1: [ { name: "Aave V3", pct: 35, color: "#B6509E", apy: "4.2%" }, { name: "Curve/Convex", pct: 25, color: "#FF6B6B", apy: "8.5%" }, { name: "GMX GLP", pct: 20, color: "#4A9EED", apy: "14.1%" }, { name: "Reserve", pct: 20, color: "#64748B", apy: "—" } ],
  2: [ { name: "GMX GLP", pct: 30, color: "#4A9EED", apy: "14.1%" }, { name: "Curve/Convex", pct: 25, color: "#FF6B6B", apy: "8.5%" }, { name: "Funding Rate Arb", pct: 25, color: "#F59E0B", apy: "22.3%" }, { name: "Reserve", pct: 20, color: "#64748B", apy: "—" } ],
  3: [ { name: "Venus Protocol", pct: 40, color: "#F0B90B", apy: "5.1%" }, { name: "PancakeSwap", pct: 30, color: "#D1884F", apy: "7.2%" }, { name: "Reserve", pct: 30, color: "#3B82F6", apy: "—" } ],
  4: [ { name: "Venus Protocol", pct: 30, color: "#F0B90B", apy: "5.1%" }, { name: "Alpaca Finance", pct: 25, color: "#6DC6B1", apy: "9.8%" }, { name: "Funding Rate Arb", pct: 25, color: "#F59E0B", apy: "22.3%" }, { name: "Reserve", pct: 20, color: "#64748B", apy: "—" } ],
};

const INVESTORS = { 0: "2,400+", 1: "1,800+", 2: "920+", 3: "1,500+", 4: "780+" };
const REBALANCE = { 0: "Weekly", 1: "Bi-weekly", 2: "Weekly", 3: "Weekly", 4: "Bi-weekly" };

function DonutChart({ strategies }) {
  let cumulative = 0;
  const total = strategies.reduce((s, st) => s + st.pct, 0);
  const radius = 60, center = 80, stroke = 28;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg width="160" height="160" viewBox="0 0 160 160">
      {strategies.map((s, i) => {
        const dashLength = (s.pct / total) * circumference;
        const dashOffset = -((cumulative / total) * circumference);
        cumulative += s.pct;
        return (
          <circle key={i} cx={center} cy={center} r={radius} fill="none" stroke={s.color}
            strokeWidth={stroke} strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={dashOffset} transform={`rotate(-90 ${center} ${center})`} />
        );
      })}
      <circle cx={center} cy={center} r={radius - stroke / 2 + 2} fill="white" />
    </svg>
  );
}

function MiniChart() {
  const points = [];
  let val = 0;
  for (let i = 0; i < 30; i++) {
    val += (Math.random() - 0.35) * 0.4;
    val = Math.max(-1, Math.min(6, val));
    points.push(val);
  }
  const min = Math.min(...points), max = Math.max(...points);
  const w = 600, h = 200, pad = 20;
  const pts = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((p - min) / (max - min || 1)) * (h - 2 * pad);
    return `${x},${y}`;
  }).join(" ");
  const lastY = parseFloat(pts.split(" ").pop().split(",")[1]);
  const lastX = parseFloat(pts.split(" ").pop().split(",")[0]);
  const areaPath = `M${pad},${h - pad} L${pts.replace(/,/g, " ").split(" ").reduce((acc, v, i) => {
    if (i % 2 === 0) return [...acc, v];
    acc[acc.length - 1] += `,${v}`;
    return acc;
  }, []).join(" L")} L${lastX},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00e676" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#00e676" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map(i => {
        const y = pad + (i / 4) * (h - 2 * pad);
        const label = (max - (i / 4) * (max - min)).toFixed(1);
        return (<g key={i}><line x1={pad} y1={y} x2={w - pad} y2={y} stroke="#f0f0f0" strokeWidth="1" /><text x={w - pad + 8} y={y + 4} fontSize="11" fill="#999">{label}%</text></g>);
      })}
      <path d={areaPath} fill="url(#areaGrad)" />
      <polyline points={pts} fill="none" stroke="#00c853" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="5" fill="#00c853" stroke="white" strokeWidth="2" />
    </svg>
  );
}

export default function PoolDetail() {
  const { id } = useParams();
  const { API, account, token } = useWeb3();
  const navigate = useNavigate();
  const [pool, setPool] = useState(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("invest");
  const [timeframe, setTimeframe] = useState("1W");

  useEffect(() => { fetch(`${API}/api/pools/${id}`).then(r => r.json()).then(setPool).catch(() => {}); }, [API, id]);

  if (!pool) return <div className="max-w-6xl mx-auto px-6 py-20"><div className="h-[500px] shimmer rounded-2xl" /></div>;

  const strategies = STRATEGIES[pool.id] || STRATEGIES[0];
  const apy = (pool.apy_bps / 100).toFixed(1);
  const monthly = (pool.apy_bps / 100 / 12).toFixed(2);
  const lockLabel = pool.lockDays > 0 ? `${pool.lockDays} Days` : "Flexible";
  const earlyFee = (pool.early_exit_fee_bps / 100).toFixed(0);
  const projectedMonthly = amount ? (parseFloat(amount) * pool.apy_bps / 100 / 12).toFixed(2) : "0.00";
  const tvlNum = Number(pool.total_staked) / 1e6;
  const capNum = Number(pool.capacity) / 1e6;

  const handleDeposit = () => {
    if (!token) { toast.error("Please sign in first"); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error("Enter an amount"); return; }
    // Navigate to QR deposit page
    navigate(`/deposit/${pool._id || id}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="text-sm text-gray-400 mb-6">
        <Link to="/" className="hover:text-gray-600">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/pools" className="hover:text-gray-600">Vaults</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{pool.name}</span>
      </div>

      {/* ═══ HEADER ═══ */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900 mb-2">{pool.name}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              {strategies.slice(0, 3).map((s, i) => (
                <div key={i} className="w-6 h-6 rounded-full text-[8px] font-bold text-white flex items-center justify-center" style={{ background: s.color, marginLeft: i > 0 ? "-6px" : 0, zIndex: 3 - i, border: "2px solid white" }}>
                  {s.name.slice(0, 2)}
                </div>
              ))}
              {strategies.length > 3 && <span className="text-xs text-gray-400 ml-1">+{strategies.length - 3}</span>}
            </div>
            <span>👥 {INVESTORS[pool.id] || "500+"} investors</span>
            <span>Market Cap: ${capNum > 1000 ? `${(capNum / 1000).toFixed(0)}M` : `${capNum.toFixed(0)}K`} ({((tvlNum / capNum) * 100).toFixed(2)}%)</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`font-display font-bold text-lg ${parseFloat(apy) > 0 ? "text-emerald-500" : "text-red-500"}`}>▲ {apy}% APY</span>
            <span className="text-sm text-gray-400">({monthly}% / month)</span>
          </div>
        </div>
        <button className="text-sm text-gray-400 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50">☆ Watchlist</button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        {/* ═══ LEFT: Chart + Constituents ═══ */}
        <div className="lg:col-span-2 space-y-6">
          {/* Performance Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-gray-900">Performance</h3>
              <div className="flex bg-gray-50 rounded-lg p-1">
                {["1D", "1W", "1M", "3M", "6M", "1Y"].map(tf => (
                  <button key={tf} onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${timeframe === tf ? "bg-white shadow text-gray-900" : "text-gray-400 hover:text-gray-600"}`}>
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            <MiniChart />
          </div>

          {/* Constituents */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-display font-semibold text-gray-900 text-lg mb-6">Constituents</h3>
            <div className="grid md:grid-cols-5 gap-6">
              {/* Donut */}
              <div className="md:col-span-2 flex flex-col items-center">
                <DonutChart strategies={strategies} />
                <div className="flex flex-wrap gap-3 mt-4 justify-center">
                  {strategies.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
                      <span className="text-xs text-gray-500">{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="md:col-span-3">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b border-gray-100">
                      <th className="text-left pb-3 font-medium">Strategy</th>
                      <th className="text-left pb-3 font-medium">Yield</th>
                      <th className="text-left pb-3 font-medium">Allocation</th>
                      <th className="text-right pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strategies.map((s, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full text-[9px] font-bold text-white flex items-center justify-center" style={{ background: s.color }}>
                              {s.name.slice(0, 2)}
                            </div>
                            <span className="text-sm font-medium text-gray-800">{s.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 text-sm text-gray-600">{s.apy}</td>
                        <td className="py-3.5 text-sm font-semibold text-gray-800">{s.pct}%</td>
                        <td className="py-3.5 text-right">
                          <span className={`text-xs font-semibold ${s.name === "Reserve" ? "text-blue-500" : "text-emerald-500"}`}>
                            {s.name === "Reserve" ? "Liquid" : "▲ Active"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* How Constituents Are Decided + Fees */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">How Are Strategies Selected?</h4>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                The strategies in this vault are reviewed and rebalanced at regular intervals to maximize risk-adjusted returns.
              </p>
              <div className="flex gap-6 bg-gray-50 rounded-xl p-4">
                <div className="text-center">
                  <div className="text-xs text-gray-400">Last Rebalance</div>
                  <div className="text-sm font-bold text-gray-800 mt-1">01 Apr 2026</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400">Next Rebalance</div>
                  <div className="text-sm font-bold text-gray-800 mt-1">01 May 2026</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400">Frequency</div>
                  <div className="text-sm font-bold text-gray-800 mt-1">{REBALANCE[pool.id] || "Monthly"}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Fees</h4>
              <p className="text-sm text-gray-500 mb-4">100% transparent fee structure.</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Deposit", value: "Zero", sub: "No charges" },
                  { label: "Withdrawal", value: earlyFee > 0 ? `${earlyFee}%` : "Zero", sub: earlyFee > 0 ? "If early exit" : "No charges" },
                  { label: "Performance", value: "20%", sub: "On yield only" },
                ].map((f, i) => (
                  <div key={i} className="text-center p-3 bg-gray-50 rounded-xl">
                    <div className="text-xs text-gray-400 mb-1">{f.label}</div>
                    <div className="text-lg font-display font-bold text-gray-900">{f.value}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{f.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Vault Details */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Vault Parameters</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ["Min Deposit", `${(Number(pool.min_deposit) / 1e6).toLocaleString()} ${pool.assetSymbol}`],
                ["Max Deposit", `${(Number(pool.max_deposit) / 1e6).toLocaleString()} ${pool.assetSymbol}`],
                ["Lock Period", lockLabel],
                ["Capacity", `$${capNum > 1000 ? `${(capNum / 1000).toFixed(0)}M` : `${capNum.toFixed(0)}K`}`],
                ["Reward Cycle", "Real-time accrual"],
                ["Smart Contract", "Verified ✓"],
                ["Reserve Ratio", "20-30%"],
                ["Circuit Breaker", "Active ✓"],
              ].map(([k, v], i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-400 mb-1">{k}</div>
                  <div className="text-sm font-semibold text-gray-800">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Invest Panel ═══ */}
        <div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 sticky top-6">
            {/* Tabs */}
            <div className="flex mb-6 border-b border-gray-100">
              {["invest", "redeem"].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 pb-3 text-sm font-semibold capitalize transition-all ${tab === t ? "text-brand-dark border-b-2 border-brand" : "text-gray-400"}`}>
                  {t === "invest" ? "Invest" : "Redeem"}
                </button>
              ))}
            </div>

            {tab === "invest" ? (<>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Amount</span>
                  <span className="text-gray-400">Deposit via QR scan or wallet transfer</span>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3.5 pl-9 pr-4 text-lg font-display font-semibold text-gray-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" />
                </div>
                <div className="text-xs text-gray-400 mt-1.5">Min: ${(Number(pool.min_deposit) / 1e6).toLocaleString()} · Max: ${(Number(pool.max_deposit) / 1e6).toLocaleString()}</div>
              </div>

              <div className="flex items-center gap-2 bg-blue-50 rounded-xl p-3 mb-4">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                <span className="text-xs text-blue-600">Invest in this vault with your {pool.assetSymbol} holdings</span>
              </div>

              {amount && parseFloat(amount) > 0 && (
                <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Est. Monthly</span><span className="text-emerald-600 font-semibold">+${projectedMonthly}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Est. Yearly</span><span className="font-semibold">+${(projectedMonthly * 12).toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">APY</span><span className="font-semibold">{apy}%</span></div>
                </div>
              )}

              <button onClick={handleDeposit} disabled={loading}
                className="w-full py-3.5 rounded-xl font-display font-bold text-base transition-all disabled:opacity-50 bg-gradient-to-r from-brand-dark to-brand text-white hover:shadow-lg hover:shadow-brand/20">
                {loading ? "Processing..." : token ? "Deposit Now →" : "Sign In to Invest"}
              </button>
            </>) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 mb-4">Manage your redemptions from your <Link to="/portfolio" className="text-brand-dark font-semibold hover:underline">Portfolio</Link>.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
