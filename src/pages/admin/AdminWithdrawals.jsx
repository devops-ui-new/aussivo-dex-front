import { useEffect, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import toast from "react-hot-toast";

import { API } from "../../config/api";
const hdr = () => ({ Authorization: `Bearer ${localStorage.getItem("admin_token")}`, "Content-Type": "application/json" });

export default function AdminWithdrawals() {
  const [requests, setRequests] = useState([]); const [filter, setFilter] = useState("pending"); const [page, setPage] = useState(1);
  const [txHash, setTxHash] = useState(""); const [note, setNote] = useState(""); const [processing, setProcessing] = useState(null);

  const load = () => {
    const q = new URLSearchParams({ page, limit: 20, status: filter });
    fetch(`${API}/api/admin/withdrawals?${q}`, { headers: hdr() }).then(r => r.json()).then(d => setRequests(d.data?.requests || []));
  };
  useEffect(load, [page, filter]);

  const process = async (id, action) => {
    setProcessing(id);
    try {
      const res = await fetch(`${API}/api/admin/withdrawals/process`, {
        method: "POST", headers: hdr(), body: JSON.stringify({ requestId: id, action, txHash: action === "approve" ? txHash : "", note })
      });
      const d = await res.json();
      if (d.status === 200) { toast.success(`Withdrawal ${action}d`); setTxHash(""); setNote(""); load(); }
      else toast.error(d.message);
    } catch { toast.error("Failed"); }
    setProcessing(null);
  };

  return (
    <AdminLayout title="Withdrawals">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-bold text-xl">Withdrawal Requests</h2>
        <div className="flex gap-1">
          {["pending", "completed", "rejected"].map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${filter === f ? "bg-brand/10 text-brand" : "text-muted"}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {requests.map(r => (
          <div key={r._id} className="glass p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{r.userId?.name || "Unknown"} <span className="text-xs text-muted ml-2">{r.userId?.email}</span></div>
                <div className="text-xs text-muted mt-1 font-mono">{r.walletAddress}</div>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="font-bold text-lg text-brand">${r.amount} {r.asset}</span>
                  <span className="tag tag-blue text-[10px]">{r.source}</span>
                  <span className="text-muted text-xs">{new Date(r.createdAt).toLocaleString()}</span>
                </div>
              </div>
              {r.status === "pending" && (
                <div className="space-y-2 w-72">
                  <input value={txHash} onChange={e => setTxHash(e.target.value)} placeholder="Tx hash (after sending)" className="input-field text-xs" />
                  <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className="input-field text-xs" />
                  <div className="flex gap-2">
                    <button onClick={() => process(r._id, "approve")} disabled={processing === r._id}
                      className="flex-1 bg-brand/10 text-brand border border-brand/20 rounded-lg py-2 text-xs font-semibold hover:bg-brand/20 disabled:opacity-50">
                      {processing === r._id ? "..." : "✓ Approve"}
                    </button>
                    <button onClick={() => process(r._id, "reject")} disabled={processing === r._id}
                      className="flex-1 bg-red-500/10 text-red-400 border border-red-400/20 rounded-lg py-2 text-xs font-semibold hover:bg-red-500/20 disabled:opacity-50">
                      {processing === r._id ? "..." : "✕ Reject"}
                    </button>
                  </div>
                </div>
              )}
              {r.status !== "pending" && (
                <span className={`tag ${r.status === "completed" ? "tag-green" : "tag-red"}`}>{r.status}</span>
              )}
            </div>
          </div>
        ))}
        {requests.length === 0 && <div className="glass p-10 text-center text-muted">No {filter} withdrawal requests</div>}
      </div>
    </AdminLayout>
  );
}
