import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { API } from "../../config/api";

const hdr = () => ({ Authorization: `Bearer ${localStorage.getItem("admin_token")}` });

const money = (n, dp) => {
  const v = Number(n || 0);
  const d = dp != null ? dp : v !== 0 && Math.abs(v) < 1 ? 6 : 2;
  return v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
};
const date = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—");
const dateTime = (d) => (d ? new Date(d).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const shortHash = (h) => (h ? `${h.slice(0, 8)}…${h.slice(-6)}` : "—");

// Bottts avatar via local generation isn't available in admin bundle; use a deterministic ring.
function Ident({ seed = "" }) {
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 65% 45%), hsl(${(hue + 60) % 360} 65% 35%))` }}>
      {(seed[0] || "?").toUpperCase()}
    </div>
  );
}

function Stat({ label, value, sub, accent = "text-white", tone }) {
  return (
    <div className={`rounded-xl border p-3.5 ${tone === "warn" ? "border-amber-500/30 bg-amber-500/[0.05]" : "border-surface-4/50 bg-surface-2/40"}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-0.5 font-display text-lg font-bold ${accent}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

function Section({ title, right, children }) {
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-display text-sm font-bold text-slate-200">{title}</h4>
        {right}
      </div>
      {children}
    </div>
  );
}

const statusTag = (s) =>
  s === "completed" ? "tag-green" : s === "pending" || s === "approved" ? "tag-yellow" : s === "rejected" ? "tag-red" : "";

export default function UserDetailModal({ userId, onClose }) {
  const [p, setP] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!userId) return;
    setP(null); setErr(null);
    fetch(`${API}/api/admin/users/${userId}/profile`, { headers: hdr() })
      .then((r) => r.json())
      .then((d) => (d.status === 200 ? setP(d.data) : setErr(d.message || "Failed to load")))
      .catch(() => setErr("Failed to load"));
  }, [userId]);

  const copy = (t) => navigator.clipboard?.writeText(t);

  const body = () => {
    if (err) return <div className="p-10 text-center text-sm text-red-400">{err}</div>;
    if (!p) return <div className="p-16 text-center text-sm text-muted">Loading profile…</div>;

    const u = p.user || {};
    const t = p.totals || {};
    const c = t.consistency || {};
    const w = t.withdrawals || {};
    const wallets = (u.walletAddresses?.length ? u.walletAddresses : [u.walletAddress]).filter(Boolean);
    const matchAll = c.matchUSDT !== false && c.matchUSDC !== false;

    return (
      <>
        {/* Identity header */}
        <div className="flex flex-wrap items-start gap-4 border-b border-surface-4/40 p-5">
          <Ident seed={u.walletAddress || u.email || u.name || "?"} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xl font-bold text-white">{u.name || "—"}</h3>
              <span className={`tag text-[10px] ${u.status === "active" ? "tag-green" : "tag-red"}`}>{u.status}</span>
              <span className="tag tag-blue text-[10px]">KYC: {u.kycStatus || "none"}</span>
              {u.role && u.role !== "user" && <span className="tag text-[10px]">{u.role}</span>}
            </div>
            <div className="mt-1 text-sm text-slate-400">{u.email}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
              <span>Joined {date(u.createdAt)}</span>
              {u.lastLoginAt && <span>· Last login {date(u.lastLoginAt)}</span>}
              <span>· Ref code <span className="font-mono text-slate-300">{p.referral?.code || "—"}</span></span>
              {p.referral?.referredBy && <span>· Referred by <span className="text-slate-300">{p.referral.referredBy.email}</span></span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {wallets.map((a) => (
                <button key={a} onClick={() => copy(a)} title="Copy address"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-surface-4/60 bg-surface-2/50 px-2 py-1 font-mono text-[11px] text-slate-300 hover:border-brand/30">
                  {shortHash(a)}
                  <svg className="h-3 w-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
                </button>
              ))}
              {u.chain && <span className="rounded-lg border border-surface-4/60 bg-surface-2/50 px-2 py-1 text-[11px] text-slate-400">{String(u.chain).toUpperCase()}</span>}
            </div>
          </div>
        </div>

        <div className="p-5">
          {/* Consistency banner — the dispute-resolution headline */}
          <div className={`mb-4 flex items-start gap-3 rounded-xl border p-3.5 ${matchAll ? "border-emerald-500/25 bg-emerald-500/[0.05]" : "border-amber-500/30 bg-amber-500/[0.06]"}`}>
            <svg className={`mt-0.5 h-5 w-5 shrink-0 ${matchAll ? "text-emerald-400" : "text-amber-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {matchAll ? <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /> : <><path d="M12 9v4M12 17h.01" strokeLinecap="round" /><circle cx="12" cy="12" r="9" /></>}
            </svg>
            <div className="text-sm">
              {matchAll ? (
                <><b className="text-emerald-300">Balances reconcile.</b> <span className="text-slate-300">The withdrawable wallet matches matured yield minus what's already been withdrawn.</span></>
              ) : (
                <><b className="text-amber-300">Balance mismatch — review.</b> <span className="text-slate-300">
                  Wallet USDT expected <b className="font-mono">${money(c.expectedWalletUSDT)}</b> vs actual <b className="font-mono">${money(c.actualWalletUSDT)}</b>
                  {c.matchUSDC === false && <> · USDC expected <b className="font-mono">${money(c.expectedWalletUSDC)}</b> vs actual <b className="font-mono">${money(c.actualWalletUSDC)}</b></>}.
                </span></>
              )}
            </div>
          </div>

          {/* Money grid — everything needed to settle a dispute */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label="Active principal" value={`$${money(t.activePrincipal)}`} sub={`${t.activeDepositsCount}/${t.depositsCount} active · ${t.lockedCount} locked`} />
            <Stat label="Matured · withdrawable" value={`$${money(t.maturedWithdrawableUSDT + t.maturedWithdrawableUSDC)}`} accent="text-emerald-400" sub="in matured vault" />
            <Stat label="Accruing · un-matured" value={`$${money(t.accruingUSDT + t.accruingUSDC)}`} accent="text-yellow-400" sub="not yet withdrawable" />
            <Stat label="Yield earned all-time" value={`$${money(t.totalYieldEarnedToDate)}`} accent="text-emerald-300" />
            <Stat label="Wallet balance (actual)" value={`$${money(t.yieldWalletUSDT + t.yieldWalletUSDC)}`} sub={`USDT $${money(t.yieldWalletUSDT)} · USDC $${money(t.yieldWalletUSDC)}`} tone={matchAll ? undefined : "warn"} accent={matchAll ? "text-white" : "text-amber-300"} />
            <Stat label="Total deposited" value={`$${money(t.totalDepositedAllTime)}`} />
            <Stat label="Withdrawn (paid out)" value={`$${money(t.totalWithdrawn)}`} sub={`${w.completed} completed · ${w.pending} pending · ${w.rejected} rejected`} />
            <Stat label="Referral earnings" value={`$${money(t.referralEarnings)}`} accent="text-blue-400" sub={`${p.referral?.referredCount || 0} referred`} />
          </div>

          {/* Deposits with full per-cycle breakdown */}
          <Section title={`Deposits (${p.deposits?.length || 0})`}>
            <div className="space-y-2">
              {(p.deposits || []).map((d) => (
                <div key={d._id} className="rounded-xl border border-surface-4/50 bg-surface-2/30 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-base font-bold text-white">${money(d.amount)}</span>
                      <span className="text-xs text-slate-400">{d.asset}</span>
                      <span className="text-xs text-slate-500">· {d.vault} · {d.apyPercent}% APY</span>
                      {d.manual && <span className="tag tag-yellow text-[9px]">Manual</span>}
                      {d.status === "withdrawn" ? <span className="tag text-[9px]">Withdrawn</span>
                        : d.redemptionPending ? <span className="tag tag-yellow text-[9px]">Redeeming</span>
                        : d.locked ? <span className="tag tag-yellow text-[9px]">Locked</span>
                        : <span className="tag tag-green text-[9px]">Active</span>}
                    </div>
                    <div className="text-[11px] text-muted">
                      Deposited {dateTime(d.createdAt)}{d.lockUntil && <> · unlocks {date(d.lockUntil)}</>}
                    </div>
                  </div>
                  {d.status !== "withdrawn" && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-dark to-brand" style={{ width: `${d.cycleProgressPct}%` }} />
                    </div>
                  )}
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                    <div><span className="text-muted">Cycles matured</span><div className="font-semibold text-slate-200">{d.cyclesMatured}</div></div>
                    <div><span className="text-muted">Matured (withdrawable)</span><div className="font-mono font-semibold text-emerald-400">${money(d.maturedYield)}</div></div>
                    <div><span className="text-muted">Accruing now</span><div className="font-mono font-semibold text-yellow-400">${money(d.accruing)}</div></div>
                    <div><span className="text-muted">Next matures</span><div className="text-slate-300">{d.nextMaturationAt ? `${date(d.nextMaturationAt)} (+$${money(d.nextMaturationAmount)})` : "—"}</div></div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span>Monthly yield ${money(d.monthly)} · totalYieldPaid ${money(d.totalYieldPaid)}</span>
                    {d.txHash && <span className="font-mono">tx {shortHash(d.txHash)}</span>}
                  </div>
                </div>
              ))}
              {(!p.deposits || p.deposits.length === 0) && <div className="rounded-xl border border-surface-4/40 p-4 text-center text-xs text-muted">No deposits.</div>}
            </div>
          </Section>

          {/* Withdrawal requests */}
          <Section title={`Withdrawal requests (${p.withdrawals?.length || 0})`}>
            {p.withdrawals?.length ? (
              <div className="overflow-hidden rounded-xl border border-surface-4/40">
                <table className="w-full text-xs">
                  <thead><tr className="bg-surface-2/40 text-[10px] uppercase tracking-wider text-muted">
                    <th className="p-2.5 text-left">Type</th><th className="p-2.5 text-left">Asset</th><th className="p-2.5 text-right">Amount</th><th className="p-2.5 text-center">Status</th><th className="p-2.5 text-right">Requested</th>
                  </tr></thead>
                  <tbody>
                    {p.withdrawals.map((r, i) => (
                      <tr key={i} className="border-t border-surface-4/20">
                        <td className="p-2.5 capitalize text-slate-300">{r.source}</td>
                        <td className="p-2.5 text-slate-400">{r.asset}</td>
                        <td className="p-2.5 text-right font-mono text-slate-200">${money(r.amount)}</td>
                        <td className="p-2.5 text-center"><span className={`tag text-[9px] ${statusTag(r.status)}`}>{r.status}</span></td>
                        <td className="p-2.5 text-right text-muted">{dateTime(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="rounded-xl border border-surface-4/40 p-4 text-center text-xs text-muted">No withdrawal requests.</div>}
          </Section>

          {/* Recent yield payments + referrals side by side */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title={`Recent yield payments (${p.yieldLogs?.length || 0})`}>
              <div className="max-h-56 space-y-1.5 overflow-y-auto">
                {(p.yieldLogs || []).map((l, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-surface-4/30 bg-surface-2/30 px-3 py-2 text-xs">
                    <span className="text-slate-400 capitalize">{(l.source || "yield").replace(/_/g, " ")}</span>
                    <span className="font-mono text-emerald-400">+${money(l.amount)} {l.asset || ""}</span>
                    <span className="text-muted">{date(l.createdAt)}</span>
                  </div>
                ))}
                {(!p.yieldLogs || p.yieldLogs.length === 0) && <div className="rounded-lg border border-surface-4/30 p-3 text-center text-xs text-muted">No yield payments yet.</div>}
              </div>
            </Section>

            <Section title={`Referred users (${p.referral?.referredCount || 0})`}>
              <div className="max-h-56 space-y-1.5 overflow-y-auto">
                {(p.referral?.referredUsers || []).map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-surface-4/30 bg-surface-2/30 px-3 py-2 text-xs">
                    <span className="text-slate-300">{r.email}</span>
                    <span className="text-muted">${money(r.totalDeposited, 0)} deposited</span>
                  </div>
                ))}
                {(!p.referral?.referredUsers || p.referral.referredUsers.length === 0) && <div className="rounded-lg border border-surface-4/30 p-3 text-center text-xs text-muted">No referrals.</div>}
              </div>
            </Section>
          </div>
        </div>
      </>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-md p-4 sm:p-8" onClick={onClose}>
      <div className="glass relative my-2 w-full max-w-4xl rounded-2xl ring-1 ring-white/[0.06]" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-slate-300 backdrop-blur hover:bg-black/60 hover:text-white" aria-label="Close">✕</button>
        {body()}
      </div>
    </div>,
    document.body
  );
}