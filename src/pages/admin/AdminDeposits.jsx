import { useEffect, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";

import { API } from "../../config/api";
const hdr = () => ({ Authorization: `Bearer ${localStorage.getItem("admin_token")}`, "Content-Type": "application/json" });

export default function AdminDeposits() {
  const [deposits, setDeposits] = useState([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");

  const load = () => {
    const q = new URLSearchParams({ page, limit: 20, ...(filter && { status: filter }) });
    fetch(`${API}/api/admin/deposits?${q}`, { headers: hdr() }).then(r => r.json()).then(d => { setDeposits(d.data?.deposits || []); setTotal(d.data?.total || 0); });
  };
  useEffect(load, [page, filter]);

  return (
    <AdminLayout title="Deposits">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-bold text-xl">Deposits ({total})</h2>
        <div className="flex gap-2">
          <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="input-field text-sm w-36">
            <option value="">All</option><option value="active">Active</option><option value="matured">Matured</option><option value="withdrawn">Withdrawn</option>
          </select>
        </div>
      </div>

      <div className="glass overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-muted border-b border-surface-4 bg-surface-2/30">
            <th className="text-left p-3">User</th><th className="text-left p-3">Vault</th><th className="text-right p-3">Amount</th>
            <th className="text-right p-3">APY</th><th className="text-center p-3">Yield Paid</th><th className="text-center p-3">Status</th><th className="text-right p-3">Date</th>
          </tr></thead>
          <tbody>
            {deposits.map(d => (
              <tr key={d._id} className="border-b border-surface-4/20">
                <td className="p-3"><div className="text-xs">{d.userId?.email || "—"}</div><div className="text-[10px] text-muted font-mono">{d.walletAddress?.slice(0,10)}...</div></td>
                <td className="p-3">{d.vaultId?.name || "—"} <span className="text-xs text-muted">{d.asset}</span></td>
                <td className="p-3 text-right font-semibold">${d.amount?.toLocaleString()}</td>
                <td className="p-3 text-right text-brand">{d.apyPercent}%</td>
                <td className="p-3 text-center text-xs">{d.yieldPaymentsCount}/{d.maxYieldPayments}</td>
                <td className="p-3 text-center"><span className={`tag text-[10px] ${d.status === 'active' ? 'tag-green' : d.status === 'matured' ? 'tag-blue' : 'tag-yellow'}`}>{d.status}</span></td>
                <td className="p-3 text-right text-xs text-muted">{new Date(d.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between p-3 border-t border-surface-4/30">
          <span className="text-xs text-muted">Page {page}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="text-xs text-muted disabled:opacity-30">← Prev</button>
            <button onClick={() => setPage(p => p+1)} disabled={deposits.length<20} className="text-xs text-muted disabled:opacity-30">Next →</button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
