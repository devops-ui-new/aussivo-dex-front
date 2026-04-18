import { useEffect, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";

const API = "http://localhost:4000";
const hdr = () => ({ Authorization: `Bearer ${localStorage.getItem("admin_token")}` });

export default function AdminYieldLogs() {
  const [logs, setLogs] = useState([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1); const [source, setSource] = useState("");

  useEffect(() => {
    const q = new URLSearchParams({ page, limit: 30, ...(source && { source }) });
    fetch(`${API}/api/admin/yield-logs?${q}`, { headers: hdr() }).then(r => r.json()).then(d => { setLogs(d.data?.logs || []); setTotal(d.data?.total || 0); });
  }, [page, source]);

  return (
    <AdminLayout title="Yield Distribution Logs">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-bold text-xl">Yield Logs ({total})</h2>
        <div className="flex gap-1">
          {[{ k: "", l: "All" }, { k: "vault_apy", l: "APY" }, { k: "referral_l1", l: "Ref L1" }, { k: "referral_l2", l: "Ref L2" }].map(f => (
            <button key={f.k} onClick={() => { setSource(f.k); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${source === f.k ? "bg-brand/10 text-brand" : "text-muted"}`}>{f.l}</button>
          ))}
        </div>
      </div>

      <div className="glass overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-muted border-b border-surface-4 bg-surface-2/30">
            <th className="text-left p-3">User</th><th className="text-left p-3">Vault</th><th className="text-left p-3">Source</th>
            <th className="text-right p-3">Amount</th><th className="text-right p-3">APY %</th><th className="text-right p-3">Deposit $</th><th className="text-right p-3">Date</th>
          </tr></thead>
          <tbody>
            {logs.map(l => (
              <tr key={l._id} className="border-b border-surface-4/20">
                <td className="p-3 text-xs">{l.userId?.email || "—"}</td>
                <td className="p-3 text-xs">{l.vaultId?.name || "—"}</td>
                <td className="p-3"><span className={`tag text-[10px] ${l.source === 'vault_apy' ? 'tag-green' : l.source === 'referral_l1' ? 'tag-blue' : 'tag-yellow'}`}>{l.source.replace("_", " ")}</span></td>
                <td className="p-3 text-right font-semibold text-brand">${l.amount?.toFixed(4)}</td>
                <td className="p-3 text-right">{l.apyPercent}%</td>
                <td className="p-3 text-right text-muted">${l.depositAmount?.toLocaleString()}</td>
                <td className="p-3 text-right text-xs text-muted">{new Date(l.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between p-3 border-t border-surface-4/30">
          <span className="text-xs text-muted">Page {page}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="text-xs text-muted disabled:opacity-30">← Prev</button>
            <button onClick={() => setPage(p => p+1)} disabled={logs.length<30} className="text-xs text-muted disabled:opacity-30">Next →</button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
