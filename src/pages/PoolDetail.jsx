import { API } from "../config/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import toast from "react-hot-toast";
import { transferEphemeralFromInjected } from "../utils/transferEphemeralFromInjected";
import { sampleSeries } from "../utils/sampleSeries";
import { usePolledAllocation } from "../hooks/usePolledAllocation";
import { GenerativeArt } from "../components/GenerativeArt";
import Avatar from "../components/Avatar";
import { DEPOSIT_STAY_WARNING, DEPOSIT_SINGLE_TX_HINT } from "../constants/depositModalCopy";

// The allocation is computed on the BACKEND (helpers/allocationModel.ts). The frontend
// just polls it. Cadence is configurable; default 4s reads smoothly with the CSS arc
// transitions below.
const ALLOC_POLL_MS = Number(import.meta.env.VITE_ALLOC_POLL_MS) || 4000;

function formatCountdown(ms) {
  if (ms == null || ms <= 0) return "—";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec.toString().padStart(2, "0")}s`;
}

// Rebalance happens at month-end. Always derive from today so the dates stay in sync:
// next = last day of the current month, last = last day of the previous month.
function fmtRebalanceDate(d) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function monthEndRebalanceDates(now = new Date()) {
  const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  return { last: fmtRebalanceDate(endOfPrevMonth), next: fmtRebalanceDate(endOfThisMonth) };
}

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
          <circle key={s.key || s.name || i} cx={center} cy={center} r={radius} fill="none" stroke={s.color}
            strokeWidth={stroke} strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={dashOffset} transform={`rotate(-90 ${center} ${center})`}
            style={{ transition: "stroke-dasharray .9s cubic-bezier(.22,1,.36,1), stroke-dashoffset .9s cubic-bezier(.22,1,.36,1)" }} />
        );
      })}
      <circle cx={center} cy={center} r={radius - stroke / 2 + 2} fill="white" />
    </svg>
  );
}

function MiniChart({ seed = "0", apy = 18, timeframe = "1W" }) {
  // Distinct, illustrative curve per (vault, timeframe). Re-animates on timeframe change.
  const points = useMemo(() => sampleSeries(seed, timeframe, apy), [seed, apy, timeframe]);
  const min = Math.min(...points), max = Math.max(...points);
  const w = 600, h = 200, pad = 20;
  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((p - min) / (max - min || 1)) * (h - 2 * pad);
    return [x, y];
  });
  const pts = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const [lastX, lastY] = coords[coords.length - 1];
  const areaPath = `M${pad},${h - pad} L${coords.map(([x, y]) => `${x},${y}`).join(" L")} L${lastX},${h - pad} Z`;
  // unique animation id so each timeframe switch restarts the draw-on
  const animId = `draw-${String(seed).slice(-6)}-${timeframe}`;

  return (
    <svg key={timeframe} viewBox={`0 0 ${w} ${h}`} className="w-full h-48">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00e676" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#00e676" stopOpacity="0" />
        </linearGradient>
        <style>{`
          @keyframes ${animId}-line { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
          @keyframes ${animId}-fade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes ${animId}-dot  { 0%,70% { opacity: 0; transform: scale(0); } 100% { opacity: 1; transform: scale(1); } }
          .${animId}-line { stroke-dasharray: 1; stroke-dashoffset: 1; animation: ${animId}-line 1.15s cubic-bezier(.4,0,.2,1) forwards; }
          .${animId}-area { opacity: 0; animation: ${animId}-fade 1.3s ease forwards .2s; }
          .${animId}-dot  { transform-box: fill-box; transform-origin: center; animation: ${animId}-dot 1.5s ease forwards; }
        `}</style>
      </defs>
      {[0, 1, 2, 3, 4].map(i => {
        const y = pad + (i / 4) * (h - 2 * pad);
        const label = (max - (i / 4) * (max - min)).toFixed(1);
        return (<g key={i}><line x1={pad} y1={y} x2={w - pad} y2={y} stroke="#1e293b" strokeWidth="1" /><text x={w - pad + 8} y={y + 4} fontSize="11" fill="#64748b">{label}%</text></g>);
      })}
      <path className={`${animId}-area`} d={areaPath} fill="url(#areaGrad)" />
      <polyline className={`${animId}-line`} points={pts} pathLength="1" fill="none" stroke="#00c853" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle className={`${animId}-dot`} cx={lastX} cy={lastY} r="5" fill="#00c853" stroke="#0b0f1a" strokeWidth="2" />
    </svg>
  );
}

export default function PoolDetail() {
  const { id } = useParams();
  const { token, connectInjectedWallet, walletType } = useWeb3();
  const [pool, setPool] = useState(null);
  const [amount, setAmount] = useState("");      // optional — drives the yield estimate only
  const [payAmount, setPayAmount] = useState(""); // optional — amount for in-app "pay from wallet"
  const [loading, setLoading] = useState(false);
  const [depositNetwork, setDepositNetwork] = useState("bep20"); // bep20 (BSC) | trc20 (Tron)
  const [payingInjected, setPayingInjected] = useState(false);
  const [tab, setTab] = useState("invest");
  const [timeframe, setTimeframe] = useState("1W");
  /** Active deposit session shown in full-screen modal (QR + poll until credited / matched). */
  const [depositModal, setDepositModal] = useState(null);
  const [depositCancelConfirm, setDepositCancelConfirm] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [expiresLeftMs, setExpiresLeftMs] = useState(null);

  useEffect(() => { fetch(`${API}/api/pools/${id}`).then(r => r.json()).then(setPool).catch(() => {}); }, [API, id]);

  useEffect(() => {
    if (!depositModal?.qr?.expiresAt) {
      setExpiresLeftMs(null);
      return;
    }
    const end = new Date(depositModal.qr.expiresAt).getTime();
    const tick = () => setExpiresLeftMs(Math.max(0, end - Date.now()));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [depositModal?.qr?.expiresAt]);

  useEffect(() => {
    setDepositCancelConfirm(false);
  }, [depositModal?.qr?.pendingDepositId]);

  const dismissCancelConfirm = useCallback(() => setDepositCancelConfirm(false), []);

  const beginCancelDeposit = useCallback(() => {
    if (!depositModal?.qr?.pendingDepositId) {
      setDepositModal(null);
      return;
    }
    setDepositCancelConfirm(true);
  }, [depositModal]);

  const executeCancelDeposit = useCallback(async () => {
    const pendingDepositId = depositModal?.qr?.pendingDepositId;
    if (!pendingDepositId) {
      setDepositCancelConfirm(false);
      setDepositModal(null);
      return;
    }
    setCancelSubmitting(true);
    try {
      const authToken = localStorage.getItem("aussivo_token");
      const res = await fetch(`${API}/api/user/deposit/pending/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ pendingDepositId }),
      });
      const data = await res.json();
      if (data.status === 200) {
        toast.success(data.message || "Monitoring stopped and deposit intent removed.");
        setDepositCancelConfirm(false);
        setDepositModal(null);
      } else {
        toast.error(data.message || "Could not cancel");
      }
    } catch {
      toast.error("Could not cancel — check your connection.");
    } finally {
      setCancelSubmitting(false);
    }
  }, [depositModal, API]);

  useEffect(() => {
    if (!depositModal) return;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (depositCancelConfirm) dismissCancelConfirm();
      else beginCancelDeposit();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [depositModal, depositCancelConfirm, beginCancelDeposit, dismissCancelConfirm]);

  useEffect(() => {
    if (!depositModal) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [depositModal]);

  /** Browser Back during deposit: stay on URL, show warning, open cancel flow (SPA has no native “leave” dialog for in-app back). */
  const depositHistoryGuardRef = useRef(null);
  useEffect(() => {
    const pendingId = depositModal?.qr?.pendingDepositId;
    if (!pendingId) {
      const prev = depositHistoryGuardRef.current;
      depositHistoryGuardRef.current = null;
      if (prev && window.history.state?.__aussivoDepositGuard === prev) {
        window.history.back();
      }
      return undefined;
    }

    const onPopState = () => {
      if (!depositHistoryGuardRef.current) return;
      window.history.pushState(
        { __aussivoDepositGuard: depositHistoryGuardRef.current },
        "",
        window.location.href
      );
      toast(DEPOSIT_STAY_WARNING, { duration: 7000 });
      beginCancelDeposit();
    };

    if (depositHistoryGuardRef.current !== pendingId) {
      depositHistoryGuardRef.current = pendingId;
      window.history.pushState({ __aussivoDepositGuard: pendingId }, "", window.location.href);
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [depositModal?.qr?.pendingDepositId, beginCancelDeposit]);

  useEffect(() => {
    const pendingId = depositModal?.qr?.pendingDepositId;
    if (!pendingId || !token) return undefined;

    let cancelled = false;
    const tick = async () => {
      try {
        const authToken = localStorage.getItem("aussivo_token");
        const res = await fetch(`${API}/api/user/deposit/pending/${pendingId}/status`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.status === 404) {
          toast.error("This deposit session is no longer active.");
          setDepositModal(null);
          return;
        }
        if (data.status === 200 && data.data?.paymentReceived) {
          const settled = data.data.fullySettled;
          toast.success(
            settled
              ? "Transaction complete. Your payment is confirmed and settled."
              : "Payment received — your vault balance is updating now."
          );
          try {
            window.dispatchEvent(new CustomEvent("aussivo-deposit-complete", { detail: { pendingId } }));
          } catch (_) { /* ignore */ }
          setDepositModal(null);
          return;
        }
        if (data.status === 200 && data.data?.status === "expired") {
          toast.error("This deposit address has expired. Start again if you still want to deposit.");
          setDepositModal(null);
        }
      } catch {
        /* ignore transient network errors */
      }
    };

    tick();
    const iv = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [depositModal?.qr?.pendingDepositId, token, API]);

  // The backend already serves live strategies inside pool.strategies (when ALLOC_LIVE_MODEL
  // is on). We additionally poll the lightweight /allocation endpoint so the panel keeps
  // updating without re-fetching the whole vault. `live` comes from the backend's meta.
  //
  // IMPORTANT: this hook must run on every render (Rules of Hooks), so it is called BEFORE
  // the `if (!pool)` early-return below. It is null-safe: with no poolId it simply idles.
  const backendLive = pool?.allocationMeta?.live === true;
  const polled = usePolledAllocation(pool?.id ?? pool?._id, {
    enabled: backendLive,
    pollMs: ALLOC_POLL_MS,
    initial: pool?.strategies || [],
    initialMeta: pool?.allocationMeta || null,
  });

  if (!pool) return <div className="max-w-6xl mx-auto px-6 py-20"><div className="h-[500px] shimmer rounded-2xl" /></div>;

  const modalQr = depositModal?.qr;

  const fallbackColors = ["#B6509E", "#00D395", "#3B82F6", "#F59E0B", "#FF6B6B", "#6DC6B1"];

  const rawStrategies = (polled.strategies && polled.strategies.length ? polled.strategies : pool.strategies) || [];
  const strategies = rawStrategies.map((s, i) => ({
    key: s.protocol || s.name || String(i),
    name: s.name,
    code: s.code || (s.name || "").slice(0, 2),
    pct: Number(s.allocation ?? s.pct ?? 0),
    color: s.color || fallbackColors[i % fallbackColors.length],
    apy: s.apy || "—",
    status: s.status || (String(s.name || "").toLowerCase().includes("reserve") ? "Liquid" : "Active"),
  }));
  const allocLive = polled.live || backendLive;
  const apy = parseFloat(pool.apy || 0).toFixed(1);
  const monthlyApy = pool.apyMonthly ?? pool.displayApyMonthly ?? 0;
  const monthly = parseFloat(monthlyApy || 0).toFixed(2);
  const lockLabel = pool.lockDays > 0 ? `${pool.lockDays} Days` : "Flexible";
  const projectedMonthly = amount ? (parseFloat(amount) * parseFloat(monthlyApy || 0) / 100).toFixed(2) : "0.00";
  const tvlNum = (Number(pool.total_staked ?? pool.totalStaked ?? 0) + Number(pool.baseline_staked ?? 0)) / 1e6;
  const capNum = Number(pool.capacity) / 1e6;
  const minDeposit = Number(pool.min_deposit ?? pool.minDeposit ?? 0);
  const maxDeposit = Number(pool.max_deposit ?? pool.maxDeposit ?? 0);

  const handleDeposit = async () => {
    if (!token) { toast.error("Please sign in first"); return; }
    setLoading(true);
    try {
      const authToken = localStorage.getItem("aussivo_token");
      // Open-amount: no amount sent. The user scans and sends any amount from their wallet.
      const res = await fetch(`${API}/api/user/deposit/qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ vaultId: pool._id || id, network: depositNetwork }),
      });
      const data = await res.json();
      if (data.status === 200) { setDepositModal({ qr: data.data }); setPayAmount(""); }
      else toast.error(data.message || "Failed to generate deposit address");
    } catch { toast.error("Failed to generate deposit address"); }
    setLoading(false);
  };

  const handlePayFromInjectedWallet = async () => {
    const qr = depositModal?.qr;
    if (!qr) return;
    if (expiresLeftMs === 0) {
      toast.error("This deposit address has expired. Generate a new one.");
      return;
    }
    // Open-amount deposits need the user to type how much to send from the connected wallet.
    let overrideBaseUnits;
    if (qr.openAmount) {
      const amt = parseFloat(payAmount);
      if (!amt || amt <= 0) { toast.error("Enter an amount to pay from your wallet"); return; }
      overrideBaseUnits = (BigInt(Math.round(amt * 1e6)) * BigInt(1e12)).toString();
    }
    setPayingInjected(true);
    try {
      toast.loading("Confirm transfer in your wallet…", { id: "pay-inj" });
      await transferEphemeralFromInjected(qr, { walletType, connectInjectedWallet }, overrideBaseUnits);
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

      {/* ═══ HERO ═══ */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] mb-6">
        <div className="absolute inset-0">
          <GenerativeArt seed={pool.id || pool.name} glyph={pool.assetSymbol === "USDC" ? "$" : "₮"} className="h-full w-full" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-surface-1/85 to-surface-1/45" />
        <div className="relative p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-lg shadow-black/40 bg-surface-4">
                <Avatar seed={pool.id || pool.name} style="rings" size={56} radius={16} className="h-full w-full" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">{pool.name}</h1>
                  <span className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-300">{pool.assetSymbol}</span>
                  <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium ${pool.lockDays > 0 ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}`}>{lockLabel}</span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="font-display font-bold text-2xl text-emerald-400">▲ {apy}%</span>
                  <span className="text-sm font-semibold text-slate-300">APY</span>
                  <span className="text-sm text-slate-400">· {monthly}% / mo</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex items-center">
                    {strategies.slice(0, 4).map((s, i) => (
                      <div key={i} className="h-7 w-7 rounded-full text-[8px] font-bold text-white flex items-center justify-center ring-2 ring-surface-1" style={{ background: s.color, marginLeft: i > 0 ? "-8px" : 0, zIndex: 5 - i }}>
                        {s.code || s.name.slice(0, 2)}
                      </div>
                    ))}
                    {strategies.length > 4 && <span className="ml-1 text-xs text-slate-500">+{strategies.length - 4}</span>}
                  </div>
                  <span className="text-xs text-slate-400">{pool.investorsLabel || `${(Number(pool.totalUsers || 0) + Number(pool.baseline_users ?? 0)).toLocaleString()}+`} investors</span>
                </div>
              </div>
            </div>
            <button className="text-sm text-slate-300 border border-surface-4/60 rounded-lg px-4 py-2 hover:bg-[#0d1324] hover:border-brand/40 transition-colors backdrop-blur">☆ Watchlist</button>
          </div>

          {/* key stats */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "TVL", value: `$${tvlNum >= 1 ? `${tvlNum.toFixed(2)}M` : `${(tvlNum * 1000).toFixed(0)}K`}`, accent: "text-white" },
              { label: "Capacity filled", value: capNum > 0 ? `${((tvlNum / capNum) * 100).toFixed(1)}%` : "—", accent: "text-brand" },
              { label: "Monthly yield", value: `${monthly}%`, accent: "text-emerald-300" },
              { label: "Lock period", value: lockLabel, accent: "text-white" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 backdrop-blur">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">{s.label}</div>
                <div className={`mt-0.5 font-display text-lg font-bold ${s.accent}`}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
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
            <MiniChart seed={pool.id} apy={apy} timeframe={timeframe} />
            {/* <p className="mt-2 text-[11px] text-slate-500">Illustrative performance — sample data for visualization.</p> */}
          </div>

          {/* Constituents — illustrative target allocation (not live positions) */}
          <div className="glass p-6">
            <div className="mb-6">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display font-semibold text-slate-100 text-lg">Constituents</h3>
                {/* <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-300/90 border border-amber-400/30 bg-amber-400/[0.06] rounded-full px-2 py-0.5">Illustrative</span> */}
                {allocLive && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-300/90 border border-emerald-400/25 bg-emerald-400/[0.06] rounded-full px-2 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {/* Show the countdown only for a short (demo) rebalance period so it
                        doesn't clash with the monthly-rebalance card below. */}
                    {polled.meta?.rebalancePeriodMs && polled.meta.rebalancePeriodMs < 12 * 60 * 60 * 1000
                      ? <>Live · rebalance in {formatCountdown(polled.msToNextRebalance)}</>
                      : <>Live</>}
                  </span>
                )}
              </div>
              {/* <p className="text-xs text-muted mt-1 max-w-xl">
                A model of how this strategy is designed to allocate. These are target weights, not a live on-chain position report, and do not represent funds currently deployed to the named protocols.
              </p> */}
            </div>
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
                      <th className="text-left pb-3 font-medium">Target weight</th>
                      <th className="text-right pb-3 font-medium">Type</th>
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
                        <td className="py-3.5 text-sm font-semibold text-slate-200 tabular-nums">{Number(s.pct).toFixed(1)}%</td>
                        <td className="py-3.5 text-right">
                          <span className={`text-xs font-semibold ${String(s.status).toLowerCase().includes("liquid") ? "text-blue-500" : "text-emerald-500"}`}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* <p className="text-[11px] text-slate-500 mt-4 pt-3 border-t border-surface-4/30">
                  Target model only. Protocol names indicate the strategy's intended venues and are not a statement that capital is presently allocated to them.
                </p> */}
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
                {(() => { const rb = monthEndRebalanceDates(); return (<>
                <div className="text-center">
                  <div className="text-xs text-slate-500">Last Rebalance</div>
                  <div className="text-sm font-bold text-slate-200 mt-1">{rb.last}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500">Next Rebalance</div>
                  <div className="text-sm font-bold text-slate-200 mt-1">{rb.next}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500">Frequency</div>
                  <div className="text-sm font-bold text-slate-200 mt-1">{pool.rebalanceFrequency || "Monthly"}</div>
                </div>
                </>); })()}
              </div>
            </div>

            <div className="glass p-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Fees</h4>
              <p className="text-sm text-slate-400 mb-4">100% transparent fee structure.</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Deposit", value: "Zero", sub: "No charges" },
                  // Matches the backend: EARLY_EXIT_FEE_BPS = 100 bps = 1%, charged on the
                  // principal only if redeemed within the first 30 days. No performance fee.
                  { label: "Early withdrawal", value: "1%", sub: "Only if redeemed within 30 days" },
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
                <div key={i} className="bg-[#0d1324] border border-surface-4/50 rounded-xl p-3 transition-colors hover:border-brand/30">
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

            {tab === "invest" ? (depositModal ? (
              <div className="rounded-xl border border-surface-4/50 bg-[#0d1324] p-4 text-left">
                <p className="font-display text-sm font-semibold text-slate-200">Deposit in progress</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{DEPOSIT_STAY_WARNING}</p>
              </div>
            ) : (<>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Deposit {pool.assetSymbol}</span>
                  <span className="text-slate-500">One-time address, valid 60 min</span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Tap below to get your deposit address, then send <span className="text-slate-200 font-semibold">any amount</span> of {pool.assetSymbol} from your wallet. It's captured and credited automatically — no amount to type.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-4">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                <span className="text-xs text-blue-600">Scan the QR or copy the address — send any amount of {pool.assetSymbol}</span>
              </div>

              <div className="mb-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Choose network</div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "bep20", title: "BEP-20", sub: "USDT on BSC" },
                    { key: "trc20", title: "TRC-20", sub: "USDT on Tron" },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setDepositNetwork(opt.key)}
                      className={`rounded-xl border px-4 py-3 text-left transition-all ${
                        depositNetwork === opt.key
                          ? "border-brand/70 bg-brand/10 ring-2 ring-brand/20"
                          : "border-surface-4/50 bg-[#0d1324] hover:border-surface-4"
                      }`}
                    >
                      <div className="text-sm font-bold text-slate-100">{opt.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{opt.sub}</div>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-amber-300/90">
                  Send only USDT on the <span className="font-semibold">{depositNetwork === "trc20" ? "Tron (TRC-20)" : "BSC (BEP-20)"}</span> network. Wrong-network transfers are lost.
                </p>
              </div>

              <button onClick={handleDeposit} disabled={loading}
                className="w-full py-3.5 rounded-xl font-display font-bold text-base transition-all disabled:opacity-50 bg-gradient-to-r from-brand-dark to-brand text-white hover:shadow-lg hover:shadow-brand/20">
                {loading ? "Generating address..." : token ? "Get Deposit Address →" : "Sign In to Invest"}
              </button>
            </>)) : (
              <div className="text-center py-8">
                <p className="text-sm text-slate-400 mb-4">Manage your redemptions from your <Link to="/portfolio" className="text-brand font-semibold hover:underline">Portfolio</Link>.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {modalQr &&
        typeof document !== "undefined" &&
        createPortal(
        <>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deposit-modal-heading"
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md px-4 py-8 sm:px-6"
            onClick={beginCancelDeposit}
          >
            <div
              className="glass relative w-full max-w-md max-h-[min(92vh,720px)] overflow-y-auto rounded-2xl shadow-2xl ring-1 ring-white/[0.06]"
              onClick={e => e.stopPropagation()}
            >
              <div className="border-b border-surface-4/50 px-5 pt-5 pb-4 text-center">
                <h2 id="deposit-modal-heading" className="font-display text-lg font-semibold tracking-tight text-slate-100">
                  Complete your deposit
                </h2>
                <p className="mt-1 text-xs text-slate-500">{modalQr.network}</p>
              </div>

              <div className="px-5 pt-4">
                <div className="flex gap-3 rounded-xl border border-brand/20 bg-brand/[0.06] px-3.5 py-3">
                  <svg className="mt-0.5 h-5 w-5 shrink-0 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-5M12 8h.01" strokeLinecap="round" />
                  </svg>
                  <p className="text-left text-sm leading-relaxed text-slate-300">{DEPOSIT_STAY_WARNING}</p>
                </div>
              </div>

              <div className="space-y-4 px-5 pb-5 pt-5">
                <div className="flex justify-center">
                  <img
                    src={modalQr.qrCode}
                    alt="Deposit address QR"
                    className="h-48 w-48 rounded-xl border border-surface-4/60 bg-white p-2 shadow-inner sm:h-52 sm:w-52"
                  />
                </div>

                <div className="rounded-xl border border-surface-4/50 bg-[#0d1324] p-4 text-center">
                  {modalQr.openAmount ? (
                    <>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Send any amount of</div>
                      <div className="mt-1 font-display text-2xl font-bold text-brand">{modalQr.asset}</div>
                      <p className="mt-2 text-xs text-slate-400">Scan the QR or copy the address and send {modalQr.asset} from your wallet. Whatever you send is captured and credited automatically.</p>
                    </>
                  ) : (
                    <>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Send exactly</div>
                      <div className="mt-1 font-display text-2xl font-bold text-brand">{modalQr.amount} {modalQr.asset}</div>
                    </>
                  )}
                  <p className="mt-3 text-left text-xs leading-relaxed text-amber-200/90">{DEPOSIT_SINGLE_TX_HINT}</p>
                </div>

                {expiresLeftMs != null && (
                  <div
                    className={`rounded-xl border px-4 py-3 text-center text-sm font-semibold ${
                      expiresLeftMs === 0
                        ? "border-red-500/35 bg-red-500/[0.08] text-red-300"
                        : "border-surface-4/50 bg-[#0d1324] text-slate-300"
                    }`}
                  >
                    {expiresLeftMs === 0 ? (
                      "This deposit address has expired. Close and start again."
                    ) : (
                      <>
                        <span className="text-slate-500">Time remaining </span>
                        <span className="font-mono text-brand">{formatRemaining(expiresLeftMs)}</span>
                      </>
                    )}
                  </div>
                )}

                <div className="rounded-xl border border-surface-4/50 bg-[#0d1324] p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">One-time address</div>
                  <div className="mt-2 break-all font-mono text-sm text-slate-200">{modalQr.depositAddress}</div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(modalQr.depositAddress);
                      toast.success("Address copied");
                    }}
                    className="mt-3 text-xs font-semibold text-brand hover:text-brand-light"
                  >
                    Copy address
                  </button>
                </div>

                <button
                  type="button"
                  onClick={beginCancelDeposit}
                  className="w-full rounded-xl border border-surface-4/60 py-3 text-sm font-semibold text-slate-400 transition-colors hover:border-slate-500 hover:bg-[#0d1324] hover:text-slate-200"
                >
                  Cancel deposit
                </button>
              </div>
            </div>
          </div>

          {depositCancelConfirm && (
            <div
              className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
              role="presentation"
              onClick={dismissCancelConfirm}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="deposit-cancel-title"
                className="glass w-full max-w-sm rounded-2xl p-5 shadow-2xl ring-1 ring-white/[0.06]"
                onClick={e => e.stopPropagation()}
              >
                <h3 id="deposit-cancel-title" className="font-display text-base font-semibold text-slate-100">
                  Cancel this deposit?
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{DEPOSIT_STAY_WARNING}</p>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={dismissCancelConfirm}
                    className="flex-1 rounded-xl border border-surface-4/60 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-[#0d1324]"
                  >
                    Keep deposit
                  </button>
                  <button
                    type="button"
                    disabled={cancelSubmitting}
                    onClick={executeCancelDeposit}
                    className="flex-1 rounded-xl border border-red-500/40 bg-red-500/10 py-2.5 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                  >
                    {cancelSubmitting ? "…" : "Yes, cancel"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>,
        document.body
      )}
    </div>
  );
}