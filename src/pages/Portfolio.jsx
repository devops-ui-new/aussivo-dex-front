import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import toast from "react-hot-toast";

import { API } from "../config/api";

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

export default function Portfolio() {
  const { token, user, refreshUser } = useWeb3();
  const [deposits, setDeposits] = useState([]);
  const [yieldLogs, setYieldLogs] = useState([]);
  const [loading, setLoading] = useState(null);

  const hdr = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

  const load = () => {
    if (!token) return;
    fetch(`${API}/api/user/deposits?page=1&limit=50`, { headers: hdr() })
      .then(r => r.json()).then(d => setDeposits(d.data?.deposits || [])).catch(() => {});
    fetch(`${API}/api/user/yield-logs?page=1&limit=20`, { headers: hdr() })
      .then(r => r.json()).then(d => setYieldLogs(d.data?.logs || [])).catch(() => {});
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
      if (d.status === 201) { toast.success("Withdrawal request submitted!"); load(); }
      else toast.error(d.message);
    } catch { toast.error("Failed"); }
    setLoading(false);
  };

  const handleRedeem = async (depositId) => {
    if (!user?.walletAddress) { toast.error("No wallet connected"); return; }
    if (!confirm("Redeem this deposit? Your principal will be returned to your wallet after admin approval.")) return;
    setLoading(depositId);
    try {
      const res = await fetch(`${API}/api/user/withdraw`, {
        method: "POST", headers: hdr(),
        body: JSON.stringify({ source: "deposit", depositId, walletAddress: user.walletAddress }),
      });
      const d = await res.json();
      if (d.status === 201) { toast.success("Redemption request submitted!"); load(); }
      else toast.error(d.message || "Failed");
    } catch { toast.error("Failed"); }
    setLoading(null);
  };

  if (!token) return (
    <div className="max-w-4xl mx-auto px-6 py-20 text-center">
      <h2 className="font-display font-bold text-2xl mb-4">Sign In Required</h2>
      <p className="text-muted mb-6">Connect your wallet and verify your email to view your portfolio.</p>
    </div>
  );

  const activeDeposits = deposits.filter(d => d.status === "active");
  const totalStaked = activeDeposits.reduce((sum, d) => sum + (d.amount || 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="font-display font-bold text-3xl mb-2">Portfolio</h1>
      <p className="text-muted mb-8">Your deposits, yield earnings, and balances</p>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="glass p-5">
          <div className="text-xs text-muted mb-1 uppercase tracking-wider">Total Deposited</div>
          <div className="text-2xl font-display font-bold">${totalStaked.toLocaleString()}</div>
        </div>
        <div className="glass p-5">
          <div className="text-xs text-muted mb-1 uppercase tracking-wider">Yield (USDT)</div>
          <div className="text-2xl font-display font-bold text-brand">${(user?.yieldWalletUSDT || 0).toFixed(2)}</div>
          {(user?.yieldWalletUSDT || 0) > 0 && (
            <button onClick={() => handleWithdraw(user.yieldWalletUSDT, "USDT", "yield")}
              className="text-xs text-brand mt-2 hover:underline">Withdraw →</button>
          )}
        </div>
        <div className="glass p-5">
          <div className="text-xs text-muted mb-1 uppercase tracking-wider">Yield (USDC)</div>
          <div className="text-2xl font-display font-bold text-brand">${(user?.yieldWalletUSDC || 0).toFixed(2)}</div>
          {(user?.yieldWalletUSDC || 0) > 0 && (
            <button onClick={() => handleWithdraw(user.yieldWalletUSDC, "USDC", "yield")}
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
      <h2 className="font-display font-semibold text-xl mb-4">Active Deposits ({activeDeposits.length})</h2>
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
            const annualApy = Number(d.poolApy ?? (d.apyPercent || 0) * 12).toFixed(1);
            const monthlyApy = Number(d.poolApyMonthly ?? d.apyPercent ?? 0);
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
                    <div className="text-xs text-muted mt-0.5">Yield paid: {d.yieldPaymentsCount}/{d.maxYieldPayments} months</div>
                  </div>
                </div>
                <div className="text-right">
                  {isLocked ? (
                    <LockCountdown unlockAt={d.lockUntil} />
                  ) : d.redemptionPending ? (
                    <span className="tag tag-yellow text-xs">Redemption Pending</span>
                  ) : (
                    <button
                      onClick={() => handleRedeem(d._id)}
                      disabled={loading === d._id}
                      className="bg-brand/10 text-brand border border-brand/20 rounded-lg px-4 py-1.5 text-xs font-semibold hover:bg-brand/20 disabled:opacity-50">
                      {loading === d._id ? "..." : "Redeem →"}
                    </button>
                  )}
                  <div className="text-xs text-muted mt-1">+${d.totalYieldPaid?.toFixed(2) || "0"} earned</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Yield History */}
      {yieldLogs.length > 0 && (
        <>
          <h2 className="font-display font-semibold text-xl mb-4">Recent Yield Payments</h2>
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
                    <td className="p-3 text-right font-semibold text-brand">+${l.amount?.toFixed(4)} {l.asset}</td>
                    <td className="p-3 text-right text-xs text-muted">{new Date(l.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
