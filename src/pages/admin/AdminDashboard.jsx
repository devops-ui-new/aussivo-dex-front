import { useEffect, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import toast from "react-hot-toast";

import { API } from "../../config/api";
const hdr = () => ({ Authorization: `Bearer ${localStorage.getItem("admin_token")}`, "Content-Type": "application/json" });

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [showApyModal, setShowApyModal] = useState(false);
  const [apyConfig, setApyConfig] = useState({ distributeAll: true, vaultId: "", customPercent: "", confirmText: "" });
  const [apyLoading, setApyLoading] = useState(false);
  const [apyResult, setApyResult] = useState(null);
  const [vaults, setVaults] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/admin/dashboard`, { headers: hdr() }).then(r => r.json()).then(d => setData(d.data)).catch(() => {});
    fetch(`${API}/api/admin/vaults`, { headers: hdr() }).then(r => r.json()).then(d => setVaults(d.data || [])).catch(() => {});
  }, []);

  const triggerAPY = async () => {
    if (apyConfig.confirmText !== "DISTRIBUTE") { toast.error("Type DISTRIBUTE to confirm"); return; }
    setApyLoading(true);
    try {
      const body = {};
      if (!apyConfig.distributeAll && apyConfig.vaultId) body.vaultId = apyConfig.vaultId;
      const res = await fetch(`${API}/api/admin/distribute-apy`, { method: "POST", headers: hdr(), body: JSON.stringify(body) });
      const d = await res.json();
      if (d.status === 200) {
        setApyResult(d.data);
        toast.success(`APY distributed successfully!`);
        fetch(`${API}/api/admin/dashboard`, { headers: hdr() }).then(r => r.json()).then(d => setData(d.data));
      } else toast.error(d.message);
    } catch { toast.error("Distribution failed"); }
    setApyLoading(false);
  };

  const stats = [
    { label: "Total Value Locked", value: `$${(data?.totalTVL || 0).toLocaleString()}`, icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", color: "text-brand", bg: "bg-brand/8" },
    { label: "Active Users", value: data?.totalUsers || 0, icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z", color: "text-blue-400", bg: "bg-blue-500/8" },
    { label: "Total Deposits", value: data?.totalDeposits || 0, icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z", color: "text-amber-400", bg: "bg-amber-500/8" },
    { label: "Active Vaults", value: data?.activeVaults || 0, icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5", color: "text-purple-400", bg: "bg-purple-500/8" },
    { label: "Yield Distributed", value: `$${(data?.totalYieldDistributed || 0).toLocaleString()}`, icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", color: "text-emerald-400", bg: "bg-emerald-500/8" },
    { label: "Pending Withdrawals", value: data?.pendingWithdrawals || 0, icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", color: data?.pendingWithdrawals > 0 ? "text-red-400" : "text-slate-400", bg: data?.pendingWithdrawals > 0 ? "bg-red-500/8" : "bg-surface-3" },
  ];

  return (
    <AdminLayout title="Dashboard">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="glass p-5 hover:border-surface-4/60 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={s.color}><path d={s.icon}/></svg>
              </div>
              <span className="text-xs text-muted uppercase tracking-wider font-medium">{s.label}</span>
            </div>
            <div className={`text-2xl font-display font-bold ${s.color}`}>{data ? s.value : "—"}</div>
          </div>
        ))}
      </div>

      {/* APY Distribution Card */}
      <div className="glass p-6 mb-8 border-brand/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="1.8"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-white">Monthly APY Distribution</h3>
              <p className="text-xs text-muted mt-0.5">Credits yield to all active deposits + referral commissions (L1: 0.35%, L2: 0.15%)</p>
            </div>
          </div>
          <button onClick={() => { setShowApyModal(true); setApyResult(null); setApyConfig({ distributeAll: true, vaultId: "", customPercent: "", confirmText: "" }); }}
            className="btn-primary px-6 py-3 flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
            Distribute APY
          </button>
        </div>
      </div>

      {/* Recent Deposits */}
      <div className="glass p-6">
        <h3 className="font-display font-semibold text-base text-white mb-4">Recent Deposits</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-muted border-b border-surface-4/50">
              <th className="text-left pb-3 font-medium">User</th><th className="text-left pb-3 font-medium">Vault</th>
              <th className="text-right pb-3 font-medium">Amount</th><th className="text-right pb-3 font-medium">APY</th>
              <th className="text-right pb-3 font-medium">Date</th>
            </tr></thead>
            <tbody>
              {(data?.recentDeposits || []).map((d, i) => (
                <tr key={i} className="border-b border-surface-4/20 hover:bg-surface-3/20">
                  <td className="py-3"><div className="font-medium text-slate-300">{d.userId?.name || "—"}</div><div className="text-[11px] text-muted">{d.userId?.email}</div></td>
                  <td className="py-3 text-slate-400">{d.vaultId?.name || "—"}</td>
                  <td className="py-3 text-right font-semibold text-white">${d.amount?.toLocaleString()}</td>
                  <td className="py-3 text-right text-brand font-medium">{d.apyPercent}%</td>
                  <td className="py-3 text-right text-muted text-xs">{new Date(d.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {(!data?.recentDeposits?.length) && <tr><td colSpan={5} className="py-10 text-center text-muted">No deposits yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ APY DISTRIBUTION MODAL ═══ */}
      {showApyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={() => setShowApyModal(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative glass w-full max-w-lg mx-4 p-0 overflow-hidden" onClick={e => e.stopPropagation()}
            style={{ animation: "modalIn 0.25s ease-out" }}>

            <div className="flex items-center justify-between p-6 border-b border-surface-4/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                </div>
                <div>
                  <h2 className="font-display font-bold text-lg text-white">Distribute APY</h2>
                  <p className="text-xs text-muted">Configure and execute yield distribution</p>
                </div>
              </div>
              <button onClick={() => setShowApyModal(false)} className="w-8 h-8 rounded-lg bg-surface-3/80 flex items-center justify-center text-muted hover:text-white">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {!apyResult ? (
                <>
                  {/* Scope Selection */}
                  <div>
                    <label className="text-sm text-muted mb-3 block font-medium">Distribution Scope</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setApyConfig(c => ({...c, distributeAll: true, vaultId: ""}))}
                        className={`p-4 rounded-xl border text-left transition-all ${apyConfig.distributeAll ? "border-brand/40 bg-brand/5" : "border-surface-4/50 hover:border-surface-4"}`}>
                        <div className="text-sm font-semibold text-white mb-1">All Vaults</div>
                        <div className="text-xs text-muted">Distribute to every active deposit across all vaults</div>
                      </button>
                      <button onClick={() => setApyConfig(c => ({...c, distributeAll: false}))}
                        className={`p-4 rounded-xl border text-left transition-all ${!apyConfig.distributeAll ? "border-brand/40 bg-brand/5" : "border-surface-4/50 hover:border-surface-4"}`}>
                        <div className="text-sm font-semibold text-white mb-1">Specific Vault</div>
                        <div className="text-xs text-muted">Choose one vault to distribute</div>
                      </button>
                    </div>
                  </div>

                  {/* Vault Selection (if specific) */}
                  {!apyConfig.distributeAll && (
                    <div>
                      <label className="text-sm text-muted mb-2 block font-medium">Select Vault</label>
                      <select value={apyConfig.vaultId} onChange={e => setApyConfig(c => ({...c, vaultId: e.target.value}))}
                        className="input-field text-sm">
                        <option value="">Choose a vault...</option>
                        {vaults.filter(v => v.status === "active").map(v => (
                          <option key={v._id} value={v._id}>{v.name} — {v.asset} — TVL: ${v.totalStaked?.toLocaleString()}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="bg-surface-2/50 rounded-xl p-4 border border-surface-4/30 space-y-2">
                    <div className="text-xs text-muted uppercase tracking-wider font-medium mb-2">Distribution Summary</div>
                    <div className="flex justify-between text-sm"><span className="text-muted">Scope</span><span className="text-white font-medium">{apyConfig.distributeAll ? "All active vaults" : (vaults.find(v => v._id === apyConfig.vaultId)?.name || "None selected")}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted">APY Rate</span><span className="text-white font-medium">Per-tier (as configured in vault)</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted">Referral L1</span><span className="text-brand font-medium">0.35% of yield</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted">Referral L2</span><span className="text-blue-400 font-medium">0.15% of yield</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted">Guard</span><span className="text-muted">Skips already-paid this month</span></div>
                  </div>

                  {/* Danger Zone Confirmation */}
                  <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-4">
                    <div className="text-xs text-red-400 font-medium mb-2">⚠️ This action will credit real balances to all users. Type DISTRIBUTE to confirm.</div>
                    <input value={apyConfig.confirmText} onChange={e => setApyConfig(c => ({...c, confirmText: e.target.value}))}
                      placeholder="Type DISTRIBUTE" className="input-field text-sm font-mono" />
                  </div>

                  <button onClick={triggerAPY} disabled={apyLoading || apyConfig.confirmText !== "DISTRIBUTE" || (!apyConfig.distributeAll && !apyConfig.vaultId)}
                    className="w-full py-4 rounded-xl font-display font-bold text-base transition-all disabled:opacity-30 bg-gradient-to-r from-brand-dark to-brand text-[#060b18] hover:shadow-lg hover:shadow-brand/20">
                    {apyLoading ? "Distributing..." : "Execute Distribution"}
                  </button>
                </>
              ) : (
                /* Results */
                <div className="text-center py-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand/10 flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <h3 className="font-display font-bold text-xl text-white mb-2">Distribution Complete</h3>
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="bg-surface-2/50 rounded-xl p-4">
                      <div className="text-2xl font-display font-bold text-brand">${apyResult.totalDistributed?.toFixed(2)}</div>
                      <div className="text-xs text-muted mt-1">Total Distributed</div>
                    </div>
                    <div className="bg-surface-2/50 rounded-xl p-4">
                      <div className="text-2xl font-display font-bold text-blue-400">{apyResult.usersProcessed}</div>
                      <div className="text-xs text-muted mt-1">Users Processed</div>
                    </div>
                    <div className="bg-surface-2/50 rounded-xl p-4">
                      <div className="text-2xl font-display font-bold text-red-400">{apyResult.errors}</div>
                      <div className="text-xs text-muted mt-1">Errors</div>
                    </div>
                  </div>
                  <button onClick={() => setShowApyModal(false)} className="btn-secondary mt-6 px-8">Close</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.95) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
    </AdminLayout>
  );
}
