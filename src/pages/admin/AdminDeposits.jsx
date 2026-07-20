import { useEffect, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import UserDetailModal from "../../components/admin/UserDetailModal";
import toast from "react-hot-toast";

import { API } from "../../config/api";
const hdr = () => ({ Authorization: `Bearer ${localStorage.getItem("admin_token")}`, "Content-Type": "application/json" });

// Origin badge: explicit manual flag wins; otherwise infer from the txHash shape.
function originOf(d) {
  if (d.manual) return { label: "Manual", cls: "tag-yellow" };
  const h = d.txHash || "";
  if (h.startsWith("ephemeral")) return { label: "Swept", cls: "tag-blue" };
  if (/^0x[0-9a-fA-F]{64}$/.test(h)) return { label: "On-chain", cls: "tag-green" };
  return { label: "—", cls: "" };
}


/**
 * Settled outside the platform — hidden from admin. Mirrors AdminSweepHealth /
 * AdminDepositAddresses. Matched case-insensitively and by prefix, because deposits
 * store a lowercased walletAddress while the explorer shows mixed case.
 */

export default function AdminDeposits() {
  const [deposits, setDeposits] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ manualCount: 0, onchainCount: 0 });
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(null);
  const [openUserId, setOpenUserId] = useState(null);

  const load = () => {
    const q = new URLSearchParams({ page, limit: 20, ...(filter && { status: filter }) });
    fetch(`${API}/api/admin/deposits?${q}`, { headers: hdr() })
      .then(r => r.json())
      .then(d => {
        setDeposits(d.data?.deposits || []);
        setTotal(d.data?.total || 0);
        setCounts({ manualCount: d.data?.manualCount || 0, onchainCount: d.data?.onchainCount || 0 });
      });
  };
  useEffect(load, [page, filter]);

  const toggleManual = async (dep) => {
    setBusy(dep._id);
    try {
      const res = await fetch(`${API}/api/admin/deposits/${dep._id}/manual`, {
        method: "POST", headers: hdr(), body: JSON.stringify({ manual: !dep.manual }),
      });
      const d = await res.json();
      if (d.status === 200) {
        toast.success(!dep.manual ? "Marked as manual" : "Marked as on-chain");
        setDeposits(prev => prev.map(x => x._id === dep._id ? { ...x, manual: !dep.manual } : x));
        setCounts(c => ({
          manualCount: c.manualCount + (!dep.manual ? 1 : -1),
          onchainCount: c.onchainCount + (!dep.manual ? -1 : 1),
        }));
      } else toast.error(d.message || "Failed");
    } catch { toast.error("Failed"); }
    setBusy(null);
  };

  return (
    <AdminLayout title="Deposits">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display font-bold text-xl">Deposits ({total})</h2>
          <span className="tag tag-yellow text-[10px]">Manual: {counts.manualCount}</span>
          <span className="tag tag-green text-[10px]">On-chain: {counts.onchainCount}</span>
        </div>
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
            <th className="text-right p-3">APY</th><th className="text-center p-3">Cycles Paid</th>
            <th className="text-center p-3">Origin</th><th className="text-center p-3">Status</th><th className="text-right p-3">Date</th>
          </tr></thead>
          <tbody>
            {deposits.map(d => {
              const origin = originOf(d);
              return (
                <tr key={d._id} className={`border-b border-surface-4/20 ${d.manual ? "bg-yellow-500/[0.04]" : ""}`}>
                  <td className="p-3">
                    <button onClick={() => d.userId?._id && setOpenUserId(d.userId._id)} className="text-left group" disabled={!d.userId?._id}>
                      <div className="text-xs text-slate-200 group-hover:text-brand group-hover:underline">{d.userId?.email || "—"}</div>
                      <div className="text-[10px] text-muted font-mono">{d.walletAddress?.slice(0, 10)}...</div>
                    </button>
                  </td>
                  <td className="p-3">{d.vaultId?.name || "—"} <span className="text-xs text-muted">{d.asset}</span></td>
                  <td className="p-3 text-right font-semibold">${d.amount?.toLocaleString()}</td>
                  <td className="p-3 text-right text-brand">{d.apyPercent}%</td>
                  <td className="p-3 text-center text-xs">{d.yieldPaymentsCount}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className={`tag text-[10px] ${origin.cls}`}>{origin.label}</span>
                      <button onClick={() => toggleManual(d)} disabled={busy === d._id}
                        className="text-[10px] text-muted hover:text-brand disabled:opacity-40" title={d.manual ? "Mark as on-chain" : "Mark as manual"}>
                        {busy === d._id ? "…" : d.manual ? "unmark" : "mark manual"}
                      </button>
                    </div>
                  </td>
                  <td className="p-3 text-center"><span className={`tag text-[10px] ${d.status === 'active' ? 'tag-green' : d.status === 'matured' ? 'tag-blue' : 'tag-yellow'}`}>{d.status}</span></td>
                  <td className="p-3 text-right text-xs text-muted">{new Date(d.createdAt).toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between p-3 border-t border-surface-4/30">
          <span className="text-xs text-muted">Page {page}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="text-xs text-muted disabled:opacity-30">← Prev</button>
            <button onClick={() => setPage(p => p + 1)} disabled={deposits.length < 20} className="text-xs text-muted disabled:opacity-30">Next →</button>
          </div>
        </div>
      </div>
      {openUserId && <UserDetailModal userId={openUserId} onClose={() => setOpenUserId(null)} />}
    </AdminLayout>
  );
}