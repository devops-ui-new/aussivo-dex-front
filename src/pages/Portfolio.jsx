import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import toast from "react-hot-toast";

import { API } from "../config/api";
import { createPortal } from "react-dom";
import { GenerativeArt, shortHash, asHash } from "../components/GenerativeArt";

/** Withdrawal status → friendly label + pill style. */
const STATUS_META = {
  pending:   { label: "Processing", cls: "tag-yellow" },
  approved:  { label: "Processing", cls: "tag-yellow" },
  completed: { label: "Completed",  cls: "tag-green" },
  rejected:  { label: "Rejected",   cls: "tag-red" },
};

/**
 * Principal redemption. Principal is withdrawable ANYTIME. Within 30 days of the deposit a 1%
 * early-exit fee applies AND the current (un-matured) cycle's yield is forfeited. Yield that has
 * already matured is kept — it lives in the separate "Matured Yield" balance and is withdrawn there.
 */
function RedeemChoiceModal({ deposit, busy, onRedeem, onClose }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const asset = deposit?.asset || "";
  const principal = Number(deposit?.amount || 0);
  const vaultName = deposit?.vaultId?.name || "this vault";

  const y = computeYield(deposit || {}, now);
  const fee = y.early ? principal * 0.01 : 0;
  const net = principal - fee;
  const forfeited = y.liveThisCycle;

  // Countdown to the end of the 1% fee window (30 days from deposit).
  const ms = Math.max(0, y.feeWindowEndsMs - now);
  const dd = Math.floor(ms / 86400000), hh = Math.floor((ms % 86400000) / 3600000), mm = Math.floor((ms % 3600000) / 60000);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md px-4" onClick={onClose}>
      <div className="glass relative w-full max-w-md rounded-2xl p-7 ring-1 ring-white/[0.06]" onClick={e => e.stopPropagation()}>
        <h3 className="font-display text-xl font-bold text-white text-center">Redeem principal</h3>

        <div className="mt-4 rounded-xl border border-surface-4/50 bg-[#0d1324] p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Principal in {vaultName}</span><span className="font-semibold text-slate-100">${principal.toLocaleString()} {asset}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Matured yield (kept)</span><span className="font-mono font-semibold text-emerald-400">${y.maturedSoFar.toFixed(6)} {asset}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">This cycle's yield (forfeited)</span><span className="font-mono font-semibold text-slate-400">−${forfeited.toFixed(6)} {asset}</span></div>
          {y.early && (
            <div className="flex justify-between"><span className="text-amber-300/90">Early-exit fee (1%)</span><span className="font-mono font-semibold text-amber-300">−${fee.toFixed(6)} {asset}</span></div>
          )}
          <div className="flex justify-between border-t border-surface-4/40 pt-2"><span className="text-slate-300">You receive</span><span className="font-mono font-bold text-white">${net.toFixed(6)} {asset}</span></div>
        </div>

        {y.early ? (
          <div className="mt-3 rounded-lg bg-amber-500/[0.07] border border-amber-500/20 px-3 py-2 text-[11px] text-amber-200/90">
            You're within the first 30 days ({dd}d {String(hh).padStart(2,"0")}h {String(mm).padStart(2,"0")}m left). Redeeming now costs a 1% fee and forfeits this cycle's un-matured yield. Wait until the cycle completes to redeem fee-free and let this cycle's yield mature.
          </div>
        ) : (
          <div className="mt-3 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15 px-3 py-2 text-[11px] text-emerald-200/80">
            No early-exit fee. Your matured yield stays in your Matured Yield balance — withdraw it there anytime. Only this cycle's un-matured portion is forfeited on exit.
          </div>
        )}

        <div className="mt-6 space-y-2.5">
          <button
            onClick={onRedeem}
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-brand-dark to-brand py-3.5 font-display font-bold text-white hover:shadow-lg hover:shadow-brand/20 disabled:opacity-50"
          >
            {busy ? "Submitting…" : y.early ? `Redeem now — 1% fee (get $${net.toFixed(2)})` : "Redeem principal & exit"}
            <span className="block text-[11px] font-normal text-white/80">Returns your principal and closes this deposit</span>
          </button>
          <button onClick={onClose} disabled={busy} className="w-full rounded-xl py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-50">
            Keep earning
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
    info.kind === "referral" ? "Referral withdrawal submitted" :
    "Yield withdrawal submitted";
  const amountLine =
    info.amount != null ? `$${Number(info.amount).toFixed(Number(info.amount) < 1 ? 6 : 2)} ${info.asset}` : null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md px-4" style={{ animation: "wpmFade .2s ease" }} onClick={onClose}>
      <style>{`
        @keyframes wpmFade{from{opacity:0}to{opacity:1}}
        @keyframes wpmPop{0%{transform:scale(.92);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes wpmDraw{to{stroke-dashoffset:0}}
        @keyframes wpmBar{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}
      `}</style>
      <div className="glass relative w-full max-w-md rounded-2xl p-7 text-center ring-1 ring-white/[0.06]" style={{ animation: "wpmPop .25s ease" }} onClick={e => e.stopPropagation()}>
        {/* animated checkmark inside a pulsing ring */}
        <div className="mx-auto mb-5 relative flex h-16 w-16 items-center justify-center rounded-full bg-brand/10">
          <span className="absolute inset-0 rounded-full border border-brand/30 animate-ping" />
          <svg className="h-8 w-8 text-brand" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
            <path d="M7 12.5l3 3 7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="20" strokeDashoffset="20" style={{ animation: "wpmDraw .5s .2s ease forwards" }} />
          </svg>
        </div>
        <h3 className="font-display text-xl font-bold text-white">{heading}</h3>
        {amountLine && <p className="mt-1 font-display text-2xl font-bold text-brand">{amountLine}</p>}

        {/* ETA badge */}
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-4 py-1.5 text-sm font-semibold text-brand">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" /></svg>
          Arrives in 4–24 hours
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          {info.note || <>Your withdrawal is being processed and settled on-chain. Once approved, the funds are sent to your wallet — this usually completes within <span className="text-slate-200 font-medium">4–24 hours</span>. You can track its status anytime under <span className="text-slate-200 font-medium">Withdrawals</span> below.</>}
        </p>

        {/* indeterminate progress bar */}
        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-brand-dark to-brand" style={{ animation: "wpmBar 1.4s ease-in-out infinite" }} />
        </div>
        <div className="mt-2 text-xs text-slate-500">Processing — no further action needed</div>

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

// Compute one deposit's yield numbers under the 30-day maturation model.
//  • liveThisCycle: yield accruing in the CURRENT (incomplete) 30-day cycle. Climbs from 0 to
//    one monthly-yield, then resets to 0 when the cycle matures. NOT withdrawable.
//  • maturedSoFar: cumulative yield that has already matured into the withdrawable balance.
//  • nextMaturationMs: timestamp when the current cycle completes and matures.
function computeYield(deposit, now) {
  const CYCLE_MS = 30 * 24 * 60 * 60 * 1000;
  const amount = Number(deposit.amount || 0);
  const monthlyYield = (amount * (Number(deposit.apyPercent || 0) / 12)) / 100;
  const perHour = monthlyYield / (30 * 24);
  const perDay = monthlyYield / 30;
  const createdMs = deposit.createdAt ? new Date(deposit.createdAt).getTime() : now;
  const elapsedMs = Math.max(0, now - createdMs);
  // No term cap: cycles keep maturing for as long as the principal stays staked.
  const completedCycles = Math.floor(elapsedMs / CYCLE_MS);
  const fracMs = elapsedMs - completedCycles * CYCLE_MS;
  const liveThisCycle = monthlyYield * (fracMs / CYCLE_MS);
  const nextMaturationMs = createdMs + (completedCycles + 1) * CYCLE_MS;
  const maturedSoFar = Math.max(Number(deposit.maturedYield || 0), Number(deposit.totalYieldPaid || 0));
  const unlockMs = deposit.lockUntil ? new Date(deposit.lockUntil).getTime() : 0;
  // Early-exit fee window: within 30 days of the deposit, principal redemption costs 1%.
  const feeWindowEndsMs = createdMs + CYCLE_MS;
  return {
    amount, monthlyYield, perHour, perDay, completedCycles,
    liveThisCycle, nextMaturationMs, maturedSoFar,
    unlockMs, locked: unlockMs > now,
    early: now < feeWindowEndsMs, feeWindowEndsMs,
  };
}


/**
 * Live, per-second view for one deposit under the 30-day maturation model.
 *  • "accruing this cycle" ticks up every second, then RESETS to 0 when the 30-day cycle matures.
 *  • matured yield moves to the withdrawable "Matured Yield" balance (shown at the top).
 * apyPercent is the ANNUAL APY %; monthly = annual / 12; hourly = monthly / (30·24).
 */
function LiveYield({ deposit }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const y = computeYield(deposit, now);
  const live = y.amount > 0 && y.monthlyYield > 0;

  // Countdown to the next maturation (when this cycle's yield becomes withdrawable).
  const nms = Math.max(0, y.nextMaturationMs - now);
  const nd = Math.floor(nms / 86400000), nh = Math.floor((nms % 86400000) / 3600000), nm = Math.floor((nms % 3600000) / 60000);

  return (
    <div className="mt-1 space-y-0.5">
      {/* Accruing this cycle — resets to 0 each time a 30-day cycle matures */}
      <div className="text-xs font-mono font-semibold text-yellow-400">
        +${y.liveThisCycle.toFixed(6)} <span className="font-sans font-normal text-muted">accruing this cycle</span>
      </div>
      {/* Matured (already moved to your withdrawable Matured Yield balance) */}
      <div className="text-[11px] text-muted">
        Matured: <span className="text-emerald-300 font-mono">+${y.maturedSoFar.toFixed(6)}</span>
        <span className="text-slate-500"> · in Matured Yield balance</span>
      </div>
      <div className="text-[11px] text-muted">
        {live ? <>≈ ${y.perDay.toFixed(6)}/day</> : <>≈ —</>}
      </div>
      <div className="text-[11px] text-emerald-400/80">
        Matures in {nd}d {String(nh).padStart(2, "0")}h {String(nm).padStart(2, "0")}m
      </div>
    </div>
  );
}

/**
 * Read-only card summing the live (un-matured) yield accruing across all active deposits in the
 * current 30-day cycle. Ticks every second and resets whenever a deposit's cycle matures — this
 * is the "main portfolio yield that restarts from 0" each cycle. Not withdrawable.
 */
function AccruingThisCycleCard({ deposits }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  let live = 0, perDay = 0;
  for (const d of deposits) { const y = computeYield(d, now); live += y.liveThisCycle; perDay += y.perDay; }
  return (
    <div className="glass p-5">
      <div className="text-sm text-muted mb-1 uppercase tracking-wider">Accruing This Cycle</div>
      <div className="text-3xl font-display font-bold text-yellow-400 font-mono">${live.toFixed(6)}</div>
      <div className="text-[11px] text-muted mt-1">≈ ${perDay.toFixed(6)}/day · matures every 30 days</div>
    </div>
  );
}

// Cosmetic, stable "vault" address derived from a seed — NOT the user's real wallet and NOT a
// real payout address. It's a decorative identifier for the matured-yield storage vault shown
// in the UI. Payouts are always sent to the user's actual connected wallet on the backend.
function vaultAddressFromSeed(seed) {
  const s = String(seed || "aussivo-matured-yield-vault");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  let x = h >>> 0, hex = "";
  while (hex.length < 40) {
    x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
    x = (x + 0x9e3779b9) >>> 0;
    hex += x.toString(16).padStart(8, "0");
  }
  return "0x" + hex.slice(0, 40);
}

/**
 * Matured Yield "vault" tab — a wallet-style panel that holds the user's matured (withdrawable)
 * yield. This is the ONLY place a yield withdrawal request can be started. The address shown is a
 * cosmetic vault identifier; actual payouts go to the user's connected wallet after admin review.
 */
function MaturedYieldWallet({ user, withdrawals, loading, onWithdraw, seed }) {
  const usdt = Number(user?.yieldWalletUSDT || 0);
  const usdc = Number(user?.yieldWalletUSDC || 0);
  const total = usdt + usdc;
  const vaultAddr = vaultAddressFromSeed(seed);
  const shortAddr = `${vaultAddr.slice(0, 12)}…${vaultAddr.slice(-8)}`;

  const pendingByAsset = {};
  (withdrawals || []).forEach((w) => {
    if (w.source === "yield" && (w.status === "pending" || w.status === "approved")) {
      pendingByAsset[w.asset] = (pendingByAsset[w.asset] || 0) + Number(w.amount || 0);
    }
  });
  const yieldReqs = (withdrawals || []).filter((w) => w.source === "yield" && w.status !== "rejected");

  const AssetRow = ({ asset, bal }) => {
    const pending = pendingByAsset[asset] || 0;
    const isProcessing = pending > 0;
    const isEmpty = bal < 1e-6;
    const disabled = loading || isEmpty || isProcessing;

    // Only ONE pending yield withdrawal per asset is allowed (the backend enforces the same
    // rule), so the button explains *why* it's unavailable rather than just greying out.
    const label = loading ? "…"
      : isProcessing ? "Withdrawal in progress"
      : isEmpty ? "Nothing to withdraw"
      : "Request Withdrawal";

    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-surface-4/40 bg-[#0d1324]/60 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">{asset}</div>
          <div className="font-mono text-lg font-bold text-brand">${formatYieldBalanceUsd(bal)}</div>
          {isProcessing && <div className="text-[11px] text-amber-300/90">⟳ ${formatYieldBalanceUsd(pending)} processing · typically 4–24 hours</div>}
          {!isProcessing && isEmpty && <div className="text-[11px] text-muted">Yield becomes withdrawable when its 30-day cycle completes</div>}
        </div>
        <div className="shrink-0 text-right">
          <button
            onClick={() => onWithdraw(bal, asset, "yield")}
            disabled={disabled}
            className={`rounded-xl px-4 py-2.5 text-sm font-display font-bold transition-colors ${
              disabled
                ? "bg-surface-4/40 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-brand-dark to-brand text-white hover:shadow-lg hover:shadow-brand/20"
            }`}
          >
            {label}
          </button>
          {isProcessing && (
            <div className="mt-1 text-[10px] text-muted">One request at a time per asset</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mb-10">
      {/* Wallet-style vault card */}
      <div className="relative overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-br from-brand/[0.10] via-surface-1/70 to-surface-1/70 p-6">
        {/* generative art wash — matches the position cards' aesthetic */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.16]">
          <GenerativeArt seed={`matured:${seed}`} className="h-full w-full" animate={false} />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-surface-1/40 via-surface-1/70 to-surface-1/90" />
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/15 text-brand">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h18v12H3z" strokeLinejoin="round"/><path d="M16 12h3M3 7l3-3h12l3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <div className="font-display text-base font-bold text-white">Matured Yield Vault</div>
              <div className="text-[11px] text-muted">Holds your withdrawable, matured yield</div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-surface-4/40 bg-[#0d1324]/60 px-3 py-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Vault</span>
            <span className="font-mono text-sm text-slate-200">{shortAddr}</span>
          </div>

          <div className="mt-5">
            <div className="text-xs text-muted uppercase tracking-wider">Total matured · withdrawable</div>
            <div className="font-display text-3xl font-bold text-white">${formatYieldBalanceUsd(total)}</div>
          </div>

          <div className="mt-4 space-y-2">
            <AssetRow asset="USDT" bal={usdt} />
            {(usdc > 0 || pendingByAsset.USDC) && <AssetRow asset="USDC" bal={usdc} />}
          </div>

          <div className="mt-4 rounded-lg bg-brand/[0.06] border border-brand/15 px-3 py-2 text-[11px] text-slate-300">
            Withdrawal requests are reviewed and disbursed by our team on-chain. As funds are accumulated and batched, payouts <span className="text-slate-100 font-medium">typically take 4–24 hours</span> to arrive in your connected wallet. You can track status under History.
          </div>
        </div>
      </div>

      {/* Matured-yield request history */}
      {yieldReqs.length > 0 && (
        <div className="glass overflow-hidden mt-6">
          <div className="px-4 pt-4 pb-2 text-sm font-display font-semibold text-white">Matured yield requests</div>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-muted border-b border-surface-4">
              <th className="text-left p-3">Status</th><th className="text-right p-3">Amount</th><th className="text-right p-3">Requested</th>
            </tr></thead>
            <tbody>
              {yieldReqs.map((w, i) => {
                const st = STATUS_META[w.status] || STATUS_META.pending;
                const processing = w.status === "pending" || w.status === "approved";
                return (
                  <tr key={w._id || i} className="border-b border-surface-4/20">
                    <td className="p-3">
                      <span className={`tag text-[10px] ${st.cls}`}>{st.label}</span>
                      {processing && <div className="text-[10px] text-muted mt-0.5">typically 4–24 hours</div>}
                    </td>
                    <td className="p-3 text-right font-semibold text-slate-200">${Number(w.amount || 0).toFixed(4)} {w.asset}</td>
                    <td className="p-3 text-right text-xs text-muted">{new Date(w.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Shared 1-second clock: every card subscribes to ONE interval (no timer sprawl). ──
const __clockSubs = new Set();
let __clockTimer = null;
let __clockNow = Date.now();
function useNow() {
  const [now, setNow] = useState(__clockNow);
  useEffect(() => {
    const fn = (t) => setNow(t);
    __clockSubs.add(fn);
    if (!__clockTimer) {
      __clockTimer = setInterval(() => { __clockNow = Date.now(); __clockSubs.forEach((f) => f(__clockNow)); }, 1000);
    }
    return () => {
      __clockSubs.delete(fn);
      if (__clockSubs.size === 0 && __clockTimer) { clearInterval(__clockTimer); __clockTimer = null; }
    };
  }, []);
  return now;
}


/**
 * GroupedPositionCard — ONE card per pool (vault + asset), aggregating all of the user's
 * deposits in it. Shows totals (principal, accruing, matured), blended APY, deposit count and
 * lock summary. Click → GroupDetailModal with the full per-deposit breakdown. Scales cleanly
 * whether the user has 1 or 100 deposits in the pool.
 */
function GroupedPositionCard({ deposits, onOpen }) {
  const now = useNow();
  const first = deposits[0];
  const asset = first.asset;
  const vaultName = first.vaultId?.name || "Vault";
  const vaultId = typeof first.vaultId === "object" ? first.vaultId?._id : first.vaultId;

  let principal = 0, accruing = 0, matured = 0, perDay = 0, soonest = Infinity, locked = 0, apyW = 0, pending = 0;
  for (const d of deposits) {
    const y = computeYield(d, now);
    principal += y.amount; accruing += y.liveThisCycle; matured += y.maturedSoFar; perDay += y.perDay;
    apyW += y.amount * Number(d.poolApy ?? d.apyPercent ?? 0);
    if (y.nextMaturationMs) soonest = Math.min(soonest, y.nextMaturationMs);
    if (y.locked) locked++;
    if (d.redemptionPending) pending++;
  }
  const blendedApy = principal > 0 ? apyW / principal : Number(first.apyPercent || 0);
  const nms = soonest !== Infinity ? Math.max(0, soonest - now) : 0;
  const nd = Math.floor(nms / 86400000), nh = Math.floor((nms % 86400000) / 3600000), nmm = Math.floor((nms % 3600000) / 60000);

  return (
    <button
      onClick={() => onOpen(deposits)}
      className="group text-left glass overflow-hidden rounded-2xl ring-1 ring-brand/15 transition-all duration-300 hover:ring-brand/45 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40"
    >
      <div className="relative h-24 overflow-hidden">
        <GenerativeArt seed={`${vaultId}:${asset}`} glyph={asset === "USDC" ? "$" : "₮"} className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-surface-1/10 to-transparent" />
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold backdrop-blur ${asset === "USDC" ? "bg-blue-500/25 text-blue-200" : "bg-emerald-500/25 text-emerald-200"}`}>{asset === "USDC" ? "$" : "₮"}</span>
          <span className="rounded-md bg-black/30 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur">{deposits.length} deposit{deposits.length > 1 ? "s" : ""}</span>
        </div>
        <div className="absolute right-3 top-3">
          {pending === deposits.length && pending > 0
            ? <span className="tag tag-yellow text-[10px]">Redeeming</span>
            : locked > 0
              ? <span className="tag tag-yellow text-[10px]">{locked} locked</span>
              : <span className="tag tag-green text-[10px]">Active</span>}
        </div>
        <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
          <div className="font-display text-sm font-bold text-white drop-shadow">{vaultName}</div>
          <div className="font-mono text-[10px] text-white/70">{blendedApy.toFixed(1)}% APY</div>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">Principal</div>
            <div className="font-display text-2xl font-bold text-white">${principal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted">Accruing</div>
            <div className="font-mono text-base font-semibold text-yellow-400">+${accruing.toFixed(6)}</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-white/[0.02] px-2.5 py-1.5">
            <div className="text-muted">Matured</div>
            <div className="font-mono text-emerald-300">+${matured.toFixed(4)}</div>
          </div>
          <div className="rounded-lg bg-white/[0.02] px-2.5 py-1.5">
            <div className="text-muted">Next matures</div>
            <div className="text-emerald-400/80">{soonest !== Infinity ? `${nd}d ${String(nh).padStart(2, "0")}h ${String(nmm).padStart(2, "0")}m` : "—"}</div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-surface-4/40 pt-3">
          <span className="text-xs text-muted">≈ ${perDay.toFixed(6)}/day</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 text-sm font-bold text-brand transition-colors group-hover:bg-brand/20">
            View {deposits.length} deposit{deposits.length > 1 ? "s" : ""}
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
      </div>
    </button>
  );
}

/** Per-deposit row inside GroupDetailModal. The WHOLE row is tap-to-open (large target,
 *  clear chevron + hint); Redeem is a separate, prominent button. Sized for easy reading. */
function DepositRow({ deposit, loading, onRedeem, onOpenDeposit }) {
  const now = useNow();
  const y = computeYield(deposit, now);
  const asset = deposit.asset;
  const frac = y.monthlyYield > 0 ? Math.min(1, y.liveThisCycle / y.monthlyYield) : 0;
  const nms = Math.max(0, y.nextMaturationMs - now);
  const nd = Math.floor(nms / 86400000), nh = Math.floor((nms % 86400000) / 3600000);
  const created = deposit.createdAt ? new Date(deposit.createdAt) : null;
  const open = () => onOpenDeposit(deposit);

  return (
    <div
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      className="group cursor-pointer rounded-2xl border border-surface-4/40 bg-[#0d1324]/50 p-4 transition-all hover:border-brand/50 hover:bg-[#0d1324]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-2xl font-bold text-white">${Number(deposit.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            <span className="text-base text-slate-400">{asset}</span>
            {deposit.redemptionPending
              ? <span className="tag tag-yellow text-xs">Redeeming</span>
              : y.locked
                ? <span className="tag tag-yellow text-xs">Locked</span>
                : <span className="tag tag-green text-xs">Active</span>}
          </div>
          <div className="mt-1 text-sm text-slate-400">Deposited {created ? created.toLocaleDateString() : "—"}</div>
        </div>
        {/* big, obvious open affordance */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand transition-all group-hover:bg-brand/20 group-hover:translate-x-0.5">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>

      {/* progress */}
      <div className="mt-3">
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="text-slate-300">Cycle {(frac * 100).toFixed(0)}%</span>
          <span className="text-emerald-400">matures in {nd}d {String(nh).padStart(2, "0")}h</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-dark to-brand" style={{ width: `${frac * 100}%` }} />
        </div>
      </div>

      {/* amounts */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/[0.03] px-3 py-2">
          <div className="text-xs text-muted">Accruing now</div>
          <div className="font-mono text-base font-semibold text-yellow-400">+${y.liveThisCycle.toFixed(6)}</div>
        </div>
        <div className="rounded-xl bg-white/[0.03] px-3 py-2">
          <div className="text-xs text-muted">Matured</div>
          <div className="font-mono text-base font-semibold text-emerald-300">+${y.maturedSoFar.toFixed(4)}</div>
        </div>
      </div>

      {/* actions row: clear tap hint + Redeem */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-base font-semibold text-brand group-hover:underline">
          Tap to view full details
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        {!deposit.redemptionPending && (
          <button
            onClick={(e) => { e.stopPropagation(); onRedeem(deposit); }}
            disabled={loading === deposit._id}
            className="rounded-xl border border-brand/30 bg-brand/15 px-5 py-2.5 text-base font-bold text-brand transition-colors hover:bg-brand/25 disabled:opacity-50"
          >
            {loading === deposit._id ? "…" : "Redeem"}
          </button>
        )}
      </div>
    </div>
  );
}

/** One row in the block-explorer style event timeline. */
function TimelineRow({ ev, asset, isLast }) {
  const meta = {
    deposit:  { color: "#34d399", bg: "bg-emerald-500/15", ring: "ring-emerald-400/30", icon: "M12 3v18M5 10l7-7 7 7", label: "text-emerald-300" },
    matured:  { color: "#22d3ee", bg: "bg-cyan-500/15",    ring: "ring-cyan-400/30",    icon: "M20 6L9 17l-5-5",       label: "text-cyan-300" },
    accruing: { color: "#facc15", bg: "bg-yellow-500/15",  ring: "ring-yellow-400/30",  icon: "M12 8v4l3 2M12 21a9 9 0 100-18 9 9 0 000 18z", label: "text-yellow-300" },
    redeem:   { color: "#f59e0b", bg: "bg-amber-500/15",   ring: "ring-amber-400/30",   icon: "M12 19V5M5 12l7 7 7-7",  label: "text-amber-300" },
    withdraw: { color: "#60a5fa", bg: "bg-blue-500/15",     ring: "ring-blue-400/30",    icon: "M12 19V5M5 12l7 7 7-7",  label: "text-blue-300" },
  }[ev.type] || { color: "#94a3b8", bg: "bg-slate-500/15", ring: "ring-slate-400/30", icon: "M12 8v8", label: "text-slate-300" };

  return (
    <div className="relative flex gap-3 pb-4">
      {!isLast && <span className="absolute left-[13px] top-7 h-full w-px bg-surface-4/50" />}
      <div className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${meta.bg} ring-1 ${meta.ring}`}>
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={meta.icon} /></svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-semibold ${meta.label}`}>{ev.title}</span>
          {ev.amount != null && <span className="font-mono text-sm font-semibold text-slate-100">{ev.sign || ""}${Number(ev.amount).toFixed(ev.precise ? 6 : 2)} {asset}</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
          <span>{ev.live ? "live · now" : new Date(ev.at).toLocaleString()}</span>
          {ev.status && <span className={`tag text-[9px] ${STATUS_META[ev.status]?.cls || "tag-yellow"}`}>{STATUS_META[ev.status]?.label || ev.status}</span>}
          {ev.txHash && (
            <a href={`https://bscscan.com/tx/${ev.txHash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-brand hover:underline" onClick={(e) => e.stopPropagation()}>
              {shortHash(ev.txHash, 8, 6)}
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H8M17 7v9" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * PositionDetailModal — the "surprise": a block-explorer style view of a single deposit.
 * A generative-art hero, a copyable position id + on-chain tx link, a full metrics grid, and a
 * chronological event timeline (deposit → each matured cycle → live cycle → withdrawals) built
 * from the deposit's own data + related withdrawals. Redeem reuses the existing flow untouched.
 */
function PositionDetailModal({ deposit, withdrawals, onRedeem, onClose }) {
  const now = useNow();
  if (!deposit) return null;
  const y = computeYield(deposit, now);
  const asset = deposit.asset;
  const vaultName = deposit.vaultId?.name || "Vault";
  const vaultId = typeof deposit.vaultId === "object" ? deposit.vaultId?._id : deposit.vaultId;
  const createdMs = deposit.createdAt ? new Date(deposit.createdAt).getTime() : now;
  const ageDays = Math.floor((now - createdMs) / 86400000);
  const annualApy = Number(deposit.poolApy ?? deposit.apyPercent ?? 0);
  const CYCLE_MS = 30 * 24 * 60 * 60 * 1000;
  const posId = asHash(deposit._id);

  // Build the chronological event feed (newest first).
  const events = [];
  // Rejected requests are refunded (nothing happened) → don't clutter the timeline with them.
  const related = (withdrawals || []).filter((w) => String(w.depositId?._id || w.depositId) === String(deposit._id) && w.status !== "rejected");
  related.forEach((w) => events.push({
    type: w.source === "deposit" ? "redeem" : "withdraw",
    title: w.source === "deposit" ? "Principal redemption" : "Yield withdrawal",
    amount: w.amount, sign: "−", at: new Date(w.createdAt).getTime(), status: w.status, txHash: w.txHash,
  }));
  if (y.liveThisCycle > 0) events.push({ type: "accruing", title: `Cycle ${y.completedCycles + 1} accruing`, amount: y.liveThisCycle, sign: "+", precise: true, live: true, at: now });
  const shownCycles = Math.min(y.completedCycles, 6);
  for (let c = y.completedCycles; c > y.completedCycles - shownCycles; c--) {
    events.push({ type: "matured", title: `Cycle ${c} matured`, amount: y.monthlyYield, sign: "+", precise: true, at: createdMs + c * CYCLE_MS });
  }
  events.push({ type: "deposit", title: "Deposit confirmed", amount: deposit.amount, at: createdMs, txHash: deposit.txHash });
  events.sort((a, b) => b.at - a.at);
  const earlierCycles = y.completedCycles - shownCycles;

  const copy = (v, label) => { navigator.clipboard?.writeText(v); toast.success(`${label} copied`); };
  const Metric = ({ label, value, sub, accent = "text-slate-100" }) => (
    <div className="rounded-xl border border-surface-4/40 bg-[#0d1324]/60 p-3.5">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 font-mono text-lg font-bold ${accent}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[195] flex items-center justify-center bg-black/70 backdrop-blur-md px-4 py-8" style={{ animation: "wpmFade .2s ease" }} onClick={onClose}>
      <div className="glass relative w-full max-w-2xl max-h-[88vh] overflow-hidden rounded-2xl ring-1 ring-white/[0.06] flex flex-col" style={{ animation: "wpmPop .25s ease" }} onClick={(e) => e.stopPropagation()}>
        {/* hero */}
        <div className="relative h-36 shrink-0">
          <GenerativeArt seed={deposit._id || `${vaultName}:${asset}`} glyph={asset === "USDC" ? "$" : "₮"} className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-surface-1/40 to-transparent" />
          <button onClick={onClose} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur hover:bg-black/60 hover:text-white">✕</button>
          <button
            onClick={() => {
              const txt = `I'm earning ${annualApy.toFixed(1)}% APY on my ${vaultName} position with @aussivo — non-custodial, on-chain yield. 🌿`;
              window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(txt)}&url=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin + "/pools" : "")}`, "_blank", "noopener");
            }}
            className="absolute right-12 top-3 flex h-8 items-center gap-1.5 rounded-full bg-black/40 px-3 text-[11px] font-semibold text-white/80 backdrop-blur hover:bg-black/60 hover:text-white"
            title="Share on X"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 1.2h3.7l-8 9.1 9.4 12.5h-7.4l-5.8-7.6-6.6 7.6H.5l8.5-9.8L0 1.2h7.6l5.2 6.9 6.1-6.9zm-1.3 19.5h2L6.5 3.3H4.3l13.3 17.4z"/></svg>
            Share
          </button>
          <div className="absolute bottom-3 left-5 right-5">
            <div className="flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${asset === "USDC" ? "bg-blue-500/25 text-blue-200" : "bg-emerald-500/25 text-emerald-200"}`}>{asset === "USDC" ? "$" : "₮"}</span>
              <div className="font-display text-lg font-bold text-white drop-shadow">{vaultName}</div>
              {vaultId && <Link to={`/pool/${vaultId}`} className="text-[11px] text-brand hover:underline">open vault →</Link>}
            </div>
            <div className="mt-0.5 font-display text-2xl font-bold text-white">${Number(deposit.amount || 0).toLocaleString()} <span className="text-sm font-normal text-white/70">{asset} · {annualApy.toFixed(1)}% APY</span></div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* position id / on-chain */}
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-surface-4/40 bg-[#0d1324]/60 px-3 py-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Position ID</span>
            <span className="font-mono text-xs text-slate-200">{shortHash(posId, 10, 8)}</span>
            <button onClick={() => copy(posId, "Position ID")} className="text-brand hover:underline text-[11px]">copy</button>
            {deposit.txHash && (
              <a href={`https://bscscan.com/tx/${deposit.txHash}`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline">
                On-chain tx
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H8M17 7v9" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
            )}
          </div>

          {/* metrics */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric label="Deposited" value={new Date(createdMs).toLocaleDateString()} sub={`${ageDays} day${ageDays === 1 ? "" : "s"} ago`} />
            <Metric label="Accruing this cycle" value={`$${y.liveThisCycle.toFixed(6)}`} accent="text-yellow-400" sub={`≈ $${y.perDay.toFixed(6)}/day`} />
            <Metric label="Matured (withdrawable)" value={`$${y.maturedSoFar.toFixed(6)}`} accent="text-emerald-300" sub="in Matured Yield" />
            <Metric label="Monthly yield" value={`$${y.monthlyYield.toFixed(4)}`} sub={`${(annualApy / 12).toFixed(2)}%/mo`} />
            <Metric label="Cycles matured" value={String(y.completedCycles)} sub="30-day cycles" />
            <Metric label={y.locked ? "Locked until" : "Lock"} value={y.locked ? new Date(y.unlockMs).toLocaleDateString() : "Unlocked"} accent={y.locked ? "text-yellow-400" : "text-emerald-300"} />
          </div>

          {y.early && (
            <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2 text-[11px] text-amber-200/90">
              Within the first 30 days: redeeming principal now costs a 1% early-exit fee and forfeits this cycle's un-matured yield. Already-matured yield is unaffected.
            </div>
          )}

          {/* timeline */}
          <div className="mt-5">
            <div className="mb-3 flex items-center gap-2">
              <h4 className="font-display text-sm font-bold text-white">Activity</h4>
              <span className="text-[10px] text-muted">on-chain &amp; yield events</span>
            </div>
            {events.map((ev, i) => <TimelineRow key={i} ev={ev} asset={asset} isLast={i === events.length - 1 && earlierCycles <= 0} />)}
            {earlierCycles > 0 && (
              <div className="relative flex gap-3 pl-[2px] text-[11px] text-muted">
                <span className="ml-[11px]">＋ {earlierCycles} earlier matured cycle{earlierCycles === 1 ? "" : "s"} (+${(earlierCycles * y.monthlyYield).toFixed(2)} {asset})</span>
              </div>
            )}
          </div>
        </div>

        {/* actions */}
        <div className="shrink-0 border-t border-surface-4/40 p-4">
          {deposit.redemptionPending ? (
            <div className="rounded-xl bg-yellow-500/[0.08] border border-yellow-500/20 py-3 text-center text-sm font-semibold text-yellow-300">Redemption in progress · typically 4–24 hours</div>
          ) : (
            <button onClick={() => onRedeem(deposit)} className="w-full rounded-xl bg-gradient-to-r from-brand-dark to-brand py-3 font-display font-bold text-white transition-all hover:shadow-lg hover:shadow-brand/20">
              Redeem principal &amp; exit
              <span className="block text-[11px] font-normal text-white/80">Matured yield stays in your Matured Yield balance</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * GroupDetailModal — the drill-down for one pool: an aggregate hero + a sortable, scrollable
 * list of every underlying deposit (each redeemable / openable). Reads deposits live from the
 * parent so it stays current across refreshes. Handles 1 or 100 deposits gracefully.
 */
function GroupDetailModal({ deposits, loading, onRedeem, onRedeemAll, onOpenDeposit, onClose }) {
  const now = useNow();
  const [sort, setSort] = useState("newest");
  if (!deposits || deposits.length === 0) return null;

  const first = deposits[0];
  const asset = first.asset;
  const vaultName = first.vaultId?.name || "Vault";
  const vaultId = typeof first.vaultId === "object" ? first.vaultId?._id : first.vaultId;

  let principal = 0, accruing = 0, matured = 0, perDay = 0, soonest = Infinity, locked = 0, apyW = 0;
  const redeemable = [];
  for (const d of deposits) {
    const y = computeYield(d, now);
    principal += y.amount; accruing += y.liveThisCycle; matured += y.maturedSoFar; perDay += y.perDay;
    apyW += y.amount * Number(d.poolApy ?? d.apyPercent ?? 0);
    if (y.nextMaturationMs) soonest = Math.min(soonest, y.nextMaturationMs);
    if (y.locked) locked++;
    if (!d.redemptionPending) redeemable.push(d._id);
  }
  const blendedApy = principal > 0 ? apyW / principal : Number(first.apyPercent || 0);
  const nms = soonest !== Infinity ? Math.max(0, soonest - now) : 0;
  const nd = Math.floor(nms / 86400000), nh = Math.floor((nms % 86400000) / 3600000);

  const sorted = [...deposits].sort((a, b) => {
    if (sort === "largest") return Number(b.amount) - Number(a.amount);
    if (sort === "oldest") return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); // newest
  });

  const Metric = ({ label, value, sub, accent = "text-slate-100" }) => (
    <div className="rounded-xl border border-surface-4/40 bg-[#0d1324]/60 p-3.5">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 font-mono text-lg font-bold ${accent}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/70 backdrop-blur-md px-4 py-8" style={{ animation: "wpmFade .2s ease" }} onClick={onClose}>
      <div className="glass relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl ring-1 ring-white/[0.06]" style={{ animation: "wpmPop .25s ease" }} onClick={(e) => e.stopPropagation()}>
        {/* hero */}
        <div className="relative h-32 shrink-0">
          <GenerativeArt seed={`${vaultId}:${asset}`} glyph={asset === "USDC" ? "$" : "₮"} className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-surface-1/40 to-transparent" />
          <button onClick={onClose} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur hover:bg-black/60 hover:text-white">✕</button>
          <div className="absolute bottom-3 left-5 right-5">
            <div className="flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${asset === "USDC" ? "bg-blue-500/25 text-blue-200" : "bg-emerald-500/25 text-emerald-200"}`}>{asset === "USDC" ? "$" : "₮"}</span>
              <div className="font-display text-lg font-bold text-white drop-shadow">{vaultName}</div>
              {vaultId && <Link to={`/pool/${vaultId}`} className="text-[11px] text-brand hover:underline">open vault →</Link>}
            </div>
            <div className="mt-0.5 font-display text-2xl font-bold text-white">${principal.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-sm font-normal text-white/70">{asset} · {blendedApy.toFixed(1)}% APY · {deposits.length} deposit{deposits.length > 1 ? "s" : ""}</span></div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* aggregate metrics */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric label="Total principal" value={`$${principal.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
            <Metric label="Matured (withdrawable)" value={`$${matured.toFixed(6)}`} accent="text-emerald-300" sub="in Matured Yield" />
            <Metric label="Accruing this cycle" value={`$${accruing.toFixed(6)}`} accent="text-yellow-400" sub={`≈ $${perDay.toFixed(6)}/day`} />
            <Metric label="Deposits" value={String(deposits.length)} sub={locked > 0 ? `${locked} locked` : "all unlocked"} />
            <Metric label="Soonest maturation" value={soonest !== Infinity ? `${nd}d ${String(nh).padStart(2, "0")}h` : "—"} />
            <Metric label="Blended APY" value={`${blendedApy.toFixed(2)}%`} sub={`${(blendedApy / 12).toFixed(2)}%/mo`} />
          </div>

          {/* controls */}
          <div className="mt-5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-200">Deposits</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-surface-4/50 bg-[#0d1324] px-3 py-1.5 text-sm text-slate-200 outline-none">
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="largest">Largest</option>
              </select>
            </div>
            {redeemable.length > 0 && (
              <button onClick={() => onRedeemAll(redeemable)}
                className="rounded-xl border border-brand/30 bg-brand/15 px-4 py-2 text-sm font-bold text-brand hover:bg-brand/25">
                Redeem all ({redeemable.length}) →
              </button>
            )}
          </div>

          <p className="mt-3 rounded-xl border border-brand/15 bg-brand/[0.06] px-4 py-2.5 text-sm text-slate-300">
            👉 Tap any deposit below to open its full history and details.
          </p>

          {/* per-deposit list */}
          <div className="mt-3 space-y-3">
            {sorted.map((d, i) => (
              <DepositRow key={d._id || i} deposit={d} loading={loading} onRedeem={onRedeem} onOpenDeposit={onOpenDeposit} />
            ))}
          </div>
        </div>
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
  const [detailDeposit, setDetailDeposit] = useState(null); // deposit shown in the block-explorer detail modal
  const [detailGroupKey, setDetailGroupKey] = useState(null); // pool (vault+asset) shown in the grouped breakdown modal
  const [loading, setLoading] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [tab, setTab] = useState("overview"); // overview | yield | history

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

  // Redeem THIS deposit's principal and exit. Allowed anytime; the backend applies the 1%
  // early-exit fee + forfeits the current cycle's un-matured yield if it's within 30 days.
  // Matured yield is untouched — it stays in the Matured Yield balance and is withdrawn there.
  const redeemPrincipal = async (deposit) => {
    if (!deposit) return;
    setLoading(deposit._id);
    try {
      const d = await postWithdraw({ source: "deposit", depositId: deposit._id, walletAddress: user.walletAddress });
      if (d.status === 201) {
        setRedeemModal(null);
        setProcessingModal({
          amount: d.data?.netAmount ?? deposit.amount, asset: deposit.asset, kind: "exit",
          note: d.data?.early
            ? "Your principal redemption has been submitted with the 1% early-exit fee. This cycle's un-matured yield is forfeited; any already-matured yield remains in your Matured Yield balance."
            : "Your principal redemption has been submitted. Any matured yield remains in your Matured Yield balance — withdraw it there anytime.",
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
  const totalStaked = activeDeposits.reduce((sum, d) => sum + (d.amount || 0), 0);

  // Principal is redeemable ANYTIME now (a 1% fee applies within 30 days, handled at redeem
  // time). We only hide deposits that already have a redemption in flight.
  const redeemableDeposits = activeDeposits.filter((d) => !d.redemptionPending);

  // Group deposits by pool (vault + asset) so the grid shows ONE card per pool regardless of
  // how many deposits it holds. The drill-down modal reads the group live via this same key.
  const groupKeyOf = (d) => `${typeof d.vaultId === "object" ? d.vaultId?._id : d.vaultId}:${d.asset}`;
  const positionGroups = Object.values(
    activeDeposits.reduce((acc, d) => {
      const k = groupKeyOf(d);
      (acc[k] = acc[k] || { key: k, deposits: [] }).deposits.push(d);
      return acc;
    }, {})
  ).sort((a, b) => {
    // biggest pool first (by total principal)
    const sum = (g) => g.deposits.reduce((s, x) => s + Number(x.amount || 0), 0);
    return sum(b) - sum(a);
  });
  const detailGroupDeposits = detailGroupKey ? activeDeposits.filter((d) => groupKeyOf(d) === detailGroupKey) : [];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 text-[15px]">
      <h1 className="font-display font-bold text-4xl mb-2">Portfolio</h1>
      <p className="text-muted text-lg mb-6">Your deposits, yield earnings, and balances</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-surface-4/40">
        {[["overview", "Overview"], ["yield", "Matured Yield"], ["history", "History"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`relative px-5 py-3 text-base font-display font-semibold transition-colors ${tab === k ? "text-white" : "text-muted hover:text-slate-300"}`}>
            {label}
            {tab === k && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
          </button>
        ))}
      </div>

      {tab === "overview" && (<>
      {/* Balance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="group relative overflow-hidden glass p-5 transition-all hover:-translate-y-0.5 hover:ring-1 hover:ring-white/10">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
          <div className="relative flex items-center gap-2 text-sm text-muted mb-2 uppercase tracking-wider">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400"><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h18v12H3z" strokeLinejoin="round"/><path d="M16 12h3M3 7l3-3h12l3 3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
            Total Deposited
          </div>
          <div className="relative text-3xl font-display font-bold">${totalStaked.toLocaleString()}</div>
        </div>
        <div className="group relative overflow-hidden glass p-5 transition-all hover:-translate-y-0.5 hover:ring-1 hover:ring-brand/20">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand/10 blur-2xl" />
          <div className="relative flex items-center gap-2 text-sm text-muted mb-2 uppercase tracking-wider">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand/15 text-brand"><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
            Matured Yield
          </div>
          <div className="relative text-3xl font-display font-bold text-brand">${formatYieldBalanceUsd(user?.yieldWalletUSDT)}</div>
          <div className="relative text-[11px] text-muted mt-0.5">Withdrawable</div>
          {((user?.yieldWalletUSDT || 0) + (user?.yieldWalletUSDC || 0)) > 0 && (
            <button onClick={() => setTab("yield")} className="relative text-xs text-brand mt-2 hover:underline block">Withdraw in Matured Yield →</button>
          )}
        </div>
        <AccruingThisCycleCard deposits={activeDeposits} />
        <div className="group relative overflow-hidden glass p-5 transition-all hover:-translate-y-0.5 hover:ring-1 hover:ring-blue-400/20">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl" />
          <div className="relative flex items-center gap-2 text-sm text-muted mb-2 uppercase tracking-wider">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400"><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg></span>
            Referral Earnings
          </div>
          <div className="relative text-3xl font-display font-bold text-blue-400">${(user?.referralEarnings || 0).toFixed(2)}</div>
          {(user?.referralEarnings || 0) > 0 && (
            <button onClick={() => handleWithdraw(user.referralEarnings, "USDT", "referral")}
              className="relative text-xs text-blue-400 mt-2 hover:underline">Withdraw →</button>
          )}
        </div>
      </div>

      {/* Active Positions — one card per pool */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-2xl">Active Positions <span className="text-muted text-lg font-normal">({positionGroups.length} pool{positionGroups.length === 1 ? "" : "s"} · {activeDeposits.length} deposit{activeDeposits.length === 1 ? "" : "s"})</span></h2>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-10">
          {positionGroups.map((g) => (
            <GroupedPositionCard key={g.key} deposits={g.deposits} onOpen={() => setDetailGroupKey(g.key)} />
          ))}
        </div>
      )}
      {/* How yield works — 30-day maturation explainer */}
      <div className="mb-8 rounded-xl border border-surface-4/40 bg-[#0d1324]/40 px-4 py-4 text-sm text-muted">
        Yield accrues each 30-day cycle. When a cycle completes it <span className="text-emerald-300">matures</span> into your withdrawable <span className="text-brand">Matured Yield</span> balance and the live counter resets to 0 for the next cycle. Principal can be redeemed anytime — within the first 30 days a <span className="text-amber-300">1% fee</span> applies and that cycle's un-matured yield is forfeited.
      </div>

      {/* On-chain registration — verify yourself in the public registry contract */}
      {(import.meta.env.VITE_REGISTRY_V2_ADDRESS || import.meta.env.VITE_REGISTRY_CONTRACT_ADDRESS) && (() => {
        const reg = import.meta.env.VITE_REGISTRY_V2_ADDRESS || import.meta.env.VITE_REGISTRY_CONTRACT_ADDRESS;
        const isV2 = !!import.meta.env.VITE_REGISTRY_V2_ADDRESS;
        const short = (a) => `${a.slice(0, 8)}…${a.slice(-6)}`;
        return (
          <div className="relative overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-br from-brand/[0.08] via-surface-1/60 to-surface-1/60 p-5 mb-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-brand">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="9" /></svg>
                </div>
                <div>
                  <div className="font-display text-base font-bold text-white">Verify your deposit on-chain</div>
                  <p className="mt-0.5 text-xs text-muted max-w-md">
                    {isV2
                      ? <>Your deposited principal is attested in Aussivo's public registry on BSC. Verify it yourself — open the contract, go to <span className="text-slate-300">Read → positionOf</span>, and paste your address to see your principal, deposit count, and last-synced time.</>
                      : <>Your wallet is recorded in Aussivo's public registry contract on BSC. Anyone can verify it — open the contract, go to <span className="text-slate-300">Read → isRegistered</span>, and paste your address.</>}
                  </p>
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 w-16">Contract</span>
                      <span className="font-mono text-slate-200">{short(reg)}</span>
                      <button onClick={() => { navigator.clipboard?.writeText(reg); toast.success("Contract address copied"); }} className="text-brand hover:underline">copy</button>
                    </div>
                    {user?.walletAddress && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 w-16">Your wallet</span>
                        <span className="font-mono text-slate-200">{short(user.walletAddress)}</span>
                        <button onClick={() => { navigator.clipboard?.writeText(user.walletAddress); toast.success(isV2 ? "Your address copied — paste it into positionOf" : "Your address copied — paste it into isRegistered"); }} className="text-brand hover:underline">copy</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <a
                href={`https://bscscan.com/address/${reg}#readContract`}
                target="_blank" rel="noreferrer"
                className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-dark to-brand px-5 py-3 text-sm font-display font-bold text-white shadow-lg shadow-brand/10 transition-all hover:shadow-brand/25"
              >
                Check on BscScan
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H8M17 7v9" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
            </div>
          </div>
        );
      })()}

      </>)}

      {tab === "yield" && (
        <MaturedYieldWallet
          user={user}
          withdrawals={withdrawals}
          loading={!!loading}
          onWithdraw={handleWithdraw}
          seed={`${user?.walletAddress || ""}:${user?._id || user?.referralCode || ""}`}
        />
      )}

      {tab === "history" && (<>
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
                  const typeLabel = w.source === "deposit" ? "Redemption" : w.source === "referral" ? "Referral" : "Matured Yield";
                  const amt = w.source === "deposit" ? (w.depositId?.amount ?? w.amount) : w.amount;
                  const st = STATUS_META[w.status] || STATUS_META.pending;
                  return (
                    <tr key={w._id || i} className="border-b border-surface-4/20">
                      <td className="p-3 text-muted">{typeLabel}</td>
                      <td className="p-3"><span className={`tag text-[10px] ${st.cls}`}>{st.label}</span></td>
                      <td className="p-3 text-right font-semibold text-slate-200">
                        ${Number(amt || 0).toFixed(4)} {w.asset}
                        {w.early && Number(w.fee) > 0 && (
                          <div className="text-[10px] font-normal text-amber-300/90 mt-0.5">
                            −1% early fee (${Number(w.fee).toFixed(4)}) · you get ${Number(w.netAmount ?? amt).toFixed(4)}
                          </div>
                        )}
                      </td>
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

      {withdrawals.filter(w => w.status !== "rejected").length === 0 && yieldLogs.length === 0 && (
        <div className="glass p-10 text-center text-muted">No withdrawals or yield history yet.</div>
      )}
      </>)}

      {detailGroupKey && detailGroupDeposits.length > 0 && createPortal(
        <>
          <style>{`@keyframes wpmFade{from{opacity:0}to{opacity:1}}@keyframes wpmPop{0%{transform:scale(.94);opacity:0}100%{transform:scale(1);opacity:1}}`}</style>
          <GroupDetailModal
            deposits={detailGroupDeposits}
            loading={loading}
            onRedeem={(d) => openRedeem(d)}
            onRedeemAll={(ids) => handleRedeemAll(ids)}
            onOpenDeposit={(d) => setDetailDeposit(d)}
            onClose={() => setDetailGroupKey(null)}
          />
        </>, document.body)}
      {detailDeposit && createPortal(
        <>
          <style>{`@keyframes wpmFade{from{opacity:0}to{opacity:1}}@keyframes wpmPop{0%{transform:scale(.94);opacity:0}100%{transform:scale(1);opacity:1}}`}</style>
          <PositionDetailModal
            deposit={detailDeposit}
            withdrawals={withdrawals}
            onRedeem={(d) => { setDetailDeposit(null); openRedeem(d); }}
            onClose={() => setDetailDeposit(null)}
          />
        </>, document.body)}
      {redeemModal && createPortal(
        <RedeemChoiceModal
          deposit={redeemModal}
          busy={loading === redeemModal._id}
          onRedeem={() => redeemPrincipal(redeemModal)}
          onClose={() => setRedeemModal(null)}
        />, document.body)}
      {processingModal && createPortal(<WithdrawProcessingModal info={processingModal} onClose={() => setProcessingModal(null)} />, document.body)}
    </div>
  );
}