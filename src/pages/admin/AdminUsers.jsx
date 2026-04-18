import { useEffect, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";

import { API } from "../../config/api";
const hdr = () => ({ Authorization: `Bearer ${localStorage.getItem("admin_token")}` });

export default function AdminUsers() {
  const [users, setUsers] = useState([]); const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1); const [search, setSearch] = useState(""); const [detail, setDetail] = useState(null);

  const load = () => {
    const q = new URLSearchParams({ page, limit: 20, ...(search && { search }) });
    fetch(`${API}/api/admin/users?${q}`, { headers: hdr() }).then(r => r.json()).then(d => { setUsers(d.data?.users || []); setTotal(d.data?.total || 0); });
  };
  useEffect(load, [page, search]);

  const loadDetail = (id) => fetch(`${API}/api/admin/users/${id}`, { headers: hdr() }).then(r => r.json()).then(d => setDetail(d.data));

  return (
    <AdminLayout title="Users">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-bold text-xl">Users ({total})</h2>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, email, wallet..." className="input-field text-sm w-72" />
      </div>

      {detail ? (
        <div className="glass p-6 mb-6">
          <button onClick={() => setDetail(null)} className="text-xs text-muted hover:text-slate-300 mb-4">← Back to list</button>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-display font-semibold text-lg mb-3">{detail.user?.name}</h3>
              <div className="space-y-2 text-sm">
                {[["Email", detail.user?.email], ["Wallet", detail.user?.walletAddress], ["Referral Code", detail.user?.referralCode], ["Status", detail.user?.status],
                  ["USDT Balance", `$${detail.user?.usdtBalance?.toFixed(2)}`], ["USDC Balance", `$${detail.user?.usdcBalance?.toFixed(2)}`],
                  ["Yield USDT", `$${detail.user?.yieldWalletUSDT?.toFixed(2)}`], ["Yield USDC", `$${detail.user?.yieldWalletUSDC?.toFixed(2)}`],
                  ["Referral Earnings", `$${detail.user?.referralEarnings?.toFixed(2)}`], ["Total Deposited", `$${detail.user?.totalDeposited?.toFixed(2)}`],
                  ["Joined", new Date(detail.user?.createdAt).toLocaleDateString()]
                ].map(([k,v],i) => <div key={i} className="flex justify-between py-1.5 border-b border-surface-4/30"><span className="text-muted">{k}</span><span className="font-medium">{v}</span></div>)}
              </div>
            </div>
            <div>
              <h4 className="font-display font-semibold mb-2">Deposits ({detail.deposits?.length})</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {detail.deposits?.map((d,i) => (
                  <div key={i} className="bg-surface-2/50 rounded-lg p-3 text-xs">
                    <div className="flex justify-between"><span>{d.vaultId?.name}</span><span className="text-brand font-semibold">${d.amount}</span></div>
                    <div className="text-muted mt-1">APY: {d.apyPercent}% · Status: {d.status} · Yield paid: {d.yieldPaymentsCount}/{d.maxYieldPayments}</div>
                  </div>
                ))}
              </div>
              <h4 className="font-display font-semibold mb-2 mt-4">Referrals ({detail.referrals?.length})</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {detail.referrals?.map((r,i) => <div key={i} className="text-xs text-muted">{r.email} · ${r.totalDeposited?.toFixed(0)} deposited</div>)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-muted border-b border-surface-4 bg-surface-2/30">
              <th className="text-left p-3">User</th><th className="text-left p-3">Wallet</th>
              <th className="text-right p-3">USDT</th><th className="text-right p-3">Yield</th>
              <th className="text-right p-3">Deposited</th><th className="text-right p-3">Ref Earnings</th>
              <th className="text-center p-3">Status</th><th className="p-3"></th>
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id} className="border-b border-surface-4/20 hover:bg-surface-2/20">
                  <td className="p-3"><div className="font-medium">{u.name}</div><div className="text-xs text-muted">{u.email}</div></td>
                  <td className="p-3 text-xs font-mono text-muted">{u.walletAddress?.slice(0,8)}...{u.walletAddress?.slice(-6)}</td>
                  <td className="p-3 text-right">${u.usdtBalance?.toFixed(2)}</td>
                  <td className="p-3 text-right text-brand">${(u.yieldWalletUSDT + u.yieldWalletUSDC)?.toFixed(2)}</td>
                  <td className="p-3 text-right">${u.totalDeposited?.toFixed(0)}</td>
                  <td className="p-3 text-right">${u.referralEarnings?.toFixed(2)}</td>
                  <td className="p-3 text-center"><span className={`tag text-[10px] ${u.status === 'active' ? 'tag-green' : 'tag-red'}`}>{u.status}</span></td>
                  <td className="p-3"><button onClick={() => loadDetail(u._id)} className="text-xs text-brand hover:underline">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between p-3 border-t border-surface-4/30">
            <span className="text-xs text-muted">Page {page} · {total} total</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="text-xs text-muted hover:text-slate-300 disabled:opacity-30">← Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={users.length < 20} className="text-xs text-muted hover:text-slate-300 disabled:opacity-30">Next →</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
