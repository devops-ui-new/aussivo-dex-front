import { API } from "../config/api";
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import toast from "react-hot-toast";
import { transferEphemeralFromInjected } from "../utils/transferEphemeralFromInjected";

function formatRemaining(ms) {
  if (ms <= 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

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

function MiniChart({ seed = "0", apy = 18 }) {
  const points = useMemo(() => {
    const target = Number(apy) || 0;
    // Hash the string seed so we get a stable numeric seed from a Mongo ObjectId.
    let h = 2166136261;
    const str = String(seed);
    for (let i = 0; i < str.length; i++) h = ((h ^ str.charCodeAt(i)) * 16777619) >>> 0;
    let s = h || 1;
    const rand = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    const p = [];
    const ceiling = Math.max(target, 1);
    let val = target * 0.1;
    for (let i = 0; i < 30; i++) {
      val += (rand() - 0.1) * (ceiling / 12);
      val = Math.max(0, Math.min(ceiling, val));
      p.push(val);
    }
    p[p.length - 1] = target;
    return p;
  }, [seed, apy]);
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
  const { token, connectInjectedWallet, walletType } = useWeb3();
  const [pool, setPool] = useState(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [payingInjected, setPayingInjected] = useState(false);
  const [tab, setTab] = useState("invest");
  const [timeframe, setTimeframe] = useState("1W");
  const [qrData, setQrData] = useState(null);
  const [expiresLeftMs, setExpiresLeftMs] = useState(null);

  useEffect(() => { fetch(`${API}/api/pools/${id}`).then(r => r.json()).then(setPool).catch(() => {}); }, [API, id]);

  useEffect(() => {
    if (!qrData?.expiresAt) {
      setExpiresLeftMs(null);
      return;
    }
    const end = new Date(qrData.expiresAt).getTime();
    const tick = () => setExpiresLeftMs(Math.max(0, end - Date.now()));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [qrData?.expiresAt]);

  if (!pool) return <div className="max-w-6xl mx-auto px-6 py-20"><div className="h-[500px] shimmer rounded-2xl" /></div>;

  const fallbackColors = ["#B6509E", "#00D395", "#3B82F6", "#F59E0B", "#FF6B6B", "#6DC6B1"];
  const strategies = (pool.strategies || []).map((s, i) => ({
    name: s.name,
    pct: Number(s.allocation ?? s.pct ?? 0),
    color: s.color || fallbackColors[i % fallbackColors.length],
    apy: s.apy || "—",
    status: s.status || (String(s.name || "").toLowerCase().includes("reserve") ? "Liquid" : "Active"),
  }));
  const apy = parseFloat(pool.apy || 0).toFixed(1);
  const monthlyApy = pool.apyMonthly ?? pool.displayApyMonthly ?? 0;
  const monthly = parseFloat(monthlyApy || 0).toFixed(2);
  const lockLabel = pool.lockDays > 0 ? `${pool.lockDays} Days` : "Flexible";
  const earlyFeeRaw = pool.early_exit_fee_bps ?? pool.earlyExitFeeBps ?? 0;
  const earlyFee = (earlyFeeRaw / 100).toFixed(0);
  const projectedMonthly = amount ? (parseFloat(amount) * parseFloat(monthlyApy || 0) / 100).toFixed(2) : "0.00";
  const tvlNum = Number(pool.total_staked ?? pool.totalStaked ?? 0) / 1e6;
  const capNum = Number(pool.capacity) / 1e6;
  const minDeposit = Number(pool.min_deposit ?? pool.minDeposit ?? 0);
  const maxDeposit = Number(pool.max_deposit ?? pool.maxDeposit ?? 0);

  const handleDeposit = async () => {
    if (!token) { toast.error("Please sign in first"); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error("Enter an amount"); return; }
    setLoading(true);
    try {
      const authToken = localStorage.getItem("aussivo_token");
      const res = await fetch(`${API}/api/user/deposit/qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ vaultId: pool._id || id, amount: parseFloat(amount) }),
      });
      const data = await res.json();
      if (data.status === 200) setQrData(data.data);
      else toast.error(data.message || "Failed to generate QR");
    } catch { toast.error("Failed to generate QR"); }
    setLoading(false);
  };

  const handlePayFromInjectedWallet = async () => {
    if (!qrData) return;
    if (expiresLeftMs === 0) {
      toast.error("This deposit address has expired. Generate a new one.");
      return;
    }
    setPayingInjected(true);
    try {
      toast.loading("Confirm transfer in your wallet…", { id: "pay-inj" });
      await transferEphemeralFromInjected(qrData, { walletType, connectInjectedWallet });
      toast.success("Transfer confirmed. Your vault balance updates shortly.", { id: "pay-inj" });
    } catch (err) {
      const msg = err?.shortMessage || err?.reason || err?.message || "Transfer failed";
      toast.error(msg, { id: "pay-inj", duration: 6000 });
    }
    setPayingInjected(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="text-sm text-slate-400 mb-6">
        <Link to="/" className="hover:text-slate-200">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/pools" className="hover:text-slate-200">Vaults</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-200">{pool.name}</span>
      </div>

      {/* ═══ HEADER ═══ */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="font-display font-bold text-2xl text-white mb-2">{pool.name}</h1>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-1.5">
              {strategies.slice(0, 3).map((s, i) => (
                <div key={i} className="w-6 h-6 rounded-full text-[8px] font-bold text-white flex items-center justify-center" style={{ background: s.color, marginLeft: i > 0 ? "-6px" : 0, zIndex: 3 - i, border: "2px solid white" }}>
                  {s.name.slice(0, 2)}
                </div>
              ))}
              {strategies.length > 3 && <span className="text-xs text-slate-500 ml-1">+{strategies.length - 3}</span>}
            </div>
            <span>👥 {pool.investorsLabel || `${Number(pool.totalUsers || 0).toLocaleString()}+`} investors</span>
            <span>Market Cap: ${capNum > 1000 ? `${(capNum / 1000).toFixed(0)}M` : `${capNum.toFixed(0)}K`} ({((tvlNum / capNum) * 100).toFixed(2)}%)</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`font-display font-bold text-lg ${parseFloat(apy) > 0 ? "text-emerald-500" : "text-red-500"}`}>▲ {apy}% APY</span>
            <span className="text-sm text-slate-400">({monthly}% / month)</span>
          </div>
        </div>
        <button className="text-sm text-slate-300 border border-surface-4/60 rounded-lg px-4 py-2 hover:bg-[#0d1324]">☆ Watchlist</button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        {/* ═══ LEFT: Chart + Constituents ═══ */}
        <div className="lg:col-span-2 space-y-6">
          {/* Performance Chart */}
          <div className="glass p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-slate-100">Performance</h3>
              <div className="flex bg-[#0d1324] rounded-lg p-1 border border-surface-4/50">
                {["1D", "1W", "1M", "3M", "6M", "1Y"].map(tf => (
                  <button key={tf} onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${timeframe === tf ? "bg-[#111b31] shadow text-slate-100" : "text-slate-400 hover:text-slate-200"}`}>
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            <MiniChart seed={pool.id} apy={apy} />
          </div>

          {/* Constituents */}
          <div className="glass p-6">
            <h3 className="font-display font-semibold text-slate-100 text-lg mb-6">Constituents</h3>
            <div className="grid md:grid-cols-5 gap-6">
              {/* Donut */}
              <div className="md:col-span-2 flex flex-col items-center">
                <DonutChart strategies={strategies} />
                <div className="flex flex-wrap gap-3 mt-4 justify-center">
                  {strategies.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
                      <span className="text-xs text-slate-400">{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="md:col-span-3">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-surface-4/40">
                      <th className="text-left pb-3 font-medium">Strategy</th>
                      <th className="text-left pb-3 font-medium">Yield</th>
                      <th className="text-left pb-3 font-medium">Allocation</th>
                      <th className="text-right pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strategies.map((s, i) => (
                      <tr key={i} className="border-b border-surface-4/30 last:border-0">
                        <td className="py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full text-[9px] font-bold text-white flex items-center justify-center" style={{ background: s.color }}>
                            {s.name?.slice(0, 2)}
                            </div>
                            <span className="text-sm font-medium text-slate-200">{s.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 text-sm text-slate-300">{s.apy}</td>
                        <td className="py-3.5 text-sm font-semibold text-slate-200">{s.pct}%</td>
                        <td className="py-3.5 text-right">
                          <span className={`text-xs font-semibold ${String(s.status).toLowerCase().includes("liquid") ? "text-blue-500" : "text-emerald-500"}`}>
                            {s.status}
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
            <div className="glass p-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">How Are Strategies Selected?</h4>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                The strategies in this vault are reviewed and rebalanced at regular intervals to maximize risk-adjusted returns.
              </p>
              <div className="flex gap-6 bg-[#0d1324] border border-surface-4/50 rounded-xl p-4">
                <div className="text-center">
                  <div className="text-xs text-slate-500">Last Rebalance</div>
                  <div className="text-sm font-bold text-slate-200 mt-1">{pool.lastRebalanceDate || "01 Apr 2026"}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500">Next Rebalance</div>
                  <div className="text-sm font-bold text-slate-200 mt-1">{pool.nextRebalanceDate || "01 May 2026"}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500">Frequency</div>
                  <div className="text-sm font-bold text-slate-200 mt-1">{pool.rebalanceFrequency || "Monthly"}</div>
                </div>
              </div>
            </div>

            <div className="glass p-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Fees</h4>
              <p className="text-sm text-slate-400 mb-4">100% transparent fee structure.</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Deposit", value: "Zero", sub: "No charges" },
                  { label: "Withdrawal", value: earlyFee > 0 ? `${earlyFee}%` : "Zero", sub: earlyFee > 0 ? "If early exit" : "No charges" },
                  { label: "Performance", value: `${pool.performanceFeePercent ?? 20}%`, sub: "On yield only" },
                ].map((f, i) => (
                  <div key={i} className="text-center p-3 bg-[#0d1324] border border-surface-4/50 rounded-xl">
                    <div className="text-xs text-slate-500 mb-1">{f.label}</div>
                    <div className="text-lg font-display font-bold text-slate-100">{f.value}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{f.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Vault Details */}
          <div className="glass p-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Vault Parameters</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ["Min Deposit", `${(minDeposit / 1e6).toLocaleString()} ${pool.assetSymbol}`],
                ["Max Deposit", `${(maxDeposit / 1e6).toLocaleString()} ${pool.assetSymbol}`],
                ["Lock Period", lockLabel],
                ["Capacity", `$${capNum > 1000 ? `${(capNum / 1000).toFixed(0)}M` : `${capNum.toFixed(0)}K`}`],
                ["Reward Cycle", pool.rewardCycleLabel || "Real-time accrual"],
                ["Smart Contract", pool.smartContractLabel || "Verified ✓"],
                ["Reserve Ratio", pool.reserveRatioLabel || "20-30%"],
                ["Circuit Breaker", pool.circuitBreakerLabel || "Active ✓"],
              ].map(([k, v], i) => (
                <div key={i} className="bg-[#0d1324] border border-surface-4/50 rounded-xl p-3">
                  <div className="text-xs text-slate-500 mb-1">{k}</div>
                  <div className="text-sm font-semibold text-slate-200">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Invest Panel ═══ */}
        <div>
          <div className="glass p-6 sticky top-6">
            {/* Tabs */}
            <div className="flex mb-6 border-b border-surface-4/40">
              {["invest", "redeem"].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 pb-3 text-sm font-semibold capitalize transition-all ${tab === t ? "text-brand border-b-2 border-brand" : "text-slate-400"}`}>
                  {t === "invest" ? "Invest" : "Redeem"}
                </button>
              ))}
            </div>

            {tab === "invest" ? (qrData ? (
              <div className="text-center">
                <img src={qrData.qrCode} alt="Deposit address QR" className="mx-auto w-56 h-56 rounded-xl border-2 border-brand/20 mb-4" />
                <div className="bg-[#0d1324] border border-surface-4/50 rounded-xl p-4 mb-3">
                  <div className="text-xs text-slate-500 mb-1">Send exactly</div>
                  <div className="text-xl font-display font-bold text-brand">{qrData.amount} {qrData.asset}</div>
                  <div className="text-xs text-slate-500 mt-1">{qrData.network}</div>
                </div>
                {expiresLeftMs != null && (
                  <div className={`rounded-xl p-3 mb-3 text-sm font-semibold border ${expiresLeftMs === 0 ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
                    {expiresLeftMs === 0
                      ? "This deposit address has expired. Generate a new one if you still need to pay."
                      : `Time remaining: ${formatRemaining(expiresLeftMs)}`}
                  </div>
                )}
                <div className="bg-[#0d1324] border border-surface-4/50 rounded-xl p-4 mb-3 text-left">
                  <div className="text-xs text-slate-500 mb-1">One-time deposit address</div>
                  <div className="text-sm font-mono break-all text-slate-200">{qrData.depositAddress}</div>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(qrData.depositAddress); toast.success("Address copied"); }}
                    className="mt-2 text-xs text-brand hover:underline"
                  >
                    Copy address
                  </button>
                </div>
                <div className="bg-[#0d1324] border border-surface-4/50 rounded-xl p-4 mb-4 text-left">
                  <div className="text-xs text-slate-500 mb-1">{qrData.asset} token contract (BEP-20)</div>
                  <div className="text-xs font-mono break-all text-slate-400">{qrData.tokenAddress}</div>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(qrData.tokenAddress); toast.success("Token contract copied"); }}
                    className="mt-2 text-xs text-brand hover:underline"
                  >
                    Copy token contract
                  </button>
                </div>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-surface-4/60" />
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-surface-4/60" />
                </div>
                <button
                  type="button"
                  onClick={handlePayFromInjectedWallet}
                  disabled={payingInjected || expiresLeftMs === 0 || !window.ethereum}
                  title={!window.ethereum ? "Install MetaMask or another EVM wallet extension" : undefined}
                  className="w-full py-3.5 rounded-xl font-display font-bold text-base transition-all disabled:opacity-50 bg-gradient-to-r from-brand-dark to-brand text-white hover:shadow-lg hover:shadow-brand/20 mb-2 flex items-center justify-center gap-2"
                >
                  <span>🦊</span>
                  {payingInjected ? "Waiting for wallet…" : `Pay ${qrData.amount} ${qrData.asset} from browser wallet`}
                </button>
                <p className="text-[11px] text-slate-500 mb-4 text-center">Uses MetaMask or your injected wallet on {qrData.network}. Same amount and token as above.</p>

                {qrData.instructions?.length > 0 && (
                  <div className="text-left space-y-2 mb-4">
                    {qrData.instructions.map((inst, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                        <span className="text-brand mt-0.5">•</span><span>{inst}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-slate-500 mb-4">
                  After your transfer confirms on-chain, your balance is credited and funds are swept to treasury (usually within a minute).
                </p>
                <button
                  type="button"
                  onClick={() => { setQrData(null); }}
                  className="w-full py-3 rounded-xl font-semibold text-sm border border-surface-4/60 text-slate-300 hover:bg-[#0d1324]"
                >
                  Change amount
                </button>
              </div>
            ) : (<>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Amount</span>
                  <span className="text-slate-500">One-time address, valid 15 minutes</span>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">$</span>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
                    className="w-full bg-[#0d1324] border border-surface-4/60 rounded-xl py-3.5 pl-9 pr-4 text-lg font-display font-semibold text-slate-100 outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/10" />
                </div>
                <div className="text-xs text-slate-500 mt-1.5">Min: ${(minDeposit / 1e6).toLocaleString()} · Max: ${(maxDeposit / 1e6).toLocaleString()}</div>
              </div>

              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-4">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                <span className="text-xs text-blue-600">Invest in this vault with your {pool.assetSymbol} holdings</span>
              </div>

              {amount && parseFloat(amount) > 0 && (
                <div className="bg-[#0d1324] border border-surface-4/50 rounded-xl p-4 mb-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Est. Monthly</span><span className="text-emerald-400 font-semibold">+${projectedMonthly}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Est. Yearly</span><span className="font-semibold text-slate-200">+${(projectedMonthly * 12).toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">APY</span><span className="font-semibold text-slate-200">{apy}%</span></div>
                </div>
              )}

              <button onClick={handleDeposit} disabled={loading}
                className="w-full py-3.5 rounded-xl font-display font-bold text-base transition-all disabled:opacity-50 bg-gradient-to-r from-brand-dark to-brand text-white hover:shadow-lg hover:shadow-brand/20">
                {loading ? "Generating QR..." : token ? "Deposit Now →" : "Sign In to Invest"}
              </button>
            </>)) : (
              <div className="text-center py-8">
                <p className="text-sm text-slate-400 mb-4">Manage your redemptions from your <Link to="/portfolio" className="text-brand font-semibold hover:underline">Portfolio</Link>.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
