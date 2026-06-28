import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import toast from "react-hot-toast";

import { API } from "../config/api";

/** Withdrawal status → friendly label + pill style. */
const STATUS_META = {
  pending:   { label: "Processing", cls: "tag-yellow" },
  approved:  { label: "Processing", cls: "tag-yellow" },
  completed: { label: "Completed",  cls: "tag-green" },
  rejected:  { label: "Rejected",   cls: "tag-red" },
};

/**
 * Withdraw choices for a deposit:
 *   1) Withdraw the yield earned so far — available ANYTIME, principal keeps earning.
 *   2) Withdraw yield + principal and exit — only once the 30-day principal lock is over.
 *   3) Keep accumulating — do nothing.
 */
function RedeemChoiceModal({ deposit, busy, pendingYield = 0, onWithdrawYield, onWithdrawAll, onClose }) {
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force(n => n + 1), 1000); return () => clearInterval(t); }, []);

  const asset = deposit?.asset || "";
  const principal = Number(deposit?.amount || 0);
  const vaultName = deposit?.vaultId?.name || "this vault";

  // lifetime earned (never drops) and what's actually free to withdraw right now
  const monthly = (principal * (Number(deposit?.apyPercent || 0) / 12)) / 100;
  const CYCLE_MS = 30 * 24 * 60 * 60 * 1000;
  const createdMs = deposit?.createdAt ? new Date(deposit.createdAt).getTime() : Date.now();
  const maxTotal = monthly * Number(deposit?.maxYieldPayments || 0);
  const entitled = Math.min(monthly * ((Date.now() - createdMs) / CYCLE_MS), maxTotal || Infinity);
  const pending = Number(pendingYield || 0);
  const earned = entitled; // lifetime
  const withdrawable = Math.max(0, entitled - Number(deposit?.yieldWithdrawn || 0) - pending);
  const yieldDisabled = busy || pending > 0 || withdrawable < 1e-6;

  // principal lock
  const unlockMs = deposit?.lockUntil ? new Date(deposit.lockUntil).getTime() : 0;
  const locked = unlockMs > Date.now();
  const ms = Math.max(0, unlockMs - Date.now());
  const dd = Math.floor(ms / 86400000), hh = Math.floor((ms % 86400000) / 3600000), mm = Math.floor((ms % 3600000) / 60000);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md px-4" onClick={onClose}>
      <div className="glass relative w-full max-w-md rounded-2xl p-7 ring-1 ring-white/[0.06]" onClick={e => e.stopPropagation()}>
        <h3 className="font-display text-xl font-bold text-white text-center">Manage your deposit</h3>
        <div className="mt-4 rounded-xl border border-surface-4/50 bg-[#0d1324] p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Principal in {vaultName}</span><span className="font-semibold text-slate-100">${principal.toLocaleString()} {asset}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Yield earned so far</span><span className="font-mono font-semibold text-emerald-400">+${earned.toFixed(6)} {asset}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Withdrawable now</span><span className="font-mono font-semibold text-slate-100">+${withdrawable.toFixed(6)} {asset}</span></div>
          {pending > 0 && (
            <div className="flex justify-between"><span className="text-slate-400">Processing</span><span className="font-mono font-semibold text-amber-300">⟳ +${pending.toFixed(6)} {asset}</span></div>
          )}
        </div>

        <div className="mt-6 space-y-2.5">
          {/* 1) Yield only — anytime */}
          <button
            onClick={onWithdrawYield}
            disabled={yieldDisabled}
            className="w-full rounded-xl bg-gradient-to-r from-brand-dark to-brand py-3.5 font-display font-bold text-white hover:shadow-lg hover:shadow-brand/20 disabled:opacity-50"
          >
            {busy ? "Submitting…" : pending > 0 ? "Yield withdrawal processing…" : "Withdraw earned yield"}
            <span className="block text-[11px] font-normal text-white/80">
              {pending > 0 ? "Awaiting approval · nothing deducted yet" : "Principal keeps earning · available anytime"}
            </span>
          </button>

          {/* 2) Yield + principal + exit — needs unlocked principal */}
          <button
            onClick={onWithdrawAll}
            disabled={busy || locked}
            title={locked ? "Principal is still locked" : undefined}
            className="w-full rounded-xl border border-surface-4/60 py-3 font-display font-semibold text-slate-200 hover:border-brand/40 hover:bg-brand/[0.06] disabled:opacity-50 disabled:hover:border-surface-4/60 disabled:hover:bg-transparent"
          >
            Withdraw yield + principal & exit
            <span className="block text-[11px] font-normal text-slate-400">
              {locked ? `Principal unlocks in ${dd}d ${String(hh).padStart(2,"0")}h ${String(mm).padStart(2,"0")}m` : "Returns your principal and closes this deposit"}
            </span>
          </button>

          {/* 3) Keep accumulating */}
          <button
            onClick={onClose}
            disabled={busy}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            Keep accumulating yield
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Reassuring (and honest) "we're processing it" modal shown right after a withdrawal /
 * redemption is submitted. It tells the user what's actually happening — the request is
 * queued, verified, and settled on-chain — without inventing fake protocol-sourcing steps.
 */
function WithdrawProcessingModal({ info, onClose }) {
  const heading =
    info.kind === "exit" ? "Withdrawal & exit submitted" :
    info.kind === "redeem" ? "Redemption submitted" :
    "Withdrawal submitted";
  const amountLine =
    info.amount != null ? `$${Number(info.amount).toFixed(2)} ${info.asset}` : null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md px-4" onClick={onClose}>
      <div className="glass relative w-full max-w-md rounded-2xl p-7 text-center ring-1 ring-white/[0.06]" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10">
          <svg className="h-8 w-8 animate-spin text-brand" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <h3 className="font-display text-xl font-bold text-white">{heading}</h3>
        {amountLine && <p className="mt-1 font-display text-2xl font-bold text-brand">{amountLine}</p>}
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          {info.note || <>Your request is being processed and settled on-chain. This usually completes shortly —
          you can track its status anytime under <span className="text-slate-200 font-medium">Withdrawals</span> below,
          and we'll send the funds to your wallet once it's confirmed.</>}
        </p>
        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
          Processing — no further action needed
        </div>
        <button onClick={onClose} className="mt-6 w-full rounded-xl bg-gradient-to-r from-brand-dark to-brand py-3 font-display font-bold text-white hover:shadow-lg hover:shadow-brand/20">
          Got it
        </button>
      </div>
    </div>
  );
}

/** Enough precision that small vault accruals aren’t shown as $0.00 in the Yield card */
function formatYieldBalanceUsd(n) {
  const x = Number(n) || 0;
  if (x === 0) return "0.00";
  if (Math.abs(x) < 0.01) return x.toFixed(6);
  if (Math.abs(x) < 1) return x.toFixed(4);
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function LockCountdown({ unlockAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(unlockAt).getTime() - now;
  if (ms <= 0) return <span className="tag tag-green text-xs">Unlocked</span>;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return (
    <div className="text-right">
      <div className="text-[10px] text-muted uppercase tracking-wider">Unlocks in</div>
      <div className="font-mono text-sm font-semibold text-yellow-400">
        {d}d {String(h).padStart(2, "0")}h {String(m).padStart(2, "0")}m {String(s).padStart(2, "0")}s
      </div>
    </div>
  );
}

/**
 * Live, per-second yield view for one deposit.
 *  • "earning" = continuous real-time earned-so-far (accrues every second), capped at term.
 *  • Yield is withdrawable ANYTIME — there is no 30-day payout gate on yield.
 *  • Only the PRINCIPAL is time-locked (30 days); we show its unlock countdown here.
 * apyPercent is the ANNUAL APY %; monthly = annual / 12; hourly = monthly / (30·24).
 */
function LiveYield({ deposit, pendingYield = 0 }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const CYCLE_MS = 30 * 24 * 60 * 60 * 1000;
  const amount = Number(deposit.amount || 0);
  const monthlyYield = (amount * (Number(deposit.apyPercent || 0) / 12)) / 100;
  const perHour = monthlyYield / (30 * 24);

  const createdMs = deposit.createdAt ? new Date(deposit.createdAt).getTime() : now;
  const elapsedMs = Math.max(0, now - createdMs);
  const maxPayments = Number(deposit.maxYieldPayments || 0);

  const maxTotal = monthlyYield * maxPayments;
  const accruedRaw = monthlyYield * (elapsedMs / CYCLE_MS);
  const entitled = maxPayments ? Math.min(accruedRaw, maxTotal) : accruedRaw;
  const withdrawnY = Number(deposit.yieldWithdrawn || 0);
  const grossEarned = entitled;                          // lifetime earned — NEVER resets
  const pending = Number(pendingYield || 0);             // amount in a pending (processing) request
  const withdrawable = Math.max(0, entitled - withdrawnY - pending); // free to withdraw right now
  const matured = maxPayments > 0 && entitled >= maxTotal - 1e-12;

  // principal lock countdown (the ONLY 30-day timer that remains)
  const unlockMs = deposit.lockUntil ? new Date(deposit.lockUntil).getTime() : 0;
  const locked = unlockMs > now;
  const lms = Math.max(0, unlockMs - now);
  const ld = Math.floor(lms / 86400000), lh = Math.floor((lms % 86400000) / 3600000), lm = Math.floor((lms % 3600000) / 60000);

  const live = amount > 0 && monthlyYield > 0;

  return (
    <div className="mt-1 space-y-0.5">
      {/* Lifetime earned — keeps growing, never drops, even after you withdraw */}
      <div className="text-xs font-mono font-semibold text-yellow-400">
        +${grossEarned.toFixed(6)} earned
      </div>
      {/* What's actually available to withdraw right now (drops after a withdrawal, then climbs again) */}
      <div className="text-[11px] text-muted">
        Withdrawable: <span className="text-emerald-300 font-mono">+${withdrawable.toFixed(6)}</span>
        {pending > 0 && <span className="text-amber-300/90 font-mono"> · ⟳ ${pending.toFixed(6)} processing</span>}
      </div>
      <div className="text-[11px] text-muted">
        {live ? <>≈ ${perHour.toFixed(8)}/hr</> : <>≈ —</>}
      </div>
      <div className="text-[11px] text-emerald-400/80">
        {matured ? "Term complete" : "Yield withdrawable anytime"}
      </div>
      <div className="text-[11px] text-muted">
        {locked
          ? <>Principal unlocks in {ld}d {String(lh).padStart(2, "0")}h {String(lm).padStart(2, "0")}m</>
          : <span className="text-slate-300">Principal unlocked</span>}
      </div>
    </div>
  );
}

export default function Portfolio() {
  const { token, user, refreshUser } = useWeb3();
  const [deposits, setDeposits] = useState([]);
  const [yieldLogs, setYieldLogs] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [processingModal, setProcessingModal] = useState(null); // { amount, asset, kind }
  const [redeemModal, setRedeemModal] = useState(null); // the deposit the user is choosing to redeem
  const [loading, setLoading] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const hdr = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

  const load = () => {
    if (!token) return;
    fetch(`${API}/api/user/deposits?page=1&limit=50`, { headers: hdr() })
      .then(r => r.json()).then(d => setDeposits(d.data?.deposits || [])).catch(() => {});
    fetch(`${API}/api/user/yield-logs?page=1&limit=20`, { headers: hdr() })
      .then(r => r.json()).then(d => setYieldLogs(d.data?.logs || [])).catch(() => {});
    fetch(`${API}/api/user/withdrawals?page=1&limit=20`, { headers: hdr() })
      .then(r => r.json()).then(d => setWithdrawals(d.data?.requests || [])).catch(() => {});
    refreshUser();
  };

  useEffect(() => {
    load();
    if (!token) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [token]);

  const handleWithdraw = async (amount, asset, source) => {
    if (!user?.walletAddress) { toast.error("No wallet connected"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/user/withdraw`, {
        method: "POST", headers: hdr(),
        body: JSON.stringify({ amount, asset, source, walletAddress: user.walletAddress }),
      });
      const d = await res.json();
      if (d.status === 201) { setProcessingModal({ amount, asset, kind: source === "referral" ? "referral" : "yield" }); load(); }
      else toast.error(d.message);
    } catch { toast.error("Failed"); }
    setLoading(false);
  };

  // Opening the modal first — what to withdraw is now an explicit choice.
  const openRedeem = (deposit) => {
    if (!user?.walletAddress) { toast.error("No wallet connected"); return; }
    setRedeemModal(deposit);
  };

  const postWithdraw = (body) =>
    fetch(`${API}/api/user/withdraw`, { method: "POST", headers: hdr(), body: JSON.stringify(body) }).then(r => r.json());

  // 1) Withdraw only the yield earned so far for THIS deposit (principal stays, keeps earning). Anytime.
  const withdrawYieldOnly = async (deposit) => {
    if (!deposit) return;
    setLoading(deposit._id);
    try {
      const d = await postWithdraw({ source: "yield", depositId: deposit._id, asset: deposit.asset, walletAddress: user.walletAddress });
      if (d.status === 201) { setRedeemModal(null); setProcessingModal({ amount: d.data?.amount ?? null, asset: deposit.asset, kind: "yield" }); load(); }
      else toast.error(d.message || "Failed");
    } catch { toast.error("Failed"); }
    setLoading(null);
  };

  // 2) Withdraw THIS deposit's earned yield AND its principal, then exit (principal must be unlocked).
  const withdrawYieldAndExit = async (deposit) => {
    if (!deposit) return;
    setLoading(deposit._id);
    try {
      // Try the yield first. It's fine if there's nothing new (already processing / $0) —
      // we still submit the principal, and we tell the user exactly what happened.
      const y = await postWithdraw({ source: "yield", depositId: deposit._id, asset: deposit.asset, walletAddress: user.walletAddress });
      const yieldSubmitted = y.status === 201;
      const d = await postWithdraw({ source: "deposit", depositId: deposit._id, walletAddress: user.walletAddress });
      if (d.status === 201) {
        setRedeemModal(null);
        setProcessingModal({
          amount: null, asset: deposit.asset, kind: "exit",
          note: yieldSubmitted
            ? "Both your earned yield and your principal have been submitted."
            : "Your principal has been submitted. (Your earned yield was already being processed in a separate request — check Withdrawals below.)",
        });
        load();
      } else toast.error(d.message || "Failed");
    } catch { toast.error("Failed"); }
    setLoading(null);
  };

  const handleRedeemAll = async (depositIds) => {
    if (!user?.walletAddress) { toast.error("No wallet connected"); return; }
    if (!depositIds?.length) return;
    if (!confirm(`Redeem all ${depositIds.length} redeemable deposits? Your principal will be returned to your wallet once processed on-chain.`)) return;
    setBulkLoading(true);
    try {
      let ok = 0;
      let skipped = 0;
      for (const depositId of depositIds) {
        const res = await fetch(`${API}/api/user/withdraw`, {
          method: "POST",
          headers: hdr(),
          body: JSON.stringify({ source: "deposit", depositId, walletAddress: user.walletAddress }),
        });
        const d = await res.json();
        if (d?.status === 201) ok++;
        else skipped++;
      }
      toast.success(`Submitted ${ok} redemption${ok === 1 ? "" : "s"}${skipped ? ` (${skipped} already pending/unavailable)` : ""}`);
      load();
    } catch {
      toast.error("Failed to redeem all");
    } finally {
      setBulkLoading(false);
    }
  };

  if (!token) return (
    <div className="max-w-4xl mx-auto px-6 py-20 text-center">
      <h2 className="font-display font-bold text-2xl mb-4">Sign In Required</h2>
      <p className="text-muted mb-6">Connect your wallet and verify your email to view your portfolio.</p>
    </div>
  );

  // Show deposits that still hold principal: "active" AND "matured". A matured deposit
  // still holds the user's principal until it's redeemed, so it must stay visible — and
  // this also surfaces any deposit that was flagged matured earlier, with NO database edit.
  const activeDeposits = deposits.filter(d => d.status === "active" || d.status === "matured");
  const nowTs = Date.now();
  const totalStaked = activeDeposits.reduce((sum, d) => sum + (d.amount || 0), 0);

  // Pending YIELD withdrawals per deposit — so a withdrawn-but-not-yet-approved amount is
  // shown as "Processing" on that pool instead of looking wiped. (If the admin rejects it,
  // the backend restores it and it becomes withdrawable again automatically.)
  const pendingYieldByDeposit = {};
  withdrawals.forEach(w => {
    if (w.source === "yield" && w.status === "pending") {
      const id = w.depositId?._id || w.depositId;
      if (id) pendingYieldByDeposit[id] = (pendingYieldByDeposit[id] || 0) + Number(w.amount || 0);
    }
  });

  const redeemableDeposits = activeDeposits.filter((d) => {
    const lockDate = d.lockUntil ? new Date(d.lockUntil) : null;
    const isLocked = lockDate && lockDate.getTime() > nowTs;
    return !isLocked && !d.redemptionPending;
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="font-display font-bold text-3xl mb-2">Portfolio</h1>
      <p className="text-muted mb-8">Your deposits, yield earnings, and balances</p>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="glass p-5">
          <div className="text-xs text-muted mb-1 uppercase tracking-wider">Total Deposited</div>
          <div className="text-2xl font-display font-bold">${totalStaked.toLocaleString()}</div>
        </div>
        <div className="glass p-5">
          <div className="text-xs text-muted mb-1 uppercase tracking-wider">Yield</div>
          <div className="text-2xl font-display font-bold text-brand">
            ${formatYieldBalanceUsd(user?.yieldWalletUSDT)}
          </div>
          {(user?.yieldWalletUSDT || 0) > 0 && (
            <button onClick={() => handleWithdraw(user.yieldWalletUSDT, "USDT", "yield")}
              className="text-xs text-brand mt-2 hover:underline">Withdraw →</button>
          )}
        </div>
        <div className="glass p-5">
          <div className="text-xs text-muted mb-1 uppercase tracking-wider">Referral Earnings</div>
          <div className="text-2xl font-display font-bold text-blue-400">${(user?.referralEarnings || 0).toFixed(2)}</div>
          {(user?.referralEarnings || 0) > 0 && (
            <button onClick={() => handleWithdraw(user.referralEarnings, "USDT", "referral")}
              className="text-xs text-blue-400 mt-2 hover:underline">Withdraw →</button>
          )}
        </div>
      </div>

      {/* Active Deposits */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-xl">Active Deposits ({activeDeposits.length})</h2>
        {redeemableDeposits.length > 0 && (
          <button
            onClick={() => handleRedeemAll(redeemableDeposits.map((d) => d._id))}
            disabled={bulkLoading}
            className="bg-brand/10 text-brand border border-brand/20 rounded-lg px-4 py-1.5 text-xs font-semibold hover:bg-brand/20 disabled:opacity-50"
          >
            {bulkLoading ? "Redeeming..." : "Redeem all →"}
          </button>
        )}
      </div>
      {activeDeposits.length === 0 ? (
        <div className="glass p-10 text-center">
          <p className="text-muted mb-4">No active deposits yet.</p>
          <Link to="/pools" className="btn-primary inline-block">Explore Vaults</Link>
        </div>
      ) : (
        <div className="space-y-3 mb-10">
          {activeDeposits.map((d, i) => {
            const lockDate = d.lockUntil ? new Date(d.lockUntil) : null;
            const isLocked = lockDate && lockDate > new Date();
            const vaultId = typeof d.vaultId === "object" ? d.vaultId?._id : d.vaultId;
            const vaultName = d.vaultId?.name || "Vault";
            const annualApy = Number(d.poolApy ?? (d.apyPercent || 0)).toFixed(1);
            const monthlyApy = Number(d.poolApyMonthly ?? ((d.apyPercent || 0) / 12));
            // Live accrual + 30-day payout countdown are handled by <LiveYield/> below.
            return (
              <div key={i} className="glass p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold font-display ${d.asset === "USDC" ? "bg-blue-500/15 text-blue-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                    {d.asset === "USDC" ? "$" : "₮"}
                  </div>
                  <div>
                    {vaultId ? (
                      <Link to={`/pool/${vaultId}`} className="font-semibold hover:text-brand transition-colors">{vaultName} →</Link>
                    ) : (
                      <div className="font-semibold">{vaultName}</div>
                    )}
                    <div className="text-sm text-muted">${d.amount?.toLocaleString()} {d.asset} · {annualApy}% APY ({monthlyApy.toFixed(2)}%/mo)</div>
                  </div>
                </div>
                <div className="text-right">
                  {d.redemptionPending ? (
                    <span className="tag tag-yellow text-xs">Redemption Pending</span>
                  ) : (
                    <button
                      onClick={() => openRedeem(d)}
                      disabled={loading === d._id || bulkLoading}
                      className="bg-brand/10 text-brand border border-brand/20 rounded-lg px-4 py-1.5 text-xs font-semibold hover:bg-brand/20 disabled:opacity-50">
                      {loading === d._id ? "..." : "Withdraw →"}
                    </button>
                  )}
                  <LiveYield deposit={d} pendingYield={pendingYieldByDeposit[d._id] || 0} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Withdrawals History (active + completed; rejected requests are refunded and not listed) */}
      {withdrawals.filter(w => w.status !== "rejected").length > 0 && (
        <>
          <h2 className="font-display font-semibold text-xl mb-4 mt-10">Withdrawals</h2>
          <div className="glass overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-muted border-b border-surface-4">
                <th className="text-left p-3">Type</th><th className="text-left p-3">Status</th>
                <th className="text-right p-3">Amount</th><th className="text-right p-3">Date</th>
              </tr></thead>
              <tbody>
                {withdrawals.filter(w => w.status !== "rejected").map((w, i) => {
                  const typeLabel = w.source === "deposit" ? "Redemption" : w.source === "referral" ? "Referral" : "Yield";
                  const amt = w.source === "deposit" ? (w.depositId?.amount ?? w.amount) : w.amount;
                  const st = STATUS_META[w.status] || STATUS_META.pending;
                  return (
                    <tr key={w._id || i} className="border-b border-surface-4/20">
                      <td className="p-3 text-muted">{typeLabel}</td>
                      <td className="p-3"><span className={`tag text-[10px] ${st.cls}`}>{st.label}</span></td>
                      <td className="p-3 text-right font-semibold text-slate-200">${Number(amt || 0).toFixed(4)} {w.asset}</td>
                      <td className="p-3 text-right text-xs text-muted">{new Date(w.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Recent Yield History */}
      {yieldLogs.length > 0 && (
        <>
          <h2 className="font-display font-semibold text-xl mb-4 mt-10">Recent Yield Payments</h2>
          <div className="glass overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-muted border-b border-surface-4">
                <th className="text-left p-3">Source</th><th className="text-left p-3">Vault</th>
                <th className="text-right p-3">Amount</th><th className="text-right p-3">Date</th>
              </tr></thead>
              <tbody>
                {yieldLogs.map((l, i) => (
                  <tr key={i} className="border-b border-surface-4/20">
                    <td className="p-3"><span className={`tag text-[10px] ${l.source === 'vault_apy' ? 'tag-green' : 'tag-blue'}`}>{l.source?.replace(/_/g, " ")}</span></td>
                    <td className="p-3 text-muted">{l.vaultId?.name || "—"}</td>
                    <td className="p-3 text-right font-semibold text-brand">+${formatYieldBalanceUsd(l.amount)} {l.asset}</td>
                    <td className="p-3 text-right text-xs text-muted">{new Date(l.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {redeemModal && (
        <RedeemChoiceModal
          deposit={redeemModal}
          busy={loading === redeemModal._id}
          pendingYield={pendingYieldByDeposit[redeemModal._id] || 0}
          onWithdrawYield={() => withdrawYieldOnly(redeemModal)}
          onWithdrawAll={() => withdrawYieldAndExit(redeemModal)}
          onClose={() => setRedeemModal(null)}
        />
      )}
      {processingModal && <WithdrawProcessingModal info={processingModal} onClose={() => setProcessingModal(null)} />}
    </div>
  );
}